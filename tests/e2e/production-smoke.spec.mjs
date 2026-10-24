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
  await expect(page.locator("html")).toHaveAttribute("lang", /^(en|hi)$/);
  await expect(page.getByText("Exam Boards", { exact: true }).first()).toBeVisible();
  // Keep both a readable first-screen capture and a complete-page diagnostic.
  await page.screenshot({ path: "test-results/examprep-mobile-home-viewport.png" });
  await page.screenshot({ path: "test-results/examprep-mobile-home.png", fullPage: true });

  // Exercise the visible mobile drawer, its quick settings, Escape dismissal, and Account navigation.
  const mobileMenuToggle = page.getByTestId("mobile-nav-toggle");
  await mobileMenuToggle.click();
  await expect(mobileMenuToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sidebar.mobile-menu-open")).toBeVisible();
  await page.locator(".sidebar.mobile-menu-open").getByRole("button", { name: /Language & appearance/i }).click();
  await expect(page.locator(".mobile-menu-utilities-panel")).toBeVisible();
  await expect(page.locator(".mobile-menu-theme-row button")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar.mobile-menu-open")).toHaveCount(0);
  await expect(mobileMenuToggle).toHaveAttribute("aria-expanded", "false");
  await mobileMenuToggle.click();
  await page.locator(".sidebar.mobile-menu-open").getByTestId("mobile-nav-login").click();
  await expect(page.getByTestId("login-email-input")).toBeVisible();
  await page.getByTestId("login-method-phone").click();
  await expect(page.getByPlaceholder("10 अंकों का मोबाइल नंबर")).toBeVisible();
  await page.getByTestId("login-method-email").click();
  await expect(page.getByTestId("login-email-input")).toBeVisible();

  const loginIcon = page.locator(".login-content .login-icon");
  await expect(loginIcon).toBeVisible();
  const loginIconStyles = await loginIcon.evaluate((element) => ({
    boxShadow: getComputedStyle(element).boxShadow,
    topHighlight: getComputedStyle(element, "::before").backgroundImage,
    svgFilter: getComputedStyle(element.querySelector("svg")).filter
  }));
  expect(loginIconStyles.boxShadow).toContain("0px 7px 14px");
  expect(loginIconStyles.topHighlight).toContain("linear-gradient");
  expect(loginIconStyles.svgFilter).toContain("drop-shadow");
  await page.screenshot({ path: "test-results/examprep-mobile-login-viewport.png" });

  // The paper analyzer should be discoverable on mobile and gated behind account login.
  await mobileMenuToggle.click();
  await expect(mobileMenuToggle).toHaveAttribute("aria-expanded", "true");
  await page.locator(".sidebar.mobile-menu-open").getByTestId("mobile-nav-paper-analyzer").click();
  await expect(page.getByTestId("paper-analyzer-title")).toBeVisible();
  const analyzerIcon = page.locator(".paper-analyzer-content .paper-analyzer-icon");
  const uploadIcon = page.locator(".paper-analyzer-content .paper-upload-icon");
  await expect(analyzerIcon).toBeVisible();
  await expect(uploadIcon).toBeVisible();
  for (const iconLocator of [analyzerIcon, uploadIcon]) {
    const iconStyles = await iconLocator.evaluate((element) => ({
      boxShadow: getComputedStyle(element).boxShadow,
      topHighlight: getComputedStyle(element, "::before").backgroundImage,
      svgFilter: getComputedStyle(element.querySelector("svg")).filter
    }));
    expect(iconStyles.boxShadow).toContain("0px 7px 14px");
    expect(iconStyles.topHighlight).toContain("linear-gradient");
    expect(iconStyles.svgFilter).toContain("drop-shadow");
  }
  await page.screenshot({ path: "test-results/examprep-mobile-paper-analyzer-viewport.png" });
  await expect(page.locator('input[type="file"][accept*=".pdf"]')).toBeAttached();
  await expect(page.getByRole("button", { name: /Analyze & Generate MCQs/i })).toBeDisabled();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.documentWidth,
    "The page should not overflow horizontally on a mobile viewport"
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);

  // Keep actionable diagnostics when the production build hides React's full hydration message.
  await page.screenshot({ path: "test-results/examprep-mobile-paper-analyzer.png", fullPage: true });
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
  test.skip(process.env.E2E_SKIP_PRIVILEGED_API_TESTS === "true", "Preview does not have a dedicated non-production question-bank credential.");
  const sessionResponse = await request.get(`${baseURL}/api/questions?exam=mpesb-police-constable-2026&limit=10`, { timeout: 30_000 });
  const sessionText = await sessionResponse.text();
  expect(sessionResponse.status(), `Question session API response: ${sessionText}`).toBe(200);
  const session = JSON.parse(sessionText);

  expect(session.data).toHaveLength(10);
  expect(session.test_session_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(session.test_session_key).toMatch(/^[0-9a-f-]{36}$/i);
  for (const question of session.data) {
    expect(question).not.toHaveProperty("answer_index");
    expect(question).not.toHaveProperty("explanation_hi");
    expect(question).not.toHaveProperty("explanation_en");
  }

  const payload = { test_session_id: session.test_session_id, test_session_key: session.test_session_key, answers: {} };
  const firstResponse = await request.post(`${baseURL}/api/grade`, { data: payload, timeout: 30_000 });
  const firstText = await firstResponse.text();
  expect(firstResponse.status(), `First grading response: ${firstText}`).toBe(200);
  const first = JSON.parse(firstText);
  expect(first.data.total_questions).toBe(10);
  expect(first.data.correct).toBe(0);
  expect(first.data.wrong).toBe(0);
  expect(first.data.unanswered).toBe(10);
  expect(first.data.score).toBe(0);
  expect(first.data.review).toHaveLength(10);

  const retryResponse = await request.post(`${baseURL}/api/grade`, { data: payload, timeout: 30_000 });
  const retryText = await retryResponse.text();
  expect(retryResponse.status(), `Retry grading response: ${retryText}`).toBe(200);
  expect(JSON.parse(retryText)).toEqual(first);
});

