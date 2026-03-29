import type { Army } from '../data/types';
import { TROOPS } from '../data/troops';

export interface CombatResult {
  attackerLosses: Army;
  defenderLosses: Army;
  attackerWon: boolean;
  loot: { food: number; lumber: number; stone: number; iron: number; gold: number };
  rounds: RoundResult[];
}

interface RoundResult {
  round: number;
  attackerLosses: Army;
  defenderLosses: Army;
  attackerRemaining: Army;
  defenderRemaining: Army;
}

const MAX_ROUNDS = 10;
const TYPE_ADVANTAGE = 1.5; // multiplier when strong against

function armyPower(army: Army): number {
  let p = 0;
  for (const [type, count] of Object.entries(army)) {
    if (!count) continue;
    const def = TROOPS[type as keyof typeof TROOPS];
    if (def) p += def.attack * count;
  }
  return p;
}

function applyDamage(attacker: Army, defender: Army): Army {
  const losses: Army = {};
  for (const [dType, dCount] of Object.entries(defender)) {
    if (!dCount) continue;
    const dDef = TROOPS[dType as keyof typeof TROOPS];

    let totalDmg = 0;
    for (const [aType, aCount] of Object.entries(attacker)) {
      if (!aCount) continue;
      const aDef = TROOPS[aType as keyof typeof TROOPS];
      let dmg = aDef.attack * aCount;
      // Type advantage
      if (aDef.strongAgainst?.includes(dType as any)) dmg *= TYPE_ADVANTAGE;
      if (aDef.weakAgainst?.includes(dType as any))   dmg /= TYPE_ADVANTAGE;
      totalDmg += dmg;
    }

    // Spread damage proportionally based on count × hp
    const totalHp = dDef.hp * dCount;
    const killed = Math.min(dCount, Math.floor(totalDmg / dDef.hp / Object.keys(attacker).length));
    losses[dType as keyof Army] = Math.max(0, killed);
  }
  return losses;
}

function subtractArmy(army: Army, losses: Army): Army {
  const result: Army = { ...army };
  for (const [type, lost] of Object.entries(losses)) {
    const cur = result[type as keyof Army] ?? 0;
    result[type as keyof Army] = Math.max(0, cur - (lost ?? 0));
  }
  return result;
}

function totalCount(army: Army): number {
  return Object.values(army).reduce((s, v) => s + (v ?? 0), 0);
}

export function simulateBattle(
  attacker: Army,
  defender: Army,
  defenderResources: { food: number; lumber: number; stone: number; iron: number; gold: number }
): CombatResult {
  let atk = { ...attacker };
  let def = { ...defender };
  const rounds: RoundResult[] = [];

  const totalAttackerLosses: Army = {};
  const totalDefenderLosses: Army = {};

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (totalCount(atk) === 0 || totalCount(def) === 0) break;

    const aLoss = applyDamage(def, atk); // defender attacks attacker
    const dLoss = applyDamage(atk, def); // attacker attacks defender

    atk = subtractArmy(atk, aLoss);
    def = subtractArmy(def, dLoss);

    // Accumulate total losses
    for (const [type, cnt] of Object.entries(aLoss)) {
      totalAttackerLosses[type as keyof Army] = ((totalAttackerLosses[type as keyof Army] ?? 0) + (cnt ?? 0));
    }
    for (const [type, cnt] of Object.entries(dLoss)) {
      totalDefenderLosses[type as keyof Army] = ((totalDefenderLosses[type as keyof Army] ?? 0) + (cnt ?? 0));
    }

    rounds.push({
      round,
      attackerLosses: { ...aLoss },
      defenderLosses: { ...dLoss },
      attackerRemaining: { ...atk },
      defenderRemaining: { ...def },
    });
  }

  const attackerWon = totalCount(def) === 0 || armyPower(atk) > armyPower(def);

  // Loot: 20% of defender resources if attacker wins
  const lootRate = attackerWon ? 0.2 : 0;

  // Load capacity
  let loadCap = 0;
  for (const [type, count] of Object.entries(atk)) {
    if (!count) continue;
    const d = TROOPS[type as keyof typeof TROOPS];
    if (d) loadCap += d.load * count;
  }

  const rawLoot = {
    food:   defenderResources.food   * lootRate,
    lumber: defenderResources.lumber * lootRate,
    stone:  defenderResources.stone  * lootRate,
    iron:   defenderResources.iron   * lootRate,
    gold:   defenderResources.gold   * lootRate,
  };
  const totalRaw = rawLoot.food + rawLoot.lumber + rawLoot.stone + rawLoot.iron + rawLoot.gold;
  const loadMult = totalRaw > 0 ? Math.min(1, loadCap / totalRaw) : 0;

  return {
    attackerLosses: totalAttackerLosses,
    defenderLosses: totalDefenderLosses,
    attackerWon,
    loot: {
      food:   Math.floor(rawLoot.food   * loadMult),
      lumber: Math.floor(rawLoot.lumber * loadMult),
      stone:  Math.floor(rawLoot.stone  * loadMult),
      iron:   Math.floor(rawLoot.iron   * loadMult),
      gold:   Math.floor(rawLoot.gold   * loadMult),
    },
    rounds,
  };
}
