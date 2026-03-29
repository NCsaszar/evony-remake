// Flat top-down grid math
// World coords (tileX, tileY) → screen coords (px, py)
// Square layout: each tile is 96×96 px

export const TILE_W = 96;
export const TILE_H = 96;

/** Convert tile grid position to screen pixel position (top-left of tile). */
export function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * TILE_W,
    y: tileY * TILE_H,
  };
}

/** Convert screen pixel position back to tile coordinates (fractional). */
export function screenToTile(sx: number, sy: number): { tileX: number; tileY: number } {
  return { tileX: sx / TILE_W, tileY: sy / TILE_H };
}

/** Depth sort value — row-major for top-down view. */
export function isoDepth(tileX: number, tileY: number): number {
  return tileY * 100 + tileX;
}
