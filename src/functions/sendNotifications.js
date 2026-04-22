const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

const emailClient = new EmailClient(
  process.env.COMMUNICATION_CONNECTION_STRING,
);
const senderEmail = process.env.SENDER_EMAIL;

app.http("sendNotification", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const {
        studentEmail,
        studentName,
        examTitle,
        score,
        total,
        percentage,
        passed,
      } = body;

      if (!studentEmail) {
        return { status: 400, jsonBody: { error: "studentEmail is required" } };
      }

      const passColor = passed ? "#44ff88" : "#ff4444";
      const passText = passed ? "PASSED" : "FAILED";
      const emoji = passed ? "🎉" : "📚";

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#111111;border-radius:16px;border:1px solid #222222;overflow:hidden;">
    
    <!-- Header -->
    <div style="background:#111111;padding:32px;border-bottom:1px solid #222222;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#e8ff47;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;">✦</div>
        <span style="font-size:20px;font-weight:600;color:#f0f0f0;letter-spacing:-0.02em;">Exam<span style="color:#e8ff47;">ly</span></span>
      </div>
      <p style="color:#666666;font-size:13px;margin:0;">Examination Result</p>
    </div>

    <!-- Score -->
    <div style="padding:40px 32px;text-align:center;border-bottom:1px solid #222222;">
      <div style="width:100px;height:100px;border-radius:50%;border:3px solid ${passColor};display:inline-flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:20px;">
        <span style="font-size:28px;font-weight:700;color:${passColor};">${percentage}%</span>
        <span style="font-size:10px;color:#666666;text-transform:uppercase;letter-spacing:0.08em;">${passText}</span>
      </div>
      <h2 style="font-size:22px;font-weight:600;color:#f0f0f0;margin:0 0 8px;letter-spacing:-0.02em;">${emoji} ${passed ? "Congratulations!" : "Keep it up!"}</h2>
      <p style="color:#666666;font-size:14px;margin:0;">Hi ${studentName}, your results are in.</p>
    </div>

    <!-- Details -->
    <div style="padding:24px 32px;border-bottom:1px solid #222222;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:#666666;font-size:13px;">Exam</td>
          <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;">${examTitle}</td>
        </tr>
        <tr style="border-top:1px solid #222222;">
          <td style="padding:10px 0;color:#666666;font-size:13px;">Score</td>
          <td style="padding:10px 0;color:#f0f0f0;font-size:13px;font-weight:500;text-align:right;font-family:monospace;">${score} / ${total}</td>
        </tr>
        <tr style="border-top:1px solid #222222;">
          <td style="padding:10px 0;color:#666666;font-size:13px;">Percentage</td>
          <td style="padding:10px 0;font-size:13px;font-weight:600;text-align:right;color:${passColor};">${percentage}%</td>
        </tr>
        <tr style="border-top:1px solid #222222;">
          <td style="padding:10px 0;color:#666666;font-size:13px;">Status</td>
          <td style="padding:10px 0;text-align:right;">
            <span style="background:${passed ? "rgba(68,255,136,0.1)" : "rgba(255,68,68,0.1)"};color:${passColor};padding:3px 10px;border-radius:100px;font-size:12px;font-weight:500;">${passText}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;text-align:center;">
      <p style="color:#444444;font-size:12px;margin:0;">This is an automated message from Examly.</p>
      <p style="color:#444444;font-size:12px;margin:4px 0 0;">Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

      const message = {
        senderAddress: senderEmail,
        recipients: {
          to: [{ address: studentEmail, displayName: studentName }],
        },
        content: {
          subject: `${emoji} Your result for ${examTitle} — ${percentage}% (${passText})`,
          html: htmlContent,
          plainText: `Hi ${studentName},\n\nYour result for ${examTitle}:\nScore: ${score}/${total}\nPercentage: ${percentage}%\nStatus: ${passText}\n\nExamly`,
        },
      };

      const poller = await emailClient.beginSend(message);
      await poller.pollUntilDone();

      return {
        status: 200,
        jsonBody: { message: "Email sent successfully" },
      };
    } catch (error) {
      context.log("Email error:", error);
      return {
        status: 500,
        jsonBody: { error: error.message },
      };
    }
  },
});
