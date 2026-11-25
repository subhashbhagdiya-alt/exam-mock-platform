"use client";

import { useEffect } from "react";

// The "Start mock test" card lives inside the collapsible "Dashboard options" panel, and that panel is
// closed by default (showDashboardOptions starts as false in page.jsx), so the home screen had no visible
// way to start a test. On phones, open the panel once per page load; after that the user's own
// Show/Hide choice is respected. Once page.jsx starts with the panel open, delete this component.
export default function HomeEnhance() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") return undefined;
    let done = false;
    const observer = new MutationObserver(() => tryOpen());

    function tryOpen() {
      if (done) return;
      const toggle = document.querySelector(".dashboard-options-toggle");
      if (!toggle) return;
      done = true;
      observer.disconnect();
      if (window.matchMedia("(max-width: 760px)").matches && toggle.getAttribute("aria-expanded") === "false") {
        toggle.click();
      }
    }

    observer.observe(document.body, { childList: true, subtree: true });
    tryOpen();
    return () => observer.disconnect();
  }, []);

  return null;
}
