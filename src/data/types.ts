// ── Shared game types ─────────────────────────────────────────────────────────

export interface Resources {
  food: number;
  lumber: number;
  stone: number;
  iron: number;
  gold: number;
}

export type BuildingType =
  | 'townhall'
  | 'farm'
  | 'sawmill'
  | 'quarry'
  | 'ironmine'
  | 'warehouse'
  | 'cottage'
  | 'barracks'
  | 'stable'
  | 'workshop'
  | 'academy'
  | 'forge'
  | 'embassy'
  | 'market'
  | 'inn'
  | 'feastinghall'
  | 'rallyspot'
  | 'beacontower'
  | 'reliefstation'
  | 'walls';

export type TroopType =
  | 'worker'
  | 'warrior'
  | 'scout'
  | 'pikeman'
  | 'swordsman'
  | 'archer'
  | 'cavalry'
  | 'cataphract'
  | 'catapult'
  | 'batteringram'
  | 'ballista'
  | 'transporter';

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  level: number;
  tileX: number;
  tileY: number;
  constructingUntil?: number; // epoch ms
}

export type Army = Partial<Record<TroopType, number>>;

export interface Hero {
  id: string;
  name: string;
  politics: number;
  attack: number;
  intelligence: number;
  exp: number;
  level: number;
  isMayor: boolean;
}

export interface MarchState {
  id: string;
  heroId: string;
  troops: Army;
  targetX: number;
  targetY: number;
  targetType: 'npc' | 'city';
  targetId: string;
  departedAt: number;  // epoch ms
  arrivalAt: number;   // epoch ms
  returning: boolean;
  returnAt?: number;
}

export interface GameState {
  resources: Resources;
  buildings: BuildingInstance[];
  troops: Army;
  heroes: Hero[];
  research: Record<string, number>; // researchId → level
  activeResearch?: { id: string; completesAt: number };
  activeTraining?: { troopType: TroopType; quantity: number; completesAt: number };
  marches: MarchState[];
  lastSaved: number; // epoch ms
  playerX: number;   // city position on world map
  playerY: number;
  taxRate: number;   // 0–100
  version?: number;
}
