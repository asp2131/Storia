import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

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
        const subject =
          type === "sign-in"
            ? "Your Storia sign-in code"
            : type === "email-verification"
              ? "Verify your Storia email"
              : "Reset your Storia password";

        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "noreply@storia.app",
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
