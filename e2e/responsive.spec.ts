import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resetDb, signInAdmin, signInAina } from "./helpers";

test.use({ reducedMotion: "reduce" });
test.describe.configure({ timeout: 240_000 });

const WIDTHS = [390, 834, 1440];

/** No sideways scrolling, the navigation can be reached, and axe finds nothing serious. */
async function check(page: Page, path: string, nav: "public" | "portal" | "none") {
  await page.goto(path, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

  const w = page.viewportSize()!.width;
  if (nav === "public") {
    if (w < 760) await expect(page.getByRole("button", { name: /^(Menu)$/ })).toBeVisible();
    else await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  } else if (nav === "portal") {
    if (w < 760) await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    else await expect(page.locator("aside.side nav")).toBeVisible();
  }

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${path}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

async function anyMatchId(page: Page): Promise<string> {
  const snap = await (await page.request.get("/api/live")).json();
  return snap.matches.find((m: { round: string; sport: { name: string } }) => m.round === "Final" && m.sport.name === "Football").id;
}

test.beforeEach(async ({ request }) => { await resetDb(request); });

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: width < 760 ? 844 : 900 } });

    test("public pages", async ({ page }) => {
      const id = await anyMatchId(page);
      for (const p of ["/", "/live", `/match/${id}`, "/standings", "/schedule", "/photos", "/venues"]) await check(page, p, "public");
      await check(page, "/staff/login", "none");
    });

    test("PIC pages", async ({ page }) => {
      const id = await anyMatchId(page);
      await signInAina(page);
      for (const p of ["/staff/pic", "/staff/pic/matches", `/staff/pic/score/${id}`, "/staff/pic/status", "/staff/pic/map", "/staff/pic/history", "/staff/pic/photos"]) await check(page, p, "portal");
    });

    test("Admin pages", async ({ page }) => {
      const id = await anyMatchId(page);
      await signInAdmin(page);
      const pages = ["", "/sports", "/teams", "/courts", "/matches", "/map", "/medals", "/pics", "/monitor", "/photos", "/announcements", "/settings", "/audit", "/backup", `/score/${id}`];
      for (const p of pages) await check(page, `/staff/admin${p}`, "portal");
    });
  });
}
