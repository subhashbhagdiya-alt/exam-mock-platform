import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const baseURL = (process.env.E2E_BASE_URL || "https://exam-prep-direct-box.vercel.app").replace(/\/+$/, "");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});

test("production homepage renders in a mobile viewport", async ({ page }) => {
  const pageErrors = [];
  const consoleMessages = [];
  page.on("pageerror", error => pageErrors.push({
    message: error.message,
    stack: error.stack || ""
  }));
  page.on("console", message => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
        location: message.location()
      });
    }
  });

  const response = await page.goto(baseURL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  expect(response, "The homepage should return an HTTP response").not.toBeNull();
  expect(response.status(), "The homepage should load successfully").toBeLessThan(400);

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_200); // Allow the app's short intro animation to finish.

  const bodyText = (await page.locator("body").innerText()).trim();
  expect(bodyText.length, "The homepage should render visible content").toBeGreaterThan(40);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.documentWidth,
    "The page should not overflow horizontally on a mobile viewport"
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);

  // Keep actionable browser diagnostics even when the production build hides React's full hydration message.
  await page.screenshot({ path: "test-results/examprep-mobile-home.png", fullPage: true });
  const diagnostics = await page.evaluate(({ pageErrors, consoleMessages, bodyText }) => ({
    url: location.href,
    title: document.title,
    documentLanguage: document.documentElement.lang,
    viewport: { width: innerWidth, height: innerHeight },
    bodyText: bodyText.slice(0, 5000),
    mainText: (document.querySelector("main")?.innerText || "").slice(0, 5000),
    rootMarkup: (document.querySelector("main")?.innerHTML || document.body.innerHTML).slice(0, 12000),
    pageErrors,
    consoleMessages
  }), { pageErrors, consoleMessages, bodyText });
  await writeFile("test-results/hydration-diagnostics.json", JSON.stringify(diagnostics, null, 2));
  expect(
    pageErrors,
    `The page should not emit uncaught JavaScript errors: ${pageErrors.map(error => error.message).join(" | ")}`
  ).toEqual([]);
});

test("mock test API grades an attempt and keeps repeated submission idempotent", async ({ request }) => {
  const sessionResponse = await request.get(
    `${baseURL}/api/questions?exam=mpesb-police-constable-2026&limit=10`,
    { timeout: 30_000 }
  );
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();

  expect(session.data.length).toBe(10);
  expect(session.test_session_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(session.test_session_key).toMatch(/^[0-9a-f-]{36}$/i);
  for (const question of session.data) {
    expect(question).not.toHaveProperty("answer_index");
    expect(question).not.toHaveProperty("explanation_hi");
    expect(question).not.toHaveProperty("explanation_en");
  }

  const payload = {
    test_session_id: session.test_session_id,
    test_session_key: session.test_session_key,
    answers: {}
  };
  const firstResponse = await request.post(`${baseURL}/api/grade`, {
    data: payload,
    timeout: 30_000
  });
  expect(firstResponse.status()).toBe(200);
  const first = await firstResponse.json();
  expect(first.data.total_questions).toBe(10);
  expect(first.data.correct).toBe(0);
  expect(first.data.wrong).toBe(0);
  expect(first.data.unanswered).toBe(10);
  expect(first.data.score).toBe(0);
  expect(first.data.review).toHaveLength(10);

  const retryResponse = await request.post(`${baseURL}/api/grade`, {
    data: payload,
    timeout: 30_000
  });
  expect(retryResponse.status()).toBe(200);
  expect(await retryResponse.json()).toEqual(first);
});

test("question catalog supports normalized subject and topic filters", async ({ request }) => {
  const catalogResponse = await request.get(
    `${baseURL}/api/questions?exam=mpesb-police-constable-2026&limit=100&mode=availability`,
    { timeout: 30_000 }
  );
  expect(catalogResponse.status()).toBe(200);
  const catalog = await catalogResponse.json();

  expect(catalog.meta.available).toBeGreaterThan(0);
  expect(Array.isArray(catalog.meta.subjects)).toBe(true);
  expect(Array.isArray(catalog.meta.subject_topics)).toBe(true);

  const canonicalPairs = catalog.meta.subject_topics.map(item =>
    `${String(item.subject).trim().toLocaleLowerCase("en-US")}::${String(item.topic).trim().toLocaleLowerCase("en-US")}`
  );
  expect(
    new Set(canonicalPairs).size,
    "The catalog should not contain duplicated subject/topic pairs differing only by capitalization"
  ).toBe(canonicalPairs.length);

  const filteredResponse = await request.get(
    `${baseURL}/api/questions?exam=mpesb-police-constable-2026&limit=100&mode=availability&subject=mathematics&topic=PROFIT%20AND%20LOSS`,
    { timeout: 30_000 }
  );
  expect(filteredResponse.status()).toBe(200);
  const filtered = await filteredResponse.json();
  expect(
    filtered.meta.available,
    "Mixed-case subject/topic selections should return verified questions"
  ).toBeGreaterThan(0);
});
