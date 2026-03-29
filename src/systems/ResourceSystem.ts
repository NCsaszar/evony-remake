import type { GameState, Resources } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { TROOPS } from '../data/troops';

export const STORAGE_BASE = 50000;
export const STORAGE_PER_WAREHOUSE_LEVEL = 20000;

/** Compute hourly production rates from all buildings + bonuses. */
export function computeProduction(state: GameState): Resources {
  const rates: Resources = { food: 0, lumber: 0, stone: 0, iron: 0, gold: 0 };

  // Mayor Politics bonus to production
  const mayor = state.heroes.find(h => h.isMayor);
  const politicsBonus = mayor ? 1 + mayor.politics * 0.01 : 1;

  for (const building of state.buildings) {
    const def = BUILDINGS[building.type];
    const levelData = def.levels[building.level - 1];
    if (!levelData.output) continue;
    const out = levelData.output;
    if (out.food)   rates.food   += out.food   * politicsBonus;
    if (out.lumber) rates.lumber += out.lumber * politicsBonus;
    if (out.stone)  rates.stone  += out.stone  * politicsBonus;
    if (out.iron)   rates.iron   += out.iron   * politicsBonus;
  }

  // Gold from tax: population × taxRate%
  const population = computePopulation(state);
  const researchBonus = 1; // TODO: apply research bonuses
  rates.gold += population * (state.taxRate / 100) * 0.1 * researchBonus;

  // Troop food consumption (per hour)
  const foodConsumption = computeFoodConsumption(state);
  rates.food -= foodConsumption;

  return rates;
}

export function computePopulation(state: GameState): number {
  let pop = 0;
  for (const b of state.buildings) {
    if (b.type === 'cottage') {
      const levelData = BUILDINGS.cottage.levels[b.level - 1];
      pop += levelData.provides?.population ?? 0;
    }
  }
  return Math.max(500, pop);
}

export function computeFoodConsumption(state: GameState): number {
  let total = 0;
  for (const [type, count] of Object.entries(state.troops) as [keyof typeof TROOPS, number | undefined][]) {
    if (!count) continue;
    const def = TROOPS[type];
    if (def) total += def.foodPerHour * count;
  }
  return total;
}

export function computeStorage(state: GameState): number {
  let cap = STORAGE_BASE;
  for (const b of state.buildings) {
    if (b.type === 'warehouse') cap += b.level * STORAGE_PER_WAREHOUSE_LEVEL;
  }
  return cap;
}

/** Tick resources forward by `dt` seconds. */
export function tickResources(state: GameState, dt: number): void {
  const rates = computeProduction(state);
  const cap = computeStorage(state);
  const hours = dt / 3600;
  const res = state.resources;

  res.food   = Math.max(0, Math.min(cap, res.food   + rates.food   * hours));
  res.lumber = Math.max(0, Math.min(cap, res.lumber + rates.lumber * hours));
  res.stone  = Math.max(0, Math.min(cap, res.stone  + rates.stone  * hours));
  res.iron   = Math.max(0, Math.min(cap, res.iron   + rates.iron   * hours));
  res.gold   = Math.max(0, Math.min(cap, res.gold   + rates.gold   * hours));
}

/** Returns true if the player can afford the given cost. */
export function canAfford(state: GameState, cost: Partial<Resources>): boolean {
  const r = state.resources;
  return (
    (cost.food   ?? 0) <= r.food   &&
    (cost.lumber ?? 0) <= r.lumber &&
    (cost.stone  ?? 0) <= r.stone  &&
    (cost.iron   ?? 0) <= r.iron   &&
    (cost.gold   ?? 0) <= r.gold
  );
}

/** Deduct cost from resources. */
export function deductCost(state: GameState, cost: Partial<Resources>): void {
  state.resources.food   -= cost.food   ?? 0;
  state.resources.lumber -= cost.lumber ?? 0;
  state.resources.stone  -= cost.stone  ?? 0;
  state.resources.iron   -= cost.iron   ?? 0;
  state.resources.gold   -= cost.gold   ?? 0;
}
