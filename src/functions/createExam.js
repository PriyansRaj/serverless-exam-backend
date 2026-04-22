const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const container = database.container("exams");

app.http("createExam", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { title, subject, duration, questions, teacherId } = body;

      const exam = {
        id: Date.now().toString(),
        title,
        subject,
        duration,
        questions,
        teacherId,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      await container.items.create(exam);

      return {
        status: 200,
        jsonBody: {
          message: "Exam created successfully",
          examId: exam.id,
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
