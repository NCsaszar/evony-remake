import type { Army } from './types';

export interface NpcCamp {
  id: string;
  level: number;   // 1–10
  tileX: number;
  tileY: number;
  label: string;
  garrison: Army;
  resources: { food: number; lumber: number; stone: number; iron: number; gold: number };
  respawnMs: number; // ms until camp respawns after being defeated
  defeatedAt?: number;
}

/** Generate a procedural world map of NPC camps. */
export function generateWorldMap(seed: number): NpcCamp[] {
  const camps: NpcCamp[] = [];
  const rng = mulberry32(seed);
  const MAP_SIZE = 200;
  const COUNT = 120;

  for (let i = 0; i < COUNT; i++) {
    const lvl = Math.min(10, Math.floor(rng() * 10) + 1);
    const x = Math.floor(rng() * MAP_SIZE);
    const y = Math.floor(rng() * MAP_SIZE);

    // Skip player home area (center)
    if (Math.abs(x - 100) < 5 && Math.abs(y - 100) < 5) continue;

    const scale = 2 ** (lvl - 1);
    camps.push({
      id: `npc_${i}`,
      level: lvl,
      tileX: x,
      tileY: y,
      label: `Barbarian Valley Lv${lvl}`,
      garrison: {
        warrior:  Math.floor(100  * scale * (0.8 + rng() * 0.4)),
        archer:   Math.floor(50   * scale * (0.8 + rng() * 0.4)),
        pikeman:  Math.floor(30   * scale * (0.8 + rng() * 0.4)),
        cavalry:  lvl >= 4 ? Math.floor(20 * scale * (0.8 + rng() * 0.4)) : 0,
        catapult: lvl >= 7 ? Math.floor(10 * scale * (0.8 + rng() * 0.4)) : 0,
      },
      resources: {
        food:   500  * scale,
        lumber: 400  * scale,
        stone:  300  * scale,
        iron:   200  * scale,
        gold:   100  * scale,
      },
      respawnMs: 1000 * 60 * 30 * lvl, // 30 min × level
    });
  }

  return camps;
}

/** Splitmix32-based seedable RNG returning [0,1). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
