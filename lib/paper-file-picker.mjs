/**
 * Open the native file picker from a direct user gesture.
 * showPicker() is preferred where supported; click() remains the compatibility fallback.
 */
export function openPaperFilePicker(input) {
  if (!input) return false;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return true;
    } catch {
      // Browsers may expose showPicker() but reject it in a particular context.
    }
  }

  if (typeof input.click === "function") {
    input.click();
    return true;
  }

  return false;
}
