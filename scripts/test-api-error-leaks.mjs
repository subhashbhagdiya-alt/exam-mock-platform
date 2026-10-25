import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeFiles = [
  "app/api/exams/route.js",
  "app/api/job-tracks/route.js",
  "app/api/questions/route.js",
  "app/api/results/route.js",
  "app/api/grade/route.js",
  "app/api/paper-analysis/route.js",
  "app/api/automation/bulk-questions/route.js",
  "app/api/automation/manager/route.js",
  "app/api/automation/sync/route.js",
  "app/api/automation/weekly-analysis/route.js",
  "app/api/automation/worker/route.js"
];
const rawResponseError = /\b(?:error|analysis_error)\s*:\s*(?:error|err|[A-Za-z_$][\w$]*Error)\??\.message\b/;
const conditionalRawResponseMessage = /\b(?:error|analysis_error)\s*:\s*[^,\n}]*\?\s*(?:message|(?:error|err|[A-Za-z_$][\w$]*Error)\??\.message)\s*:/;
for (const path of routeFiles) {
  const source = await readFile(path, "utf8");
  assert.doesNotMatch(source, conditionalRawResponseMessage, path + " must not return a raw error message through a conditional response");
  assert.doesNotMatch(source, rawResponseError, path + " must not expose raw error.message in response fields");
}
console.log("API error leak guard passed for " + routeFiles.length + " API routes.");
