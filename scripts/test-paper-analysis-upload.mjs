import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MAX_PAPER_FILE_BYTES,
  detectPaperMimeType,
  isSupportedPaperFile,
  resolvePaperMimeType
} from "../lib/paper-analysis-upload.mjs";

assert.equal(MAX_PAPER_FILE_BYTES, 4 * 1024 * 1024);

// Guard the multipart-to-Gemini handoff: a previous refactor left an undefined base64 variable.
const paperAnalysisRoute = await readFile(new URL("../app/api/paper-analysis/route.js", import.meta.url), "utf8");
assert.match(paperAnalysisRoute, /request\.formData\(\)/);
assert.match(paperAnalysisRoute, /form\.get\("file"\)/);
assert.match(paperAnalysisRoute, /data: buffer\.toString\("base64"\)/);
assert.doesNotMatch(paperAnalysisRoute, /data:\s*encoded\b/);

// Browser-reported MIME types work as usual.
assert.equal(resolvePaperMimeType("exam.pdf", "application/pdf"), "application/pdf");
assert.equal(resolvePaperMimeType("photo.jpg", "image/jpeg"), "image/jpeg");
assert.equal(isSupportedPaperFile("scan.png", "image/png"), true);

// Android/file-manager pickers often report octet-stream or no MIME type.
// The file extension enables selection; the API still checks the magic bytes.
assert.equal(resolvePaperMimeType("previous-paper.PDF", "application/octet-stream"), "application/pdf");
assert.equal(resolvePaperMimeType("photo.JPEG", ""), "image/jpeg");
assert.equal(resolvePaperMimeType("paper.webp", "binary/octet-stream"), "image/webp");
assert.equal(isSupportedPaperFile("paper.pdf", "application/octet-stream"), true);

// Unsupported types or contradictory, non-generic MIME metadata fail closed in the UI.
assert.equal(isSupportedPaperFile("notes.txt", "application/octet-stream"), false);
assert.equal(isSupportedPaperFile("notes.pdf", "text/plain"), false);
assert.equal(isSupportedPaperFile("image.gif", "image/gif"), false);

assert.equal(detectPaperMimeType(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
assert.equal(detectPaperMimeType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])), "image/png");
assert.equal(detectPaperMimeType(new Uint8Array([255, 216, 255, 224, 0])), "image/jpeg");
assert.equal(detectPaperMimeType(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32])), "image/webp");
assert.equal(detectPaperMimeType(new TextEncoder().encode("not a paper")), "");
assert.equal(detectPaperMimeType(null), "");

console.log("Paper upload type detection tests passed.");
