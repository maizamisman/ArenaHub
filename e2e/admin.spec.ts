import { test, expect } from "@playwright/test";
import { resetDb, signInAdmin, signInAina, totp } from "./helpers";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ request }) => { await resetDb(request); });

test("Admin signs in with a TOTP code from the seeded secret", async ({ page }) => {
  await signInAdmin(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Admin Portal").first()).toBeVisible();
});

test("a wrong TOTP code is refused", async ({ page }) => {
  await page.goto("/staff/login");
  await page.getByLabel("Email").fill("admin@arenahub.my");
  await page.getByLabel("Password").fill("ArenaHub-Admin-2027");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/staff/2fa");
  const wrong = String((Number(totp()) + 1) % 1_000_000).padStart(6, "0");
  await page.getByLabel("6-digit code").fill(wrong);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code is not right")).toBeVisible();
  // Without the code the Admin pages stay closed.
  await page.goto("/staff/admin");
  await page.waitForURL("**/staff/2fa");
});

test("Admin creates a match and assigns it to Aina, who then sees it", async ({ page, browser }) => {
  await signInAdmin(page);
  await page.goto("/staff/admin/matches");
  await page.getByRole("button", { name: "Add match" }).click();
  const dialog = page.getByRole("dialog", { name: "Add match" });
  await dialog.getByLabel("Sport").selectOption({ label: "Football" });
  await dialog.getByLabel("Round").fill("Exhibition");
  await dialog.getByLabel("Team A (optional)").selectOption({ label: "UMP Laut" });
  await dialog.getByLabel("Team B (optional)").selectOption({ label: "USM Laut" });
  await dialog.getByLabel("Court").selectOption({ label: "Main Field" });
  await dialog.getByLabel("Start").fill("2027-03-12T09:00");
  await dialog.getByLabel("Assign to PIC (optional)").selectOption({ label: "Aina Sofea" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Match saved" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "UMP Laut vs USM Laut" })).toContainText("Aina Sofea");

  const aina = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await signInAina(aina);
  await aina.goto("/staff/pic/matches");
  await expect(aina.getByText("UMP Laut vs USM Laut")).toBeVisible();
  await aina.context().close();
});

test("turning off Photo Share removes it from the public nav", async ({ page, browser }) => {
  const visitor = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await visitor.goto("/");
  await expect(visitor.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Photo Share" })).toBeVisible();

  await signInAdmin(page);
  await page.goto("/staff/admin/settings");
  const sections = page.locator("section", { has: page.getByRole("heading", { name: "Website sections" }) });
  await sections.getByLabel("Photo Share", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save sections" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Settings saved" })).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Live Score" })).toBeVisible();
  await expect(visitor.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Photo Share" })).toHaveCount(0);
  await visitor.goto("/photos");
  await expect(visitor.getByRole("heading", { name: "Not available right now" })).toBeVisible();
  await visitor.context().close();
});

test("the Audit Log lists Aina's score change with her name", async ({ page, browser, request }) => {
  const snap = await (await request.get("/api/live")).json();
  const final = snap.matches.find((m: { round: string; sport: { name: string } }) => m.round === "Final" && m.sport.name === "Football");
  const aina = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await signInAina(aina);
  await aina.goto(`/staff/pic/score/${final.id}`);
  await aina.getByRole("button", { name: "Plus 1 for UMT Laut" }).click();
  await expect(aina.getByTestId("score-b")).toHaveText("2");
  await aina.context().close();

  await signInAdmin(page);
  await page.goto("/staff/admin/audit");
  const row = page.getByRole("row").filter({ hasText: "Aina Sofea" }).filter({ hasText: "UM Laut vs UMT Laut" });
  await expect(row.first()).toContainText("updated UM Laut vs UMT Laut, Football to 2-2");
});
