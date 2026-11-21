"use client";

import { useEffect } from "react";
import { isMobileNavigationViewport, MOBILE_NAV_REVEAL_DELAY_MS } from "../lib/mobile-navigation.mjs";

// Hides the floating mobile dock while the page is scrolling and shows it again once
// scrolling has stopped. It is also always visible at the very top of the page.
// It listens in the capture phase on the document, so it also works when the scrolling
// happens inside an inner container instead of the window itself.
// The dock is hidden through a data attribute on <html> (see dock-autohide.css), which is
// the single source of truth for the dock's visibility.
const TOP_OFFSET_PX = 2;

export default function DockAutoHide() {
  useEffect(() => {
    const root = document.documentElement;
    const lastTop = new WeakMap();
    let timer = null;

    const show = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      delete root.dataset.dockHidden;
    };

    const onScroll = (event) => {
      if (!isMobileNavigationViewport(window.innerWidth)) {
        show();
        return;
      }
      const target = event.target;
      const pageScroller = document.scrollingElement || root;
      const scroller = target === document || target === window ? pageScroller : target;
      const top = scroller && typeof scroller.scrollTop === "number" ? scroller.scrollTop : 0;
      const previous = lastTop.has(scroller) ? lastTop.get(scroller) : 0;
      lastTop.set(scroller, top);

      // Back at the top of the page: always show the dock straight away.
      if (scroller === pageScroller && top <= TOP_OFFSET_PX) {
        show();
        return;
      }
      // Ignore sideways scrolling (for example the subject chips) and no-op scroll events.
      if (top === previous) return;

      root.dataset.dockHidden = "1";
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(show, MOBILE_NAV_REVEAL_DELAY_MS);
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    // Browsers that support it tell us exactly when scrolling (and momentum) has finished.
    document.addEventListener("scrollend", show, { capture: true, passive: true });
    window.addEventListener("resize", show, { passive: true });
    window.addEventListener("orientationchange", show);
    window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", show);

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("scrollend", show, { capture: true });
      window.removeEventListener("resize", show);
      window.removeEventListener("orientationchange", show);
      window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", show);
      show();
    };
  }, []);

  return null;
}
