const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const container = database.container("exams");

app.http("getExam", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const examId = request.query.get("examId");

      if (!examId) {
        return {
          status: 400,
          jsonBody: { error: "examId is required" },
        };
      }

      const { resource: exam } = await container.item(examId, examId).read();

      if (!exam) {
        return {
          status: 404,
          jsonBody: { error: "Exam not found" },
        };
      }

      // Remove correct answers before sending to student
      const safeExam = {
        ...exam,
        questions: exam.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
        })),
      };

      return {
        status: 200,
        jsonBody: safeExam,
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: error.message },
      };
    }
  },
});
