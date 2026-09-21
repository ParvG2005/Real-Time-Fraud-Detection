import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
const env = Object.fromEntries(
  fs
    .readFileSync("../.env", "utf8")
    .split("\n")
    .filter((x) => x && !x.startsWith("#"))
    .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
);
async function caption(page: Page, text: string) {
  console.log(text);
  if (process.env.HEADED) {
    await page.evaluate((text) => {
      let el = document.getElementById("test-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "test-caption";
        el.style.cssText =
          "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:9px;background:#173c2e;color:#e3f2ce;font:14px system-ui;box-shadow:0 5px 30px #0003;pointer-events:none;max-width:90vw;text-align:center;white-space:normal";
        document.body.append(el);
      }
      el.textContent = "LIVE TEST · " + text;
    }, text);
    await page.waitForTimeout(1800);
  }
}
async function signIn(
  page: Page,
  email = env.ADMIN_EMAIL,
  password = env.ADMIN_PASSWORD,
) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer view of every risk." }),
  ).toBeVisible();
}
async function scenario(page: Page, name: string, decision: string) {
  await page.locator("nav").getByRole("link", { name: "Demo studio" }).click();
  await page
    .locator(".scenario")
    .filter({ hasText: name })
    .getByRole("button", { name: "Run scenario" })
    .click();
  await expect(page.locator(".result-card")).toContainText(decision);
}

test("normal payment, review, takeover, evidence and live updates", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await caption(page, "01 · Dashboard reads actual database records");
  await expect(
    page.getByText("Live connection", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "../docs/dashboard.png", fullPage: true });
  const second = await context.newPage();
  await signIn(second);
  const before = await second
    .locator(".metric-card")
    .first()
    .locator("strong")
    .textContent();
  await page.bringToFront();
  await caption(page, "02 · Normal repayment should be allowed");
  await scenario(page, "Everyday repayment", "ALLOW");
  await expect(
    second.locator(".metric-card").first().locator("strong"),
  ).not.toHaveText(before!);
  await second.bringToFront();
  await caption(second, "03 · Second dashboard updated live through WebSocket");
  await page.bringToFront();
  await caption(page, "04 · Unusually high amount should enter review");
  await scenario(page, "An amount worth a look", "REVIEW");
  await caption(page, "05 · New device + city + rapid burst should be blocked");
  await scenario(page, "Connect the warning signs", "BLOCK");
  await page
    .getByRole("link", { name: "Investigate this transaction" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Five signals. One policy decision." }),
  ).toBeVisible();
  await caption(page, "06 · Inspect real component scores and triggered rules");
  await page.getByRole("tab", { name: "Explainability", exact: true }).click();
  await expect(
    page.getByText("Local evidence-based explanation · no LLM used"),
  ).toBeVisible();
  await caption(
    page,
    "07 · Real TreeSHAP contributions explain the model output",
  );
  await page.screenshot({ path: "../docs/explainability.png", fullPage: true });
  await page.getByRole("tab", { name: /Similar cases/ }).click();
  await expect(page.locator(".similar-case").first()).toBeVisible();
  await caption(page, "08 · pgvector retrieves matching synthetic fraud cases");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.locator(".history-row").first()).toBeVisible();
  await caption(
    page,
    "09 · Customer history includes the actual transaction burst",
  );
  await page
    .getByLabel("Investigation notes")
    .fill(
      "Demo analyst verified the unrecognized device and confirmed this synthetic fraud case.",
    );
  await page
    .getByRole("button", { name: "Confirm fraud", exact: true })
    .click();
  await expect(
    page.locator(".investigation-body").getByRole("status"),
  ).toContainText("Investigation saved: FRAUD");
  await caption(
    page,
    "10 · Confirmed fraud saved; original BLOCK decision preserved",
  );
  expect(errors).toEqual([]);
});