test("question catalog supports normalized subject and topic filters", async ({ request }) => {
  test.skip(process.env.E2E_SKIP_PRIVILEGED_API_TESTS === "true", "Preview does not have a dedicated non-production question-bank credential.");
  const catalogResponse = await request.get(
    `${baseURL}/api/questions?exam=mpesb-police-constable-2026&limit=100&mode=availability`,
    { timeout: 30_000 }
  );
  const catalogText = await catalogResponse.text();
  expect(catalogResponse.status(), `Catalog API response: ${catalogText}`).toBe(200);
  const catalog = JSON.parse(catalogText);

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
  const filteredText = await filteredResponse.text();
  expect(filteredResponse.status(), `Filtered catalog API response: ${filteredText}`).toBe(200);
  const filtered = JSON.parse(filteredText);
  expect(
    filtered.meta.available,
    "Mixed-case subject/topic selections should return verified questions"
  ).toBeGreaterThan(0);
});


test("grading API rejects a session that does not exist", async ({ request }) => {
  test.skip(process.env.E2E_SKIP_PRIVILEGED_API_TESTS === "true", "Preview does not have a dedicated non-production question-bank credential.");
  // A valid-format but nonexistent session makes the RPC return before any database write.
  const response = await request.post(`${baseURL}/api/grade`, {
    data: {
      test_session_id: "00000000-0000-4000-8000-000000000001",
      test_session_key: "00000000-0000-4000-8000-000000000002",
      answers: {}
    },
    timeout: 30_000
  });

  const responseText = await response.text();
  expect(response.status(), `Grading API response: ${responseText}`).toBe(409);
  const payload = JSON.parse(responseText);
  expect(payload.error).toMatch(/test session not found/i);
});


test("paper analysis endpoint requires an authenticated session", async ({ request }) => {
  const response = await request.post(`${baseURL}/api/paper-analysis`, {
    data: { fileName: "sample.pdf", mimeType: "application/pdf", fileBase64: "JVBERi0xLjQ=" },
    timeout: 30_000
  });
  expect(response.status(), "Paper analysis must not run for an anonymous request").toBe(401);
  expect((await response.json()).error).toMatch(/sign in/i);
});


test("result history and cloud save require an authenticated user", async ({ request }) => {
  // A syntactically valid session key is enough to exercise the auth guard; these calls do not write data.
  const sessionKey = "00000000-0000-4000-8000-000000000011";
  const historyResponse = await request.get(
    `${baseURL}/api/results?session_key=${encodeURIComponent(sessionKey)}`,
    { timeout: 30_000 }
  );
  expect(historyResponse.status()).toBe(401);
  expect((await historyResponse.json()).error).toMatch(/login required/i);

  const saveResponse = await request.post(`${baseURL}/api/results`, {
    data: { session_key: sessionKey },
    timeout: 30_000
  });
  expect(saveResponse.status()).toBe(401);
  expect((await saveResponse.json()).error).toMatch(/login required/i);
});


test("background manager endpoints reject unauthenticated requests", async ({ request }) => {
  for (const endpoint of [
    "/api/automation/sync",
    "/api/automation/manager",
    "/api/automation/worker"
  ]) {
    const response = await request.get(`${baseURL}${endpoint}`, { timeout: 30_000 });
    expect(response.status(), `${endpoint} must require the cron secret`).toBe(401);
  }
});
