import { createRng } from '../../../engine/rng.ts';
import { FIRE_INTERVAL } from './constants.ts';
import type { HazardKind, Level, SpawnType } from './level.ts';

export type Phase = 'advance' | 'boss' | 'won' | 'lost';

export interface Squad {
  x: number;
  vx: number;
  count: number;
  peak: number;
}

export interface Entity {
  id: number;
  type: SpawnType;
  x: number;
  z: number;
  hp: number;
  value: number;
  halfW: number;
  halfD: number;
  kind: HazardKind | null;
  kills: number;
  max: number;
  resolved: boolean;
  flash: number;
}

export interface Bullet {
  x: number;
  z: number;
  damage: number;
  vx: number; // sideways drift in road units per second
}

export interface Projectile {
  x: number;
  z: number;
}

export interface Boss {
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  fireTimer: number;
  flash: number;
}

export type GameEvent =
  | { type: 'shot'; x: number; z: number }
  | { type: 'hit'; x: number; z: number; target: SpawnType | 'boss' }
  | { type: 'destroyed'; x: number; z: number; target: SpawnType }
  | { type: 'gain' | 'lose'; amount: number; x: number; z: number }
  | { type: 'bossArrive' }
  | { type: 'bossFire'; x: number }
  | { type: 'bossDead'; x: number; z: number }
  | { type: 'won' }
  | { type: 'lost' };

export interface GameState {
  level: Level;
  rngState: number;
  time: number;
  distance: number;
  phase: Phase;
  squad: Squad;
  entities: Entity[];
  bullets: Bullet[];
  projectiles: Projectile[];
  boss: Boss | null;
  nextSpawn: number;
  nextShot: number; // seconds until the squad's next bullet
  nextId: number;
  events: GameEvent[];
}

export interface Input {
  targetX: number;
}

export function createState(level: Level, seed: number): GameState {
  return {
    level,
    rngState: createRng(seed),
    time: 0,
    distance: 0,
    phase: 'advance',
    squad: { x: 0, vx: 0, count: level.startSquad, peak: level.startSquad },
    entities: [],
    bullets: [],
    projectiles: [],
    boss: null,
    nextSpawn: 0,
    nextShot: FIRE_INTERVAL / level.startSquad, // first shot after one average gap
    nextId: 1,
    events: [],
  };
}
