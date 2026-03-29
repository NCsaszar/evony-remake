import type { TroopType, BuildingType } from './types';

export interface TroopDef {
  type: TroopType;
  label: string;
  attack: number;
  defense: number;
  hp: number;
  range: number;    // 0 = melee
  speed: number;
  load: number;     // resources carried
  foodPerHour: number;
  trainedIn: BuildingType;
  barracksLevelReq: number;
  /** Food + Lumber + Stone + Iron + Gold cost per unit */
  cost: { food: number; lumber: number; stone: number; iron: number; gold: number };
  trainTime: number; // seconds per unit
  /** Type bonuses: multiplier when attacking these types */
  strongAgainst?: TroopType[];
  weakAgainst?: TroopType[];
}

export const TROOPS: Record<TroopType, TroopDef> = {
  worker: {
    type: 'worker', label: 'Worker',
    attack: 0, defense: 0, hp: 100, range: 0, speed: 10, load: 0, foodPerHour: 0,
    trainedIn: 'barracks', barracksLevelReq: 1,
    cost: { food: 0, lumber: 0, stone: 0, iron: 0, gold: 0 },
    trainTime: 0,
  },
  warrior: {
    type: 'warrior', label: 'Warrior',
    attack: 55, defense: 45, hp: 700, range: 0, speed: 200, load: 100, foodPerHour: 1,
    trainedIn: 'barracks', barracksLevelReq: 1,
    cost: { food: 50, lumber: 0, stone: 0, iron: 0, gold: 50 },
    trainTime: 60,
    weakAgainst: ['archer'],
  },
  scout: {
    type: 'scout', label: 'Scout',
    attack: 20, defense: 20, hp: 200, range: 0, speed: 1200, load: 0, foodPerHour: 0.5,
    trainedIn: 'barracks', barracksLevelReq: 1,
    cost: { food: 0, lumber: 0, stone: 0, iron: 0, gold: 75 },
    trainTime: 30,
  },
  pikeman: {
    type: 'pikeman', label: 'Pikeman',
    attack: 75, defense: 90, hp: 1000, range: 0, speed: 160, load: 150, foodPerHour: 1.5,
    trainedIn: 'barracks', barracksLevelReq: 2,
    cost: { food: 100, lumber: 0, stone: 0, iron: 50, gold: 75 },
    trainTime: 90,
    strongAgainst: ['cavalry', 'cataphract'],
    weakAgainst: ['archer'],
  },
  swordsman: {
    type: 'swordsman', label: 'Swordsman',
    attack: 120, defense: 150, hp: 1800, range: 0, speed: 150, load: 150, foodPerHour: 2,
    trainedIn: 'barracks', barracksLevelReq: 4,
    cost: { food: 150, lumber: 0, stone: 0, iron: 150, gold: 100 },
    trainTime: 150,
    strongAgainst: ['cavalry', 'cataphract', 'archer'],
  },
  archer: {
    type: 'archer', label: 'Archer',
    attack: 100, defense: 50, hp: 700, range: 800, speed: 200, load: 100, foodPerHour: 1,
    trainedIn: 'barracks', barracksLevelReq: 3,
    cost: { food: 100, lumber: 50, stone: 0, iron: 0, gold: 100 },
    trainTime: 120,
    strongAgainst: ['cavalry', 'cataphract', 'warrior'],
    weakAgainst: ['swordsman'],
  },
  cavalry: {
    type: 'cavalry', label: 'Cavalry',
    attack: 270, defense: 180, hp: 2400, range: 0, speed: 600, load: 300, foodPerHour: 3,
    trainedIn: 'stable', barracksLevelReq: 5,
    cost: { food: 250, lumber: 0, stone: 0, iron: 150, gold: 250 },
    trainTime: 240,
    strongAgainst: ['warrior', 'pikeman'],
    weakAgainst: ['pikeman', 'swordsman', 'archer'],
  },
  cataphract: {
    type: 'cataphract', label: 'Cataphract',
    attack: 360, defense: 270, hp: 3600, range: 0, speed: 500, load: 400, foodPerHour: 4,
    trainedIn: 'stable', barracksLevelReq: 7,
    cost: { food: 400, lumber: 0, stone: 0, iron: 250, gold: 400 },
    trainTime: 360,
    strongAgainst: ['warrior', 'pikeman'],
    weakAgainst: ['pikeman', 'swordsman', 'archer'],
  },
  catapult: {
    type: 'catapult', label: 'Catapult',
    attack: 600, defense: 60, hp: 3000, range: 1500, speed: 60, load: 0, foodPerHour: 5,
    trainedIn: 'workshop', barracksLevelReq: 8,
    cost: { food: 0, lumber: 500, stone: 300, iron: 500, gold: 500 },
    trainTime: 600,
  },
  batteringram: {
    type: 'batteringram', label: 'Battering Ram',
    attack: 350, defense: 100, hp: 5000, range: 0, speed: 50, load: 0, foodPerHour: 5,
    trainedIn: 'workshop', barracksLevelReq: 8,
    cost: { food: 0, lumber: 800, stone: 500, iron: 300, gold: 600 },
    trainTime: 720,
  },
  ballista: {
    type: 'ballista', label: 'Ballista',
    attack: 450, defense: 80, hp: 2200, range: 1400, speed: 60, load: 0, foodPerHour: 4,
    trainedIn: 'workshop', barracksLevelReq: 9,
    cost: { food: 0, lumber: 600, stone: 200, iron: 600, gold: 700 },
    trainTime: 600,
  },
  transporter: {
    type: 'transporter', label: 'Transporter',
    attack: 10, defense: 10, hp: 500, range: 0, speed: 200, load: 5000, foodPerHour: 0.5,
    trainedIn: 'stable', barracksLevelReq: 3,
    cost: { food: 100, lumber: 100, stone: 0, iron: 0, gold: 100 },
    trainTime: 120,
  },
};
