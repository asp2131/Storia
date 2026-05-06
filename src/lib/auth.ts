import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import { Resend } from "resend";
import nodemailer from "nodemailer";

// DEBUG: Log the actual DATABASE_URL at import time
console.error(`[DEBUG ENV] DATABASE_URL = ${process.env.DATABASE_URL?.replace(/\/\/[^@]+@/, "//***@")}`);

// Lazy-loaded auth instance to avoid database connection during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

function createAuth() {
  if (authInstance) {
    return authInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const RESEND_KEY = process.env.RESEND_API_KEY || "";
  const RESEND_FROM =
    process.env.RESEND_FROM_EMAIL || "Storia <onboarding@resend.dev>";

  const resend =
    RESEND_KEY && RESEND_KEY.startsWith("re_") ? new Resend(RESEND_KEY) : null;

  // Local/dev SMTP fallback (Mailpit)
  const smtpHost = process.env.SMTP_HOST || "localhost";
  const smtpPort = Number(process.env.SMTP_PORT || "1025");
  const smtpFrom = process.env.SMTP_FROM || "Storia <admin@storia.local>";
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser || smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  authInstance = betterAuth({
    database: new Pool({
      connectionString: databaseUrl,
      host: "127.0.0.1",
      port: 5433,
    }),
    trustedOrigins: [
      "http://localhost:3000",
      "https://storia.kids",
      "https://www.storia.kids",
      "https://storia-gray.vercel.app",
      "https://*.vercel.app",           // all Vercel preview deployments
      "storia://",
      "storia://*",
      ...(process.env.NODE_ENV === "development"
        ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
        : []),
    ],
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
        },
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          const subject =
            type === "sign-in"
              ? "Your Storia sign-in code"
              : type === "email-verification"
                ? "Verify your Storia email"
                : "Reset your Storia password";

          const text = `Your verification code is: ${otp}`;
          const html = `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #111827; margin-bottom: 20px;">Storia</h2>
              <p style="color: #374151; margin-bottom: 20px;">Your verification code is:</p>
              <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
            </div>
          `;

          // Prefer Resend in production; fall back to SMTP (Mailpit) locally
          if (resend) {
            try {
              const result = await resend.emails.send({
                from: RESEND_FROM,
                to: email,
                subject,
                text,
                html,
              });
              if (result.error) {
                console.error("[auth] Resend send error:", result.error);
                throw new Error("Failed to send email");
              }
              return;
            } catch (err) {
              console.error("[auth] Resend send failed:", err);
              throw err;
            }
          }

          // SMTP fallback for local dev / testing
          try {
            await transporter.sendMail({
              from: smtpFrom,
              to: email,
              subject,
              text,
              html,
            });
            console.log(`[auth] OTP sent via SMTP to ${email}`);
          } catch (err) {
            console.error("[auth] SMTP send failed:", err);
            throw new Error("Email provider not configured");
          }
        },
        otpLength: 6,
        expiresIn: 300,
      }),
      nextCookies(),
      expo(),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });

  return authInstance;
}

export const getAuth = createAuth;

// For backwards compatibility - only use in runtime contexts
export const auth = {
  get api() {
    return createAuth().api;
  },
  get handler() {
    return createAuth().handler;
  },
};
