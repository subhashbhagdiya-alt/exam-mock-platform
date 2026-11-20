"use client";

import { useEffect } from "react";
import { isMobileNavigationViewport, MOBILE_NAV_REVEAL_DELAY_MS } from "../lib/mobile-navigation.mjs";

// Hides the floating mobile dock while the page is scrolling and shows it again once
// scrolling has stopped. It listens in the capture phase on the document, so it also works
// when the scrolling happens inside an inner container instead of the window itself.
// The dock is hidden through a data attribute on <html> (see dock-autohide.css).
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
      const scroller = target === document || target === window
        ? (document.scrollingElement || root)
        : target;
      const top = scroller && typeof scroller.scrollTop === "number" ? scroller.scrollTop : 0;
      const previous = lastTop.has(scroller) ? lastTop.get(scroller) : 0;
      lastTop.set(scroller, top);
      // Ignore sideways scrolling (for example the subject chips) and no-op scroll events.
      if (top === previous) return;

      root.dataset.dockHidden = "1";
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(show, MOBILE_NAV_REVEAL_DELAY_MS);
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", show, { passive: true });
    window.addEventListener("orientationchange", show);
    window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", show);

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", show);
      window.removeEventListener("orientationchange", show);
      window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", show);
      show();
    };
  }, []);

  return null;
}
