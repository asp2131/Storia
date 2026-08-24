import { Resend } from "resend";
import nodemailer from "nodemailer";

/**
 * One-off transactional email. Auth's OTP mail is sent by Better Auth's own
 * emailOTP plugin (src/lib/auth.ts); this is the same Resend-in-prod,
 * SMTP-locally fallback for everything else.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY || "";

  if (resendKey.startsWith("re_")) {
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Loratone <onboarding@resend.dev>",
      ...opts,
    });
    if (result.error) {
      console.error("[mail] Resend send error:", result.error);
      throw new Error("Failed to send email");
    }
    return;
  }

  // Local dev / testing: Mailpit on :1025 by default.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || "1025"),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Loratone <admin@loratone.local>",
    ...opts,
  });
}
