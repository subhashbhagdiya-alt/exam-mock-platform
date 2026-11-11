export const MOBILE_NAV_BREAKPOINT_PX = 600;
export const MOBILE_NAV_REVEAL_DELAY_MS = 500;

export function isMobileNavigationViewport(width) {
  return Number.isFinite(width) && width > 0 && width <= MOBILE_NAV_BREAKPOINT_PX;
}
