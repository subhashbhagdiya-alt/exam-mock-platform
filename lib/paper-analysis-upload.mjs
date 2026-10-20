export const MAX_PAPER_FILE_BYTES = 4 * 1024 * 1024;

export const SUPPORTED_PAPER_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MIME_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
});

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-unknown-content-type"
]);

export function resolvePaperMimeType(fileName, mimeType = "") {
  const normalizedMime = String(mimeType || "").trim().toLowerCase().split(";")[0];
  if (SUPPORTED_PAPER_MIME_TYPES.includes(normalizedMime)) return normalizedMime;

  // Android document pickers and some browsers report unknown files as octet-stream.
  // Extension is only a UI hint; the API always verifies the file's actual signature.
  if (!GENERIC_MIME_TYPES.has(normalizedMime)) return "";
  const extension = String(fileName || "").trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  return MIME_BY_EXTENSION[extension] || "";
}

export function isSupportedPaperFile(fileName, mimeType = "") {
  return Boolean(resolvePaperMimeType(fileName, mimeType));
}

export function detectPaperMimeType(input) {
  if (!input || typeof input.length !== "number") return "";
  const bytes = input;
  const ascii = (start, end) => {
    let text = "";
    for (let index = start; index < end && index < bytes.length; index += 1) {
      text += String.fromCharCode(bytes[index]);
    }
    return text;
  };

  if (bytes.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 &&
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
      bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return "";
}
