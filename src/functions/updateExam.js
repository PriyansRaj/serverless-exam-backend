const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database("ExamDB");
const container = database.container("exams");

app.http("updateExam", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { examId, title, subject, duration, passPercent, questions } = body;

      if (!examId) {
        return {
          status: 400,
          jsonBody: { error: "examId is required" },
        };
      }

      // Get existing exam
      const { resource: existing } = await container
        .item(examId, examId)
        .read();

      if (!existing) {
        return {
          status: 404,
          jsonBody: { error: "Exam not found" },
        };
      }

      // Update fields
      const updated = {
        ...existing,
        title: title || existing.title,
        subject: subject || existing.subject,
        duration: duration || existing.duration,
        passPercent: passPercent || existing.passPercent,
        questions: questions || existing.questions,
        updatedAt: new Date().toISOString(),
      };

      await container.items.upsert(updated);

      return {
        status: 200,
        jsonBody: {
          message: "Exam updated successfully",
          examId,
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
