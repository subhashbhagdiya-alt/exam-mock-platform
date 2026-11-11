import assert from "node:assert/strict";
import {
  isMobileNavigationViewport,
  MOBILE_NAV_BREAKPOINT_PX,
  MOBILE_NAV_REVEAL_DELAY_MS,
} from "../lib/mobile-navigation.mjs";

assert.equal(MOBILE_NAV_BREAKPOINT_PX, 600);
assert.equal(MOBILE_NAV_REVEAL_DELAY_MS, 500);

for (const width of [320, 360, 375, 390, 420, 560, 600]) {
  assert.equal(isMobileNavigationViewport(width), true, `${width}px should use the mobile dock`);
}
for (const width of [601, 640, 768, 1024, 1365, 1920]) {
  assert.equal(isMobileNavigationViewport(width), false, `${width}px should not use the mobile dock`);
}
for (const width of [0, -1, NaN, Infinity, -Infinity]) {
  assert.equal(isMobileNavigationViewport(width), false, `${width} is not a valid mobile viewport width`);
}

console.log("Mobile navigation viewport and reveal-delay tests passed.");
