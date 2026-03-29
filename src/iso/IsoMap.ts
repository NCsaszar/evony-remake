// Isometric grid math
// World coords (tileX, tileY) → screen coords (px, py)
// Diamond layout: tile is 128px wide, 64px tall

export const TILE_W = 128;
export const TILE_H = 64;

/** Convert tile grid position to screen pixel position (top of tile diamond). */
export function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_W / 2),
    y: (tileX + tileY) * (TILE_H / 2),
  };
}

/** Convert screen pixel position back to tile coordinates (fractional). */
export function screenToTile(sx: number, sy: number): { tileX: number; tileY: number } {
  const tileX = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2;
  const tileY = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
  return { tileX, tileY };
}

/** Depth sort value — higher = drawn later (on top). */
export function isoDepth(tileX: number, tileY: number): number {
  return tileX + tileY;
}
