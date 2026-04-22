const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const container = database.container("results");

app.http("getResults", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const studentId = request.query.get("studentId");
      const examId = request.query.get("examId");

      if (!studentId) {
        return {
          status: 400,
          jsonBody: { error: "studentId is required" },
        };
      }

      let query;

      if (examId) {
        // Get specific exam result for student
        query = {
          query:
            "SELECT * FROM c WHERE c.studentId = @studentId AND c.examId = @examId",
          parameters: [
            { name: "@studentId", value: studentId },
            { name: "@examId", value: examId },
          ],
        };
      } else {
        // Get all results for student
        query = {
          query: "SELECT * FROM c WHERE c.studentId = @studentId",
          parameters: [{ name: "@studentId", value: studentId }],
        };
      }

      const { resources: results } = await container.items
        .query(query)
        .fetchAll();

      return {
        status: 200,
        jsonBody: { results },
      };
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: error.message },
      };
    }
  },
});
