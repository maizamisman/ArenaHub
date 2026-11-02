import { test, expect } from "@playwright/test";
import path from "node:path";
import { resetDb } from "./helpers";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ request }) => { await resetDb(request); });

test("home shows hero and section links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Karnival Sukan KD Sri Klang 2027" })).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute("src", "/hero/arena-hero.mp4");
  const sections = page.getByRole("navigation", { name: "Sections" });
  for (const name of ["Live Score", "Standings", "Schedule", "Photo Share"]) {
    await expect(sections.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Staff sign in" })).toHaveAttribute("href", "/staff/login");
});

test("Live Score lists the seeded live matches", async ({ page }) => {
  await page.goto("/live");
  const rows = page.getByTestId("live-rows").getByRole("link");
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: "UM Laut" }).filter({ hasText: "UMT Laut" })).toContainText("2-1");
  await expect(rows.filter({ hasText: "Netball" })).toContainText("28-31");
});

test("switching to BM changes the nav labels", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Main" });
  await expect(main.getByRole("link", { name: /Live Score/ })).toBeVisible();
  await page.getByRole("button", { name: "BM" }).click();
  await expect(main.getByRole("link", { name: /Skor Langsung/ })).toBeVisible();
  await expect(main.getByRole("link", { name: "Kedudukan" })).toBeVisible();
  await page.reload();
  await expect(main.getByRole("link", { name: /Skor Langsung/ })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the hamburger opens and navigates to Schedule", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#ah-menu").getByRole("link", { name: "Schedule" }).click();
    await page.waitForURL("**/schedule");
    await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  });
});

test("the venue modal links to Google Maps with the court's coordinates", async ({ page }) => {
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Multipurpose Hall" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Multipurpose Hall" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("maps-link")).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=3.00121,101.39302");
});

test("uploading a sample photo with consent shows it on the wall", async ({ page }) => {
  await page.goto("/photos");
  await expect(page.getByText("8 photos")).toBeVisible();
  await page.getByRole("button", { name: "Share a moment" }).click();
  const dialog = page.getByRole("dialog", { name: "Share a moment" });
  await dialog.getByTestId("photo-input").setInputFiles(path.resolve(process.cwd(), "..", "mock image", "images (2).jpeg"));
  await dialog.getByLabel(/Description/).fill("Cheering from the stands");
  const post = dialog.getByRole("button", { name: "Post" });
  await expect(post).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await post.click();
  await expect(page.getByRole("status").filter({ hasText: "Posted" })).toBeVisible();
  await expect(page.getByText("9 photos")).toBeVisible();
  await expect(page.getByTestId("photo-wall").getByText("Cheering from the stands")).toBeVisible();
});
