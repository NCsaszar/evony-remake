import type { BuildingType, Resources } from './types';

export interface BuildingLevelData {
  cost: Partial<Resources> & { time: number }; // time in seconds
  output?: Partial<Resources>;                  // per-hour production
  provides?: Record<string, number>;            // e.g. population, slots
}

export interface BuildingDef {
  type: BuildingType;
  label: string;
  description: string;
  maxLevel: number;
  /** tileW × tileH footprint */
  footprint: [number, number];
  levels: BuildingLevelData[]; // index 0 = level 1 data
  /** true = resource field, placed in outer ring */
  isField?: boolean;
}

function scaleLevel(base: Partial<Resources> & { time: number }, factor = 2): BuildingLevelData[] {
  const levels: BuildingLevelData[] = [];
  let cur = { ...base };
  for (let i = 0; i < 10; i++) {
    levels.push({ cost: { ...cur } });
    cur = {
      food:   Math.round((cur.food   ?? 0) * factor),
      lumber: Math.round((cur.lumber ?? 0) * factor),
      stone:  Math.round((cur.stone  ?? 0) * factor),
      iron:   Math.round((cur.iron   ?? 0) * factor),
      gold:   Math.round((cur.gold   ?? 0) * factor),
      time:   Math.round(cur.time * factor),
    };
  }
  return levels;
}

// Resource production per hour per level (index 0 = level 1)
const FARM_OUTPUT    = [1200,2400,4800,9600,19200,38400,76800,153600,307200,614400];
const SAWMILL_OUTPUT = [1000,2000,4000,8000,16000,32000,64000,128000,256000,512000];
const QUARRY_OUTPUT  = [800,1600,3200,6400,12800,25600,51200,102400,204800,409600];
const MINE_OUTPUT    = [400,800,1600,3200,6400,12800,25600,51200,102400,204800];

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  townhall: {
    type: 'townhall', label: 'Town Hall', description: 'The heart of your city. Upgrade to unlock more buildings.',
    maxLevel: 10, footprint: [2, 2],
    levels: scaleLevel({ lumber: 2000, stone: 2000, iron: 1000, gold: 500, time: 120 }),
  },
  farm: {
    type: 'farm', label: 'Farm', description: 'Produces food to feed your troops.',
    maxLevel: 10, footprint: [1, 1], isField: true,
    levels: FARM_OUTPUT.map((out, i) => ({
      cost: { lumber: 200 * (2**i), stone: 100 * (2**i), time: 30 * (2**i) },
      output: { food: out },
    })),
  },
  sawmill: {
    type: 'sawmill', label: 'Sawmill', description: 'Produces lumber, the most essential resource.',
    maxLevel: 10, footprint: [1, 1], isField: true,
    levels: SAWMILL_OUTPUT.map((out, i) => ({
      cost: { food: 200 * (2**i), stone: 100 * (2**i), time: 30 * (2**i) },
      output: { lumber: out },
    })),
  },
  quarry: {
    type: 'quarry', label: 'Quarry', description: 'Produces stone for construction.',
    maxLevel: 10, footprint: [1, 1], isField: true,
    levels: QUARRY_OUTPUT.map((out, i) => ({
      cost: { food: 200 * (2**i), lumber: 100 * (2**i), time: 30 * (2**i) },
      output: { stone: out },
    })),
  },
  ironmine: {
    type: 'ironmine', label: 'Iron Mine', description: 'Produces iron for weapons and training.',
    maxLevel: 10, footprint: [1, 1], isField: true,
    levels: MINE_OUTPUT.map((out, i) => ({
      cost: { food: 300 * (2**i), lumber: 200 * (2**i), stone: 100 * (2**i), time: 60 * (2**i) },
      output: { iron: out },
    })),
  },
  warehouse: {
    type: 'warehouse', label: 'Warehouse', description: 'Increases resource storage capacity.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 500, stone: 300, time: 60 }),
  },
  cottage: {
    type: 'cottage', label: 'Cottage', description: 'Increases population, which generates tax gold.',
    maxLevel: 10, footprint: [1, 1],
    levels: Array.from({ length: 10 }, (_, i) => ({
      cost: { lumber: 400 * (2**i), stone: 200 * (2**i), time: 45 * (2**i) },
      provides: { population: 200 * (i + 1) },
    })),
  },
  barracks: {
    type: 'barracks', label: 'Barracks', description: 'Trains ground troops. Higher levels unlock more unit types.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 1000, stone: 500, iron: 200, time: 90 }),
  },
  stable: {
    type: 'stable', label: 'Stable', description: 'Trains cavalry and mounted units.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 1500, stone: 500, iron: 500, time: 120 }),
  },
  workshop: {
    type: 'workshop', label: 'Workshop', description: 'Required for siege weapons and wall defenses.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 2000, stone: 1000, iron: 500, time: 180 }),
  },
  academy: {
    type: 'academy', label: 'Academy', description: 'Research technologies to improve your city and army.',
    maxLevel: 10, footprint: [2, 2],
    levels: scaleLevel({ lumber: 1500, stone: 1000, gold: 500, time: 150 }),
  },
  forge: {
    type: 'forge', label: 'Forge', description: 'Enables Military Science research. Level must match desired research level.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 800, stone: 400, iron: 300, time: 90 }),
  },
  embassy: {
    type: 'embassy', label: 'Embassy', description: 'Join or form alliances. Accept reinforcements from allies.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 1000, stone: 500, gold: 200, time: 120 }),
  },
  market: {
    type: 'market', label: 'Market', description: 'Trade resources with other cities.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 600, stone: 300, gold: 100, time: 60 }),
  },
  inn: {
    type: 'inn', label: 'Inn', description: 'Recruit heroes. Each level allows 1 more hero to be recruited.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 700, stone: 300, gold: 200, time: 75 }),
  },
  feastinghall: {
    type: 'feastinghall', label: 'Feasting Hall', description: 'Stores heroes. Maximum heroes in city = Feasting Hall level.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 900, stone: 400, gold: 300, time: 90 }),
  },
  rallyspot: {
    type: 'rallyspot', label: 'Rally Spot', description: 'Assemble armies and launch attacks on the world map.',
    maxLevel: 10, footprint: [2, 1],
    levels: scaleLevel({ lumber: 800, stone: 400, iron: 200, time: 90 }),
  },
  beacontower: {
    type: 'beacontower', label: 'Beacon Tower', description: 'Provides early warning of incoming attacks.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 500, stone: 200, iron: 100, time: 60 }),
  },
  reliefstation: {
    type: 'reliefstation', label: 'Relief Station', description: 'Reduces troop travel time. Major bonuses at levels 5, 8, and 10.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 600, stone: 300, iron: 100, time: 75 }),
  },
  walls: {
    type: 'walls', label: 'Walls', description: 'City defenses including archer towers. Best defensive structure.',
    maxLevel: 10, footprint: [1, 1],
    levels: scaleLevel({ lumber: 1000, stone: 2000, iron: 500, time: 200 }),
  },
};

export function getBuildingDef(type: BuildingType): BuildingDef {
  return BUILDINGS[type];
}

export function getLevelData(type: BuildingType, level: number): BuildingLevelData {
  return BUILDINGS[type].levels[level - 1];
}
