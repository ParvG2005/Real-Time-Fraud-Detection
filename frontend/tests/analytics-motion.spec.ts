import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
const env = Object.fromEntries(
  fs
    .readFileSync("../.env", "utf8")
    .split("\n")
    .filter((x) => x && !x.startsWith("#"))
    .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
);
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(env.ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page
    .getByRole("heading", { name: "A clearer view of every risk." })
    .waitFor();
  const menu = page.getByRole("button", { name: "Toggle navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await page.locator(".intelligence-hero").waitFor();
}
async function caption(page: Page, text: string) {
  console.log(text);
  if (!process.env.HEADED) return;
  await page.evaluate((text) => {
    let el = document.getElementById("motion-test-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "motion-test-caption";
      el.style.cssText =
        "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;max-width:90vw;padding:13px 22px;border-radius:10px;background:#0b1529;color:#e3eeff;font:13px system-ui;text-align:center;box-shadow:0 6px 24px #0003;pointer-events:none";
      document.body.append(el);
    }
    el.textContent = "ANALYTICS TEST · " + text;
  }, text);
  await page.waitForTimeout(1600);
}

test("analytics motion: reveals, animated metrics and real-data chart controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await caption(page, "01 · Atmospheric hero and animated model metric");
  await expect(page.locator(".intelligence-hero")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.locator(".orbit-value")).toHaveCSS(
    "animation-name",
    "orbit-draw",
  );
  const token = await page.evaluate(() => sessionStorage.getItem("token"));
  await expect(page.locator(".hero-wave-blue")).toHaveCSS("animation-name", "wave-flow-blue");
  await expect(page.locator(".hero-wave-red")).toHaveCSS("animation-name", "wave-flow-red");
  const trendResponse = await page.request.get(
    "/api/v1/analytics/fraud-trends",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const days = await trendResponse.json();
  const metricsResponse = await page.request.get("/api/v1/analytics/model", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const metrics = await metricsResponse.json();
  await expect(page.locator(".orbit-number .count-up")).toHaveAttribute(
    "aria-label",
    metrics.training.pr_auc.toFixed(3),
  );
  await expect(page.locator("#feedback")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await page.evaluate(() =>
    document.getElementById("motion-test-caption")?.remove(),
  );
  await page.screenshot({ path: "../docs/analytics.png", fullPage: false });
  await page.getByRole("button", { name: "Explore the signals" }).click();
  await expect(page.locator("#activity")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await caption(
    page,
    "02 · Scroll reveal brings the transaction explorer into view",
  );
  await expect(page.getByTestId("activity-chart")).toHaveAttribute(
    "data-range",
    "7",
  );
  await page.getByRole("button", { name: "Last 3 days" }).click();
  await expect(page.getByTestId("activity-chart")).toHaveAttribute(
    "data-range",
    "3",
  );
  const expectedTotal = days
    .slice(-3)
    .reduce(
      (sum: number, d: { transactions: number }) => sum + d.transactions,
      0,
    );
  await expect(
    page.getByTestId("activity-total").locator(".count-up"),
  ).toHaveAttribute("aria-label", expectedTotal.toLocaleString("en-IN"));
  await caption(page, "03 · Three-day totals match the real API response");
  await page.getByRole("button", { name: "Decision mix", exact: true }).click();
  await expect(page.getByTestId("activity-chart")).toHaveAttribute(
    "data-mode",
    "decisions",
  );
  await expect(
    page.locator(".analytics-trend-chart .recharts-bar"),
  ).toHaveCount(3);
  await caption(page, "04 · Switch from volume to stacked decision outcomes");
  await page.getByRole("button", { name: "Volume", exact: true }).click();
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await page.locator("#patterns").scrollIntoViewIfNeeded();
  await expect(page.locator("#patterns")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await expect(page.getByTestId("breakdown-chart")).toHaveAttribute(
    "data-dimension",
    "transaction_type",
  );
  await caption(page, "05 · Explore patterns by transaction type");
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await expect(page.getByTestId("breakdown-chart")).toHaveAttribute(
    "data-dimension",
    "device_id",
  );
  await page.getByRole("button", { name: "Location", exact: true }).click();
  await expect(page.getByTestId("breakdown-chart")).toHaveAttribute(
    "data-dimension",
    "location",
  );
  await page
    .locator(".analytics-breakdown-chart .recharts-bar-rectangle")
    .first()
    .hover();
  await expect(
    page.locator(".analytics-breakdown-chart .recharts-tooltip-wrapper"),
  ).toBeVisible();
  await caption(page, "06 · Hover tooltips expose the underlying counts");
  await page.locator("#feedback").scrollIntoViewIfNeeded();
  await expect(page.locator("#feedback")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.locator("#feedback")).toHaveCSS("opacity", "1");
  await caption(
    page,
    "07 · Feedback matrix reveals selected human-review outcomes",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("fraudshield-analytics.json");
  const report = JSON.parse(fs.readFileSync((await file.path())!, "utf8"));
  expect(report.monitoring.training.pr_auc).toBe(metrics.training.pr_auc);
  expect(report.disclaimer).toContain("Synthetic");
  await caption(
    page,
    "08 · Export contains measured values and the synthetic-data disclosure",
  );
  expect(errors).toEqual([]);
});

test("analytics motion: mobile layout, jump links and responsive charts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await caption(page, "09 · Responsive analytics hero at 390 px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Explore the signals" }).click();
  await expect(page.locator("#activity")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await page.getByRole("button", { name: "Last 3 days" }).click();
  await expect(page.getByTestId("activity-chart")).toHaveAttribute(
    "data-range",
    "3",
  );
  await page.locator("#patterns").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await caption(
    page,
    "10 · Mobile chart controls remain usable without page overflow",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.locator("#feedback").scrollIntoViewIfNeeded();
  await expect(page.locator("#feedback")).toHaveCSS("opacity", "1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(() =>
    document.getElementById("motion-test-caption")?.remove(),
  );
  await page.screenshot({
    path: "../docs/analytics-mobile.png",
    fullPage: false,
  });
});

test("analytics motion: reduced-motion preference keeps all evidence visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await caption(
    page,
    "11 · Reduced-motion mode removes ambient and scroll animation",
  );
  await expect(page.locator(".hero-glow")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".orbit-value")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".hero-wave-blue")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".hero-wave-red")).toHaveCSS("animation-name", "none");
  await expect(page.locator("#feedback")).toHaveCSS("opacity", "1");
  await expect(page.locator("#feedback")).toHaveCSS("transform", "none");
  await page
    .getByRole("button", { name: "Human feedback", exact: false })
    .click();
  await expect(page.locator("#feedback")).toBeInViewport();
  await caption(
    page,
    "12 · Jump links and every data panel still work without motion",
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".recent-panel")).toHaveCSS("opacity", "1");
});
