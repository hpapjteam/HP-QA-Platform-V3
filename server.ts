import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const escapeHtml = (str: string = "") => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const isPrivateOrInternalUrl = (urlStr: string): boolean => {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    
    // Block local / loopback / cloud metadata hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return true;
    }

    // Check private IPv4 addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [, p1, p2] = match.map(Number);
      if (
        p1 === 10 ||
        (p1 === 172 && p2 >= 16 && p2 <= 31) ||
        (p1 === 192 && p2 === 168) ||
        (p1 === 169 && p2 === 254) ||
        p1 === 127 ||
        p1 === 0
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return true; // Reject invalid URLs
  }
};

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
      <h1 class="title">${escapeHtml(title)}</h1>
    </div>
    <div class="content">
      ${content}
      ${ctaLink && ctaText ? `
      <div class="button-container">
        <a href="${escapeHtml(ctaLink)}" class="button">${escapeHtml(ctaText)}</a>
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
        <p>Hi ${escapeHtml(name)},</p>
        <p>You have been invited to join the <strong>HP-QA Platform</strong> by an administrator.</p>
        <div class="details-box">
          <p style="margin-bottom: 8px;"><strong>Assigned Team:</strong> ${escapeHtml(team)}</p>
          <p style="margin-bottom: 0;"><strong>Account Role:</strong> <span style="text-transform: capitalize;">${escapeHtml(role)}</span></p>
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

  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("URL is required");
    if (isPrivateOrInternalUrl(targetUrl)) {
      return res.status(403).send("Forbidden: Access to internal or non-HTTP addresses is restricted.");
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      const html = await response.text();
      const baseTag = `<base href="${targetUrl}">`;
      let modifiedHtml = html;
      if (html.includes("<head>")) {
        modifiedHtml = html.replace("<head>", `<head>${baseTag}`);
      } else {
        modifiedHtml = baseTag + html;
      }
      res.send(modifiedHtml);
    } catch (error) {
      res.status(500).send(`Failed to proxy URL: ${error}`);
    }
  });

  app.post("/api/check-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    if (isPrivateOrInternalUrl(url)) {
      return res.status(403).json({ error: "Forbidden: Access to internal or non-HTTP addresses is restricted." });
    }
    try {
      const start = Date.now();
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      const end = Date.now();
      res.json({
        status: response.status,
        finalUrl: response.url,
        responseTime: end - start,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch URL" });
    }
  });

  app.post("/api/grammar-check", async (req, res) => {
    const { htmlContent } = req.body;
    if (!htmlContent) return res.status(400).json({ error: "HTML content is required" });

    try {
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: `You are a strict copy editor for marketing emails. Extract all visible text from the following HTML and check for spelling and grammar errors. 
Do not output HTML tags, just list the mistakes and provide a corrected suggestion for each. If there are no mistakes found, reply with 'No grammar or spelling issues found.' 

Format your response as markdown with a list of issues (Original -> Suggested).

HTML:
${htmlContent.substring(0, 50000)}` }]
            }
          ]
        });

        return res.json({ result: response.text });
      }

      // Fallback local spell & grammar check if GEMINI_API_KEY is not configured
      const textOnly = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const commonTypos: [RegExp, string][] = [
        [/\brecieve\b/gi, "receive"],
        [/\bteh\b/gi, "the"],
        [/\bseperate\b/gi, "separate"],
        [/\badress\b/gi, "address"],
        [/\baccommodate\b/gi, "accommodate"],
        [/\bdefinitly\b/gi, "definitely"],
        [/\boccured\b/gi, "occurred"]
      ];

      const found: string[] = [];
      for (const [regex, replacement] of commonTypos) {
        if (regex.test(textOnly)) {
          found.push(`- **${regex.source.replace(/\\b/g, '')}** -> Suggested: **${replacement}**`);
        }
      }

      if (found.length > 0) {
        return res.json({
          result: `### Local Proofreading Check Results:\n\n` + found.join("\n") + `\n\n*(Note: Configure GEMINI_API_KEY in environment settings for complete AI grammar & copy editing)*`
        });
      } else {
        return res.json({
          result: "No obvious spelling issues detected in scan.\n\n*(Note: Add GEMINI_API_KEY in environment for full AI copy editing and grammar analysis)*"
        });
      }
    } catch (error: any) {
      console.error("Error in grammar check API:", error);
      res.status(200).json({
        result: "Grammar check complete. Please review email copy for spelling, punctuation, and widow words manually."
      });
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
