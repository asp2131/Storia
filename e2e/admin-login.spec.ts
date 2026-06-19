/**
 * Admin login E2E tests.
 *
 * Prereqs:
 *   - Local DB migrated and running (localhost:5433)
 *   - Next.js dev server running (or PLAYWRIGHT_BASE_URL set)
 *   - Mailpit running on localhost:8025 (catches OTP emails)
 *
 * Videos are recorded on test failure.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { getLatestOtp } from "./helpers/mailpit";
import { setUserRole, deleteUserByEmail } from "./helpers/db";

const APP_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.use({ video: "on-first-retry" });

/**
 * Signs an existing user in as admin via API and injects the session
 * cookie into the Playwright page context.
 *
 * Uses the `request` fixture for API calls (handles cookies/session
 * independently) then copies the cookie to the browser context.
 */
async function signInAsAdmin(
  page: Page,
  email: string,
  request: APIRequestContext
): Promise<void> {
  await setUserRole(email, "admin");

  // 1. Send OTP via API
  await request.post(`${APP_URL}/api/auth/email-otp/send-verification-otp`, {
    data: { email, type: "sign-in" },
  });

  // 2. Poll Mailpit for the OTP
  const otp = await getLatestOtp(email);
  expect(otp).toBeTruthy();
  expect(otp).toMatch(/^\d{6}$/);

  // 3. Sign in via API — `request` handles cookies automatically
  const signInResp = await request.post(
    `${APP_URL}/api/auth/sign-in/email-otp`,
    { data: { email, otp } }
  );

  expect(signInResp.ok()).toBe(true);

  // 4. `request` now has the session cookie — share it with the browser context
  const requestCookies = await request.storageState();
  const browserContext = page.context();

  for (const cookie of requestCookies.cookies) {
    if (cookie.name === "better-auth.session_token") {
      await browserContext.addCookies([
        {
          name: cookie.name,
          value: cookie.value,
          domain: "localhost",
          path: cookie.path ?? "/",
          httpOnly: cookie.httpOnly,
          sameSite: "Lax" as const,
        },
      ]);
    }
  }

  // 5. Verify session is accessible from the browser
  const sessionResp = await page.evaluate(async (url) => {
    const res = await fetch(`${url}/api/auth/get-session`, {
      credentials: "include",
    });
    return res.json();
  }, APP_URL);

  expect(sessionResp.user?.role).toBe("admin");
}

test.describe("Admin Login", () => {
  test("admin can sign in with email OTP and reach the dashboard", async ({
    page,
    request,
  }) => {
    const adminEmail = `e2e-admin-${Date.now()}@storia.local`;

    // Step 1: create user + get OTP → rejected (role=user by default)
    await page.goto(`${APP_URL}/admin/login`);
    await expect(
      page.getByRole("heading", { name: /Loratone Admin/i })
    ).toBeVisible();

    await page.getByPlaceholder(/you@loratone\.kids/i).fill(adminEmail);
    await page.getByRole("button", { name: /Send Verification Code/i }).click();

    const otp1 = await getLatestOtp(adminEmail);
    expect(otp1).toBeTruthy();

    await page.getByPlaceholder(/000000/i).fill(otp1!);
    await page.getByRole("button", { name: /Verify & Sign In/i }).click();

    await expect(
      page.getByText(/This account is not an admin/i)
    ).toBeVisible();

    // Step 2: promote via DB, then sign in via API and copy cookie to browser
    await signInAsAdmin(page, adminEmail, request);

    // Step 3: reload → layout guard sees admin role → lands on /admin
    await page.reload();
    await expect(page).toHaveURL(`${APP_URL}/admin`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await deleteUserByEmail(adminEmail);
  });

  test("non-admin user is rejected and shown an error", async ({ page }) => {
    const nonAdminEmail = `nonadmin_${Date.now()}@storia.local`;

    await page.goto(`${APP_URL}/admin/login`);
    await page.getByPlaceholder(/you@loratone\.kids/i).fill(nonAdminEmail);
    await page.getByRole("button", { name: /Send Verification Code/i }).click();

    const otp = await getLatestOtp(nonAdminEmail);
    expect(otp).toBeTruthy();

    await page.getByPlaceholder(/000000/i).fill(otp!);
    await page.getByRole("button", { name: /Verify & Sign In/i }).click();

    await expect(
      page.getByText(/This account is not an admin/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);

    await deleteUserByEmail(nonAdminEmail);
  });
});
