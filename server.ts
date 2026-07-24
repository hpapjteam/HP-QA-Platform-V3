import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailTemplate = (title: string, content: string, ctaLink?: string, ctaText?: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; }
  .header { padding: 32px; text-align: center; border-bottom: 1px solid #f1f5f9; }
  .logo { max-height: 36px; margin-bottom: 24px; }
  .title { color: #0f172a; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.025em; }
  .content { padding: 32px; color: #334155; font-size: 16px; line-height: 1.6; }
  .content p { margin-top: 0; margin-bottom: 16px; }
  .content strong { color: #0f172a; font-weight: 600; }
  .details-box { background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #e2e8f0; }
  .button-container { text-align: center; margin: 32px 0 16px; }
  .button { display: inline-block; padding: 12px 28px; background-color: #2b61d6; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; transition: background-color 0.2s; }
  .footer { background-color: #f8fafc; padding: 24px 32px; text-align: center; color: #64748b; font-size: 13px; line-height: 1.5; border-top: 1px solid #e2e8f0; }
  .footer p { margin: 0; margin-bottom: 8px; }
  .footer p:last-child { margin-bottom: 0; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg" alt="Zeta Global" class="logo" />
      <h1 class="title">${title}</h1>
    </div>
    <div class="content">
      ${content}
      ${ctaLink && ctaText ? `
      <div class="button-container">
        <a href="${ctaLink}" class="button">${ctaText}</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Zeta Global. All rights reserved.</p>
      <p>HP-QA Platform Automation System</p>
    </div>
  </div>
</body>
</html>
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email sending API route
  app.post("/api/invite", async (req, res) => {
    const { name, email, role, team, inviteUrl } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and Name are required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, 
        },
      });

      const content = `
        <p>Hi ${name},</p>
        <p>You have been invited to join the <strong>HP-QA Platform</strong> by an administrator.</p>
        <div class="details-box">
          <p style="margin-bottom: 8px;"><strong>Assigned Team:</strong> ${team}</p>
          <p style="margin-bottom: 0;"><strong>Account Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
        </div>
        <p>Please click the button below to accept the invitation and securely complete your account setup:</p>
      `;

      const mailOptions = {
        from: `"HP-QA Platform" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Invitation to join HP-QA Platform",
        html: emailTemplate("Welcome to HP-QA Platform", content, inviteUrl, "Accept Invitation"),
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Invitation sent successfully!" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email." });
    }
  });

  app.post("/api/forgot-password", async (req, res) => {
    const { email, resetUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, 
        },
      });

      const content = `
        <p>Hi there,</p>
        <p>We received a request to reset the password for your HP-QA Platform account associated with this email address.</p>
        <p>Click the button below to choose a new password. This link will expire in 24 hours.</p>
      `;

      const mailOptions = {
        from: `"HP-QA Platform" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Password Reset Request - HP-QA Platform",
        html: emailTemplate("Reset Your Password", content, resetUrl, "Reset Password"),
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Password reset email sent successfully!" });
    } catch (error) {
      console.error("Error sending forgot password email:", error);
      res.status(500).json({ error: "Failed to send reset email." });
    }
  });

  app.post("/api/grammar-check", async (req, res) => {
    const { htmlContent } = req.body;
    if (!htmlContent) return res.status(400).json({ error: "HTML content is required" });

    try {
      const { GoogleGenAI } = await import("@google/genai");
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: `You are a strict copy editor. Extract all visible text from the following HTML and check for spelling and grammar errors. 
Do not output HTML, just list the mistakes and provide a corrected suggestion for each. If there are no mistakes, just reply with 'No grammar or spelling issues found.' 

Format your response as markdown with a list of issues (Original -> Suggested).

HTML:
${htmlContent.substring(0, 50000)}` }]
          }
        ]
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error("Error in grammar check API:", error);
      res.status(500).json({ error: "Failed to perform grammar check." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
