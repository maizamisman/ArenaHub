import { test, expect, type APIRequestContext } from "@playwright/test";
import { resetDb, signInAina } from "./helpers";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ request }) => { await resetDb(request); });

type Snap = { matches: { id: string; round: string; sport: { name: string }; team_a: { short_name: string } | null; team_b: { short_name: string } | null }[] };
async function findMatch(request: APIRequestContext, a: string, b: string, round: string): Promise<string> {
  const snap = (await (await request.get("/api/live")).json()) as Snap;
  const m = snap.matches.find((x) => x.team_a?.short_name === a && x.team_b?.short_name === b && x.round === round);
  if (!m) throw new Error(`no match ${a} v ${b}`);
  return m.id;
}

test("Aina signs in, changes her password and sees only her matches", async ({ page }) => {
  await signInAina(page);
  await page.goto("/staff/pic/matches");
  await expect(page.getByRole("heading", { name: "My Matches" })).toBeVisible();
  await expect(page.getByText("UM Laut vs UMT Laut").first()).toBeVisible();
  await expect(page.getByText("UiTM Laut vs UTM Laut")).toHaveCount(0);
});

test("opening another PIC's match by URL is refused", async ({ page, request }) => {
  const danials = await findMatch(request, "UiTM Laut", "UTM Laut", "Semi-final 2");
  await signInAina(page);
  await page.goto(`/staff/pic/score/${danials}`);
  await expect(page.getByText("You are not assigned to this match")).toBeVisible();
  await expect(page.getByRole("button", { name: /Plus 1/ })).toHaveCount(0);
});

test("tapping + shows on a second browser's public Live Score within 11 seconds", async ({ page, browser, request }) => {
  const m = await findMatch(request, "UM Laut", "UMT Laut", "Final");
  const spectator = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await spectator.goto("/live");
  const row = spectator.getByTestId("live-rows").getByRole("link").filter({ hasText: "UMT Laut" }).filter({ hasText: "Football" });
  await expect(row).toContainText("2-1");

  await signInAina(page);
  await page.goto(`/staff/pic/score/${m}`);
  await page.getByRole("button", { name: "Plus 1 for UM Laut" }).click();
  await expect(page.getByTestId("score-a")).toHaveText("3");

  await expect(row).toContainText("3-1", { timeout: 11_000 });
  await spectator.context().close();
});

test("ending a drawn knockout match asks for a winner", async ({ page, request }) => {
  const m = await findMatch(request, "UKM Laut", "USM Laut", "Third place");
  await signInAina(page);
  await page.goto(`/staff/pic/score/${m}`);
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByRole("button", { name: "End match" })).toBeVisible();
  await page.getByRole("button", { name: "End match" }).click();
  const dialog = page.getByRole("alertdialog", { name: "End this match?" });
  await expect(dialog).toContainText("draw");
  await dialog.getByRole("button", { name: "End match" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/winner/i);
  await dialog.getByLabel("Winner").selectOption({ label: "USM Laut" });
  await dialog.getByLabel("Reason").fill("Won on golden goal");
  await dialog.getByRole("button", { name: "End match" }).click();
  await expect(page.getByTestId("match-status")).toHaveText("Full Time");
});

test("undo restores the score", async ({ page, request }) => {
  const m = await findMatch(request, "UM Laut", "UMT Laut", "Final");
  await signInAina(page);
  await page.goto(`/staff/pic/score/${m}`);
  await page.getByRole("button", { name: "Plus 1 for UMT Laut" }).click();
  await expect(page.getByTestId("score-b")).toHaveText("2");
  await page.getByRole("button", { name: "Undo last" }).click();
  await expect(page.getByTestId("score-b")).toHaveText("1");
  await page.reload();
  await expect(page.getByTestId("score-b")).toHaveText("1");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("+ and − stay at least 84 px tall", async ({ page, request }) => {
    const m = await findMatch(request, "UM Laut", "UMT Laut", "Final");
    await signInAina(page);
    await page.goto(`/staff/pic/score/${m}`);
    for (const name of ["Plus 1 for UM Laut", "Minus 1 for UM Laut", "Plus 1 for UMT Laut", "Minus 1 for UMT Laut"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(84);
    }
  });
});
