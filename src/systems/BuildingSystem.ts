import type { GameState, BuildingInstance, BuildingType } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { canAfford, deductCost } from './ResourceSystem';

let _nextId = 100;
function nextId() { return `b${_nextId++}`; }

/** Return the construction time multiplier from research. */
function constructionSpeedMultiplier(state: GameState): number {
  let bonus = 0;
  for (const [id, lvl] of Object.entries(state.research)) {
    if (['construction','advConstruction','typography'].includes(id)) {
      bonus += lvl * 0.05;
    }
  }
  return Math.max(0.1, 1 - bonus);
}

/** Start upgrading / building a new building. Returns error string or null. */
export function startUpgrade(state: GameState, buildingId: string): string | null {
  // Only one construction at a time
  const busy = state.buildings.some(b => b.constructingUntil && b.constructingUntil > Date.now());
  if (busy) return 'Already constructing another building.';

  const b = state.buildings.find(b => b.id === buildingId);
  if (!b) return 'Building not found.';

  const def = BUILDINGS[b.type];
  if (b.level >= def.maxLevel) return 'Already at max level.';

  const nextLevel = b.level + 1;
  const levelData = def.levels[nextLevel - 1];
  if (!canAfford(state, levelData.cost)) return 'Not enough resources.';

  deductCost(state, levelData.cost);
  const multiplier = constructionSpeedMultiplier(state);
  b.constructingUntil = Date.now() + levelData.cost.time * 1000 * multiplier;
  return null;
}

/** Check and finalize any completed constructions. */
export function checkConstructions(state: GameState): BuildingType[] {
  const finished: BuildingType[] = [];
  const now = Date.now();
  for (const b of state.buildings) {
    if (b.constructingUntil && b.constructingUntil <= now) {
      b.level += 1;
      b.constructingUntil = undefined;
      finished.push(b.type);
    }
  }
  return finished;
}

// City-zone building types — shared with CityScene for zone-aware collision
const CITY_BUILDING_TYPES = new Set([
  'farm', 'sawmill', 'quarry', 'ironmine',
]);

/** Place a new building on the grid. Returns error or null. */
export function placeBuilding(
  state: GameState,
  type: BuildingType,
  tileX: number,
  tileY: number
): string | null {
  const def = BUILDINGS[type];
  const cost = def.levels[0].cost;
  if (!canAfford(state, cost)) return 'Not enough resources.';

  // Zone-aware collision: city buildings only conflict with other city buildings,
  // town buildings only conflict with other town buildings (they share world coords).
  const isNewCity = CITY_BUILDING_TYPES.has(type);
  for (const b of state.buildings) {
    if (b.tileX === tileX && b.tileY === tileY) {
      if (CITY_BUILDING_TYPES.has(b.type) === isNewCity) return 'Tile occupied.';
    }
  }

  deductCost(state, cost);
  state.buildings.push({ id: nextId(), type, level: 1, tileX, tileY });
  return null;
}

/** Get buildings that are currently under construction. */
export function getBuildingInProgress(state: GameState): BuildingInstance | undefined {
  return state.buildings.find(b => b.constructingUntil && b.constructingUntil > Date.now());
}
