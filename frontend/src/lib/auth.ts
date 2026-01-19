import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { Resend } from "resend";

const RESEND_KEY = process.env.RESEND_API_KEY || "";
// Use a safe default sender if a verified domain isn't set up yet
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || "Storia <onboarding@resend.dev>";

const resend =
  RESEND_KEY && RESEND_KEY.startsWith("re_") ? new Resend(RESEND_KEY) : null;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false, // We're using email OTP only
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
        if (!resend) {
          console.error(
            "[auth] RESEND_API_KEY not configured (must start with 're_'). Set RESEND_API_KEY and RESEND_FROM_EMAIL to send OTP emails."
          );
          throw new Error("Email provider not configured");
        }
        const subject =
          type === "sign-in"
            ? "Your Storia sign-in code"
            : type === "email-verification"
              ? "Verify your Storia email"
              : "Reset your Storia password";

        try {
          const result = await resend.emails.send({
            from: RESEND_FROM,
            to: email,
            subject,
            text: `Your verification code is: ${otp}`,
            html: `
              <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #111827; margin-bottom: 20px;">Storia</h2>
                <p style="color: #374151; margin-bottom: 20px;">Your verification code is:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
              </div>
            `,
          });
          if (result.error) {
            console.error("[auth] Resend send error:", result.error);
            throw new Error("Failed to send email");
          }
        } catch (err) {
          console.error("[auth] Resend send failed:", err);
          throw err;
        }
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
    }),
    nextCookies(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