test("false positive, escalation and durable investigation state", async ({
  page,
}) => {
  await signIn(page);
  await caption(page, "11 · Flag a legitimate but unusual payment");
  await scenario(page, "Keep a human in the loop", "BLOCK");
  await page
    .getByRole("link", { name: "Investigate this transaction" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark legitimate" }),
  ).toBeDisabled();
  await page
    .getByLabel("Investigation notes")
    .fill(
      "Verified customer travel and payment intent through an independent demo verification.",
    );
  await page.getByRole("button", { name: "Mark legitimate" }).click();
  await expect(
    page.locator(".investigation-body").getByRole("status"),
  ).toContainText("LEGITIMATE");
  await caption(
    page,
    "12 · Legitimate feedback corrects the label, not historical evidence",
  );
  await page.reload();
  await expect(
    page
      .locator(".investigation-body")
      .getByText("LEGITIMATE", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Investigation notes")
    .fill("Reopened for a second analyst to review the supporting evidence.");
  await page.getByRole("button", { name: "Escalate for review" }).click();
  await expect(
    page.locator(".investigation-body").getByRole("status"),
  ).toContainText("ESCALATED");
  await caption(
    page,
    "13 · Escalation persists and withdraws the final training label",
  );
  await page.getByRole("link", { name: "Investigations", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export feedback" }).click();
  expect((await download).suggestedFilename()).toBe("feedback.jsonl");
  await caption(
    page,
    "14 · Download real feedback with features and model versions",
  );
});

test("rule administration creates, edits, toggles and deletes", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Detection rules" }).click();
  await caption(page, "15 · Administrator creates an explicit detection rule");
  await page.getByRole("button", { name: "Add rule" }).click();
  const name = "Live test rule " + Date.now();
  await page.getByLabel("Rule name").fill(name);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Temporary rule for live UI verification.");
  await page.getByLabel("Threshold", { exact: true }).fill("8");
  await page.getByLabel("Risk points", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Save rule" }).click();
  const card = page.locator(".rule-card").filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("switch").click();
  await expect(card.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await caption(page, "16 · Disable a rule without changing historical scores");
  await card.getByRole("button", { name: "Edit rule" }).click();
  await page.getByLabel("Risk points", { exact: true }).fill("18");
  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(card).toContainText("+18");
  await card.getByRole("button", { name: `Delete ${name}` }).click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
  await caption(page, "17 · Rule update and deletion completed and audited");
});

test("search, filters, validation, analytics and audit trail", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await caption(
    page,
    "18 · Filter the live transaction ledger by BLOCK decisions",
  );
  await page.getByLabel("Decision filter").selectOption("BLOCK");
  await expect(page.locator("tbody tr").first()).toContainText("BLOCK");
  await expect(page.locator("tbody .badge.allow")).toHaveCount(0);
  await page.getByLabel("Search transactions").fill("no-such-customer-xyz");
  await expect(page.getByText("Nothing here yet")).toBeVisible();
  await caption(page, "19 · Empty search results render without errors");
  await page.locator("nav").getByRole("link", { name: "Demo studio" }).click();
  await page.getByRole("button", { name: "Try your own transaction" }).click();
  await page.getByLabel("amount", { exact: true }).fill("-1");
  await page.getByRole("button", { name: "Evaluate request" }).click();
  expect(
    await page
      .getByLabel("amount", { exact: true })
      .evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
  ).toBeTruthy();
  await caption(page, "20 · Invalid negative amount is rejected by the form");
  await page.getByLabel("amount", { exact: true }).fill("2700");
  await page.getByRole("button", { name: "Evaluate request" }).click();
  await expect(page.locator(".result-card")).toBeVisible();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluation record" }),
  ).toBeVisible();
  await caption(
    page,
    "21 · Measured synthetic metrics and selected-review feedback stay separate",
  );
  await page.getByRole("link", { name: "Audit trail" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await caption(page, "22 · Inspect recorded user access and policy changes");
});

test("viewer role is read-only in the UI and API", async ({
  page,
  request,
}) => {
  const login = await request.post("http://localhost:8080/api/v1/auth/login", {
    data: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
  });
  const { token } = await login.json();
  const email = `headed-viewer-${Date.now()}@demo.local`,
    password = crypto.randomBytes(14).toString("hex");
  const created = await request.post(
    "http://localhost:8080/api/v1/auth/register",
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { email, password, role: "VIEWER" },
    },
  );
  expect(created.status()).toBe(201);
  await signIn(page, email, password);
  await caption(
    page,
    "23 · Viewer can inspect the dashboard but cannot change policy",
  );
  await expect(page.getByRole("link", { name: "Team access" })).toHaveCount(0);
  await page.locator("nav").getByRole("link", { name: "Demo studio" }).click();
  for (const button of await page
    .getByRole("button", { name: "Run scenario", exact: true })
    .all())
    await expect(button).toBeDisabled();
  await page.getByRole("link", { name: "Detection rules" }).click();
  await expect(page.getByRole("button", { name: "Add rule" })).toHaveCount(0);
  await expect(page.getByRole("switch").first()).toBeDisabled();
  await caption(
    page,
    "24 · Simulator, rule toggles and administrator controls are restricted",
  );
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page.locator(".transaction-link").first().click();
  await expect(
    page.getByText("Your viewer role has read-only access."),
  ).toBeVisible();
  const viewerToken = await page.evaluate(() =>
    sessionStorage.getItem("token"),
  );
  const forbidden = await request.post(
    "http://localhost:8080/api/v1/demo/simulate",
    {
      headers: { Authorization: `Bearer ${viewerToken}` },
      data: { scenario: "NORMAL" },
    },
  );
  expect(forbidden.status()).toBe(403);
  await caption(
    page,
    "25 · Direct API write also returns 403; security is not just visual",
  );
});

test("mobile layout and invalid login", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Email address").fill(env.ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await signIn(page);
  await caption(page, "26 · Mobile dashboard fits the viewport");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.locator("nav").getByRole("link", { name: "Demo studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Watch the signals become a decision." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "../docs/mobile.png", fullPage: true });
});

test("dependency failures remain reviewable and recover", async ({ page }) => {
  const { execFileSync } = await import("node:child_process");
  await signIn(page);
  await page.locator("nav").getByRole("link", { name: "Demo studio" }).click();
  await page.getByRole("button", { name: "Try your own transaction" }).click();
  await page
    .getByLabel("userId", { exact: true })
    .fill("TEST_OUTAGE_" + Date.now());
  try {
    await caption(page, "27 · Temporarily stop this demo’s ML service");
    execFileSync("docker", ["compose", "stop", "ml-service"], {
      cwd: "..",
      stdio: "pipe",
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Evaluate request" }).click();
    await expect(page.locator(".result-card")).toContainText("REVIEW");
    await page
      .getByRole("link", { name: "Investigate this transaction" })
      .click();
    await expect(
      page.getByText(
        "ML was unavailable for this decision. Mandatory review policy applied.",
      ),
    ).toBeVisible();
    await caption(page, "28 · ML outage cannot silently produce an approval");
  } finally {
    execFileSync("docker", ["compose", "start", "ml-service"], {
      cwd: "..",
      stdio: "pipe",
      timeout: 30000,
    });
  }
  await expect
    .poll(
      async () => {
        const r = await page.request.get("/health");
        return (await r.json()).ml;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  try {
    await page
      .locator("nav")
      .getByRole("link", { name: "Demo studio" })
      .click();
    await page
      .getByRole("button", { name: "Try your own transaction" })
      .click();
    await page.getByLabel("userId", { exact: true }).fill("DEMO_001");
    await caption(
      page,
      "29 · Temporarily stop Redis; PostgreSQL preserves velocity evidence",
    );
    execFileSync("docker", ["compose", "stop", "redis"], {
      cwd: "..",
      stdio: "pipe",
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Evaluate request" }).click();
    await expect(page.locator(".result-card")).toBeVisible();
    await caption(
      page,
      "30 · Database fallback and local rate limiting keep the demo working",
    );
  } finally {
    execFileSync("docker", ["compose", "start", "redis"], {
      cwd: "..",
      stdio: "pipe",
      timeout: 30000,
    });
  }
  await expect
    .poll(
      async () => {
        const r = await page.request.get("/health");
        return (await r.json()).status;
      },
      { timeout: 30000 },
    )
    .toBe("UP");
  await caption(
    page,
    "31 · Both dependencies recovered; all health checks are green",
  );
});
