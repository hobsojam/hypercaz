import { createRng } from '../../../engine/rng.ts';
import { FIRE_INTERVAL, SIZES } from './constants.ts';
import type { HazardKind, Level, Spawn, SpawnType } from './level.ts';

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
  x: number; // landing lane, fixed when fired
  z: number; // distance remaining to the squad
  originX: number;
  originZ: number;
}

export interface Boss {
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  fireTimer: number;
  summonTimer: number;
  enraged: boolean;
  charging: boolean; // in the warning window before a volley
  flash: number;
}

export type LossCause = 'enemy' | 'heavy' | 'gate' | HazardKind | 'bossShot' | 'bossContact';
export type LossEvent = { type: 'lose'; amount: number; x: number; z: number; cause?: LossCause };

export type GameEvent =
  | { type: 'shot'; x: number; z: number }
  | { type: 'hit'; x: number; z: number; target: SpawnType | 'boss' }
  | { type: 'destroyed'; x: number; z: number; target: SpawnType }
  | { type: 'gain'; amount: number; x: number; z: number }
  | LossEvent
  | { type: 'bossArrive' }
  | { type: 'bossFire'; x: number }
  | { type: 'bossWindup' }
  | { type: 'bossSummon'; x: number }
  | { type: 'bossEnrage' }
  | { type: 'burstReady' }
  | { type: 'burstStart' }
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
  meter: number; // kill-meter charge, up to level.burstKills
  burstTime: number; // seconds of rapid fire left
  nextId: number;
  events: GameEvent[];
}

export interface Input {
  targetX: number;
  burst?: boolean; // spend a full kill meter on rapid fire
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
    meter: 0,
    burstTime: 0,
    nextId: 1,
    events: [],
  };
}

// `z` is the entity's distance ahead of the squad right now.
export function spawnEntity(state: GameState, s: Spawn, z: number): Entity {
  const halfW = s.type === 'gate' || s.type === 'hazard' ? s.width / 2 : SIZES[s.type].halfW;
  return {
    id: state.nextId++,
    type: s.type,
    x: s.x,
    z,
    hp: s.hp,
    value: s.value,
    halfW,
    halfD: SIZES[s.type].halfD,
    kind: s.kind,
    kills: s.kills,
    max: s.max,
    resolved: false,
    flash: 0,
  };
}
