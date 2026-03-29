export type ResearchTree = 'advancement' | 'defense' | 'military' | 'medical';

export interface ResearchDef {
  id: string;
  label: string;
  tree: ResearchTree;
  maxLevel: number;
  academyLevelReq: number;
  prereqs: string[]; // other research ids
  /** Cost per level (index 0 = level 1). Time in seconds. */
  cost: Array<{ gold: number; time: number }>;
  /** Bonus applied per level */
  bonus: { type: string; value: number };
}

function goldCosts(base: number, levels: number, factor = 1.5): Array<{ gold: number; time: number }> {
  return Array.from({ length: levels }, (_, i) => ({
    gold: Math.round(base * factor ** i),
    time: Math.round(300 * factor ** i),
  }));
}

export const RESEARCH: ResearchDef[] = [
  // ── Advancement ──────────────────────────────────────────────────────────────
  {
    id: 'construction', label: 'Construction', tree: 'advancement',
    maxLevel: 10, academyLevelReq: 1, prereqs: [],
    cost: goldCosts(500, 10),
    bonus: { type: 'constructionSpeed', value: 0.05 },
  },
  {
    id: 'advConstruction', label: 'Adv. Construction', tree: 'advancement',
    maxLevel: 10, academyLevelReq: 3, prereqs: ['construction'],
    cost: goldCosts(2000, 10),
    bonus: { type: 'constructionSpeed', value: 0.05 },
  },
  {
    id: 'typography', label: 'Typography', tree: 'advancement',
    maxLevel: 10, academyLevelReq: 5, prereqs: ['advConstruction'],
    cost: goldCosts(5000, 10),
    bonus: { type: 'constructionSpeed', value: 0.05 },
  },
  {
    id: 'logistics', label: 'Logistics', tree: 'advancement',
    maxLevel: 10, academyLevelReq: 2, prereqs: [],
    cost: goldCosts(800, 10),
    bonus: { type: 'marchSpeed', value: 0.05 },
  },

  // ── Military ─────────────────────────────────────────────────────────────────
  {
    id: 'militaryScience', label: 'Military Science', tree: 'military',
    maxLevel: 10, academyLevelReq: 1, prereqs: [],
    cost: goldCosts(1000, 10),
    bonus: { type: 'trainSpeed', value: 0.1 },
  },
  {
    id: 'militaryTradition', label: 'Military Tradition', tree: 'military',
    maxLevel: 10, academyLevelReq: 4, prereqs: ['militaryScience'],
    cost: goldCosts(3000, 10),
    bonus: { type: 'attack', value: 0.05 },
  },
  {
    id: 'ironWorking', label: 'Iron Working', tree: 'military',
    maxLevel: 10, academyLevelReq: 2, prereqs: [],
    cost: goldCosts(1200, 10),
    bonus: { type: 'defense', value: 0.05 },
  },

  // ── Defense ───────────────────────────────────────────────────────────────────
  {
    id: 'archery', label: 'Archery', tree: 'defense',
    maxLevel: 10, academyLevelReq: 2, prereqs: [],
    cost: goldCosts(800, 10),
    bonus: { type: 'archerAttack', value: 0.05 },
  },
  {
    id: 'metalCasting', label: 'Metal Casting', tree: 'defense',
    maxLevel: 10, academyLevelReq: 3, prereqs: ['archery'],
    cost: goldCosts(2500, 10),
    bonus: { type: 'wallDefense', value: 0.08 },
  },
  {
    id: 'informatics', label: 'Informatics', tree: 'defense',
    maxLevel: 10, academyLevelReq: 4, prereqs: [],
    cost: goldCosts(2000, 10),
    bonus: { type: 'scouting', value: 0.1 },
  },

  // ── Medical ──────────────────────────────────────────────────────────────────
  {
    id: 'medicine', label: 'Medicine', tree: 'medical',
    maxLevel: 10, academyLevelReq: 5, prereqs: [],
    cost: goldCosts(3000, 10),
    bonus: { type: 'troopRecovery', value: 0.05 },
  },
  {
    id: 'lore', label: 'Lore', tree: 'medical',
    maxLevel: 10, academyLevelReq: 7, prereqs: ['medicine'],
    cost: goldCosts(8000, 10),
    bonus: { type: 'heroExp', value: 0.1 },
  },
];

export const RESEARCH_MAP: Record<string, ResearchDef> = Object.fromEntries(
  RESEARCH.map(r => [r.id, r])
);
