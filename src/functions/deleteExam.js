const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const container = database.container("exams");

app.http("deleteExam", {
  methods: ["DELETE"],
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

      await container.item(examId, examId).delete();

      return {
        status: 200,
        jsonBody: { message: "Exam deleted successfully" },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: error.message },
      };
    }
  },
});
