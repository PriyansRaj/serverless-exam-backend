const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const examsContainer = database.container("exams");
const resultsContainer = database.container("results");

app.http("submitAnswers", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { examId, studentId, studentName, answers } = body;

      // Get exam with correct answers
      const { resource: exam } = await examsContainer
        .item(examId, examId)
        .read();

      if (!exam) {
        return {
          status: 404,
          jsonBody: { error: "Exam not found" },
        };
      }

      // Auto grade
      let score = 0;
      const gradedAnswers = exam.questions.map((q, index) => {
        const studentAnswer = answers[index];
        const isCorrect = studentAnswer === q.correctAnswer;
        if (isCorrect) score++;
        return {
          questionId: q.id,
          questionText: q.text,
          studentAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
        };
      });

      const percentage = Math.round((score / exam.questions.length) * 100);

      const result = {
        id: Date.now().toString(),
        examId,
        examTitle: exam.title,
        studentId,
        studentName,
        score,
        total: exam.questions.length,
        percentage,
        gradedAnswers,
        submittedAt: new Date().toISOString(),
        passed: percentage >= 50,
      };

      await resultsContainer.items.create(result);

      return {
        status: 200,
        jsonBody: {
          message: "Exam submitted successfully",
          score,
          total: exam.questions.length,
          percentage,
          passed: result.passed,
        },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: error.message },
      };
    }
  },
});
