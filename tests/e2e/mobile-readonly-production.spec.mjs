import { test, expect } from "@playwright/test";

const baseURL = (process.env.E2E_BASE_URL || "https://exam-prep-direct-box.vercel.app").replace(/\/+$/, "");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("read-only production mobile smoke: tracks, navigation, and paper picker", async ({ page }) => {
  test.setTimeout(90_000);

  const paperAnalysisPosts = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/paper-analysis"
    ) {
      paperAnalysisPosts.push(request.url());
    }
  });

  const response = await page.goto(baseURL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  expect(response, "Production homepage should return an HTTP response").not.toBeNull();
  expect(response.status(), "Production homepage should load successfully").toBeLessThan(400);

  await expect(page.getByText("Exam Boards", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".exam-board-tabs")).toBeVisible();

  // Verify the live production catalog through its public read-only API.
  const catalogResponse = await page.request.get(`${baseURL}/api/job-tracks`);
  expect(catalogResponse.status()).toBe(200);
  const catalog = await catalogResponse.json();
  const tracks = catalog.data || [];
  const mpesb = tracks.find((track) => track.slug === "mpesb-general-practice");
  const ssc = tracks.find((track) => track.slug === "ssc-general-practice");

  expect(mpesb, "MPESB General Practice should exist in the live catalog").toBeTruthy();
  expect(mpesb.question_bank_ready).toBe(true);
  expect(Number(mpesb.verified_question_count)).toBeGreaterThanOrEqual(Number(mpesb.required_question_count));
  expect(ssc, "SSC General Practice should exist in the live catalog").toBeTruthy();
  expect(ssc.question_bank_ready).toBe(true);
  expect(Number(ssc.verified_question_count)).toBeGreaterThanOrEqual(Number(ssc.required_question_count));

  await expect(page.getByText("MPESB General Practice", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/READY|अभी उपलब्ध/).first()).toBeVisible();

  await page.getByRole("tab", { name: /SSC/ }).click();
  await expect(page.getByText("SSC General Practice", { exact: true })).toBeVisible();

  // Check the page fits a 390px viewport without horizontal document overflow.
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
  }));
  expect(
    dimensions.documentWidth,
    "The production page should not overflow horizontally on a 390px mobile viewport",
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  expect(dimensions.documentHeight).toBeGreaterThan(844);

  // Verify the floating dock hides during scroll and returns after the idle delay.
  const dock = page.locator(".mobile-bottom-navigation-wrap");
  await expect(dock).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(dock).toHaveClass(/mobile-bottom-navigation-hidden/, { timeout: 2_000 });
  await expect(dock).not.toHaveClass(/mobile-bottom-navigation-hidden/, { timeout: 2_000 });

  // Open the analyzer through the mobile menu. Do not sign in or submit/upload anything.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId("mobile-menu-toggle").click();
  await page.getByTestId("sidebar-paper-analyzer").click();
  await expect(page.getByTestId("paper-analyzer-title")).toBeVisible();

  const fileInput = page.locator('input[type="file"].paper-file-input');
  await expect(fileInput).toBeAttached();
  const accept = await fileInput.getAttribute("accept");
  expect(accept).toContain(".pdf");
  expect(accept).toContain(".jpg");
  expect(accept).toContain(".png");
  expect(accept).toContain(".webp");
  await expect(page.getByText(/PDF, JPG, PNG, or WEBP · 3 MB maximum/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Analyze & Generate MCQs/i })).toBeDisabled();

  // Exercise the actual native picker entry point and local validation only.
  const chooseFile = async (file) => {
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Browse files|Change file/i }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(file);
  };

  await chooseFile({
    name: "qa-mobile-sample.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\\nRead-only mobile picker check\\n"),
  });
  await expect(page.locator(".paper-file-selected")).toContainText("qa-mobile-sample.pdf");

  await chooseFile({
    name: "unsupported-mobile.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a paper"),
  });
  await expect(page.locator(".paper-analysis-error")).toContainText(/PDF, JPG, PNG or WEBP/i);
  await expect(page.locator(".paper-file-selected")).toHaveCount(0);

  await chooseFile({
    name: "oversized-mobile.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(3 * 1024 * 1024 + 1, 65),
  });
  await expect(page.locator(".paper-analysis-error")).toContainText(/3 MB/i);
  await expect(page.locator(".paper-file-selected")).toHaveCount(0);

  expect(paperAnalysisPosts, "The read-only QA must never submit or upload a paper").toHaveLength(0);
});
