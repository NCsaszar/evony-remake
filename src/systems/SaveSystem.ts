import type { GameState } from '../data/types';
import { generateWorldMap } from '../data/world';
import type { NpcCamp } from '../data/world';

const SAVE_KEY    = 'evony_save';
const WORLD_KEY   = 'evony_world';
const SAVE_VERSION = 3;

export function defaultState(): GameState {
  return {
    version: SAVE_VERSION,
    resources: { food: 5000, lumber: 5000, stone: 3000, iron: 1000, gold: 2000 },
    buildings: [
      { id: 'b0', type: 'townhall',  level: 1, tileX: 2, tileY: 2 },
      { id: 'b1', type: 'barracks',  level: 1, tileX: 4, tileY: 0 },
      { id: 'b2', type: 'farm',      level: 1, tileX: 0, tileY: 0 },
      { id: 'b3', type: 'sawmill',   level: 1, tileX: 0, tileY: 2 },
      { id: 'b4', type: 'cottage',   level: 1, tileX: 0, tileY: 4 },
      { id: 'b5', type: 'warehouse', level: 1, tileX: 4, tileY: 4 },
      { id: 'b6', type: 'academy',   level: 1, tileX: 2, tileY: 4 },
    ],
    troops: { warrior: 50, scout: 20 },
    heroes: [],
    research: {},
    marches: [],
    lastSaved: Date.now(),
    playerX: 100,
    playerY: 100,
    taxRate: 50,
  };
}

export function saveGame(state: GameState): void {
  state.lastSaved = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    // Discard saves from older versions (incompatible tile positions)
    if (!state.version || state.version < SAVE_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveWorld(camps: NpcCamp[]): void {
  localStorage.setItem(WORLD_KEY, JSON.stringify(camps));
}

export function loadWorld(): NpcCamp[] {
  const raw = localStorage.getItem(WORLD_KEY);
  if (raw) {
    try { return JSON.parse(raw) as NpcCamp[]; } catch { /* fall through */ }
  }
  const camps = generateWorldMap(12345);
  saveWorld(camps);
  return camps;
}

/** Apply offline resource gains since last save. */
export function applyOfflineProgress(state: GameState, computeProduction: (s: GameState) => import('../data/types').Resources): GameState {
  const elapsed = (Date.now() - state.lastSaved) / 1000; // seconds
  if (elapsed < 5) return state;

  const rates = computeProduction(state);
  const elapsedHours = elapsed / 3600;
  const res = state.resources;
  res.food   = Math.max(0, res.food   + rates.food   * elapsedHours);
  res.lumber = Math.max(0, res.lumber + rates.lumber  * elapsedHours);
  res.stone  = Math.max(0, res.stone  + rates.stone   * elapsedHours);
  res.iron   = Math.max(0, res.iron   + rates.iron    * elapsedHours);
  res.gold   = Math.max(0, res.gold   + rates.gold    * elapsedHours);

  return state;
}
