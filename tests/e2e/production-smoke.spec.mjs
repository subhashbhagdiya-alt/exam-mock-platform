import { test, expect } from "@playwright/test";

const baseURL = (process.env.E2E_BASE_URL || "https://exam-prep-direct-box.vercel.app").replace(/\/+$/, "");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});

test("production homepage renders in a mobile viewport", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

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

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.documentWidth,
    "The page should not overflow horizontally on a mobile viewport"
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);

  expect(pageErrors, "The page should not emit uncaught JavaScript errors").toEqual([]);
  await page.screenshot({ path: "test-results/examprep-mobile-home.png", fullPage: true });
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
