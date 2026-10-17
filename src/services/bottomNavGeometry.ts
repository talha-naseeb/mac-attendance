/**
 * Option A: Smooth Bezier Cradle Bottom Navigation Bar Geometry
 * Computes responsive SVG path and safe-area flush dimensions so the bar
 * attaches flush to the very bottom of the screen (zero bottom shadow/gap)
 * while dipping smoothly under the center floating '+' button.
 */

export interface BezierCradleGeometry {
  width: number;
  barContentHeight: number;
  safeBottomInset: number;
  totalHeight: number;
  centerX: number;
  cradleHalfWidth: number;
  cradleDepth: number;
  cornerRadius: number;
  fillPath: string;
  topStrokePath: string;
}

export const DEFAULT_BAR_CONTENT_HEIGHT = 64;
export const DEFAULT_CRADLE_HALF_WIDTH = 58;
export const DEFAULT_CRADLE_DEPTH = 36;
export const DEFAULT_CORNER_RADIUS = 16;

/**
 * Generates the SVG paths for Option A (Smooth Bezier Cradle):
 * 1. `fillPath`: Closed shape extending all the way down to `totalHeight` (bar + safeBottomInset)
 *    so the bottom edge is 100% flush with the screen bottom.
 * 2. `topStrokePath`: Only strokes the top contour and the Smooth S-curve Bezier wave
 *    so there is never a border or shadow along the bottom or side edges.
 */
export function buildSmoothBezierCradleGeometry(params: {
  width: number;
  safeBottomInset?: number;
  barContentHeight?: number;
  cradleHalfWidth?: number;
  cradleDepth?: number;
  cornerRadius?: number;
}): BezierCradleGeometry {
  const width = Math.max(280, Math.round(params.width));
  const safeBottomInset = Math.max(0, Math.round(params.safeBottomInset ?? 0));
  const barContentHeight =
    params.barContentHeight ?? DEFAULT_BAR_CONTENT_HEIGHT;
  const totalHeight = barContentHeight + safeBottomInset;

  const centerX = Math.round(width / 2);
  const cradleHalfWidth = params.cradleHalfWidth ?? DEFAULT_CRADLE_HALF_WIDTH;
  const cradleDepth = params.cradleDepth ?? DEFAULT_CRADLE_DEPTH;
  const R = params.cornerRadius ?? DEFAULT_CORNER_RADIUS;

  const startX = centerX - cradleHalfWidth;
  const endX = centerX + cradleHalfWidth;

  // Control points for the liquid S-curve Bezier dip under the '+' button
  const cp1X = Math.round(centerX - cradleHalfWidth * 0.48);
  const cp2X = Math.round(centerX - cradleHalfWidth * 0.36);
  const cp3X = Math.round(centerX + cradleHalfWidth * 0.36);
  const cp4X = Math.round(centerX + cradleHalfWidth * 0.48);

  const topContour = [
    `M 0,${R}`,
    `Q 0,0 ${R},0`,
    `L ${startX},0`,
    `C ${cp1X},0 ${cp2X},${cradleDepth} ${centerX},${cradleDepth}`,
    `C ${cp3X},${cradleDepth} ${cp4X},0 ${endX},0`,
    `L ${width - R},0`,
    `Q ${width},0 ${width},${R}`,
  ].join(' ');

  const fillPath = `${topContour} L ${width},${totalHeight} L 0,${totalHeight} Z`;

  return {
    width,
    barContentHeight,
    safeBottomInset,
    totalHeight,
    centerX,
    cradleHalfWidth,
    cradleDepth,
    cornerRadius: R,
    fillPath,
    topStrokePath: topContour,
  };
}
