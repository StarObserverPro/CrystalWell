/** v0.3 high-quality profile. Pixel/particle allocations are exactly 2x v0.2.
 * This is a resource allowance, not a claim that every device takes exactly 2x GPU time.
 * Keep the side view at its previous low refresh rate; do not silently downshift quality.
 */
export const QUALITY = Object.freeze({
  budgetMultiplier: 2, pixelRatioMultiplier: Math.SQRT2,
  desktopDpr: 1.65 * Math.SQRT2, touchDpr: 1.35 * Math.SQRT2,
  particles: 1040, reflectionWidth: 1024, reflectionHeight: 256,
  rimSegments: 128, rimJewels: 32,
  sideDesktopHz: 18, sideTouchHz: 14, maxBubbles: 8,
});
export function pixelRatio(deviceRatio = 1, touch = false) {
  return Math.min(Math.max(1, deviceRatio) * Math.SQRT2, touch ? QUALITY.touchDpr : QUALITY.desktopDpr);
}
export function sideTargetSize(width, height) {
  const base = Math.min(.85, 540 / width, 760 / height);
  return [Math.max(150, Math.round(width * base * Math.SQRT2)),
    Math.max(150, Math.round(height * base * Math.SQRT2))];
}
