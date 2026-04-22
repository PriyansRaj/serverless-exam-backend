const { app } = require("@azure/functions");
const { BlobServiceClient } = require("@azure/storage-blob");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AzureWebJobsStorage,
);

app.http("parseDocument", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file) {
        return { status: 400, jsonBody: { error: "No file uploaded" } };
      }

      const fileName = file.name || "upload";
      const fileType = fileName.split(".").pop().toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      let rawText = "";

      if (fileType === "pdf") {
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
      } else if (fileType === "docx" || fileType === "doc") {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
      } else {
        return {
          status: 400,
          jsonBody: { error: "Only PDF and Word (.docx) files are supported" },
        };
      }

      // Upload to blob storage for reference
      const containerClient =
        blobServiceClient.getContainerClient("question-papers");
      const blobName = Date.now() + "-" + fileName;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(buffer, buffer.length);

      // Parse questions from text
      const questions = parseQuestions(rawText);

      if (questions.length === 0) {
        return {
          status: 400,
          jsonBody: {
            error:
              "No questions found. Make sure your file follows the format:\n1. Question\nOption1\nOption2\nOption3\nOption4\nAns: CorrectAnswer",
          },
        };
      }

      return {
        status: 200,
        jsonBody: {
          questions,
          totalFound: questions.length,
          fileName: blobName,
        },
      };
    } catch (error) {
      context.log("Parse error:", error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});

function parseQuestions(text) {
  const questions = [];

  // Normalize line endings and clean text
  const cleanText = text.replace(/\r/g, "");

  const lines = cleanText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Match question line: starts with number followed by . or )
    // e.g. "1. What is..." or "1) What is..." or "Q1. What is..."
    const questionMatch = line.match(/^(?:Q|q)?(\d+)[.)]\s+(.+)/);

    if (questionMatch) {
      const questionText = questionMatch[2].trim();
      const options = [];
      let correctAnswer = "";
      i++;

      // Collect next 4 lines as options
      while (i < lines.length && options.length < 4) {
        const optLine = lines[i];
        // Stop if we hit another question or answer line
        if (optLine.match(/^(?:Q|q)?(\d+)[.)]\s+/)) break;
        if (optLine.match(/^(?:ans|answer|Ans|Answer)\s*:/i)) break;

        // Strip option labels if present: a) A. a. A)
        const cleanOpt = optLine.replace(/^[a-dA-D][.)]\s*/, "").trim();

        if (cleanOpt) options.push(cleanOpt);
        i++;
      }

      // Check for answer line
      if (i < lines.length) {
        const ansLine = lines[i];
        const ansMatch = ansLine.match(
          /^(?:ans|answer|Ans|Answer)\s*:\s*(.+)/i,
        );
        if (ansMatch) {
          correctAnswer = ansMatch[1].trim();
          i++;
        }
      }

      // Validate — need question, 4 options and an answer
      if (questionText && options.length === 4 && correctAnswer) {
        // Match correctAnswer to one of the options
        // Support: "a", "A", "option1 text", or just the answer text
        let matchedAnswer = correctAnswer;

        // If answer is a letter (a/b/c/d), map to option
        const letterMatch = correctAnswer.match(/^[a-dA-D]$/);
        if (letterMatch) {
          const idx = correctAnswer.toLowerCase().charCodeAt(0) - 97;
          if (options[idx]) matchedAnswer = options[idx];
        }
        // If answer is a number (1/2/3/4), map to option
        const numMatch = correctAnswer.match(/^[1-4]$/);
        if (numMatch) {
          const idx = parseInt(correctAnswer) - 1;
          if (options[idx]) matchedAnswer = options[idx];
        }

        questions.push({
          id: "q" + Date.now() + "_" + questions.length,
          text: questionText,
          options,
          correctAnswer: matchedAnswer,
        });
      }
    } else {
      i++;
    }
  }

  return questions;
}
