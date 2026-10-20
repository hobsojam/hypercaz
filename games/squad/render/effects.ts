// Turns simulation events into juice: particles, floating numbers, screen
// shake and sounds. Purely cosmetic.
import type { Sfx } from '../../../engine/audio.ts';
import { ParticlePool } from '../../../engine/particles.ts';
import { ease, tweenValue } from '../../../engine/tween.ts';
import type { GameEvent } from '../sim/state.ts';
import { label } from './draw.ts';

export interface Popup {
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
  amount: number;
  anchorY: number;
}

type ToScreen = (x: number, z: number) => { sx: number; sy: number };

const POPUP_LIFE = 0.8;
const POPUP_RISE = 60;
const GRAVITY = 900;
const CONFETTI = ['#F5C242', '#2F7DE1', '#E04040', '#7CFC6A', '#FFFFFF', '#FF8A1F'];
const TARGET_COLORS: Record<string, string> = { enemy: '#E04040', heavy: '#E04040', cage: '#F5C242', gate: '#F5C242', hazard: '#FF8A1F' };

export class Effects {
  private audio: { play(s: Sfx): void };
  private pool: ParticlePool;
  private list: Popup[] = [];
  private shakeMag = 0;
  private routineBudget = 16;
  private crowdKills = 0;
  private crowdWindow = 0;
  private celebrationCooldown = 0;
  private shakeVec = { x: 0, y: 0 };

  constructor(audio: { play(s: Sfx): void }, pool: ParticlePool = new ParticlePool(600)) {
    this.audio = audio;
    this.pool = pool;
  }

  handle(events: readonly GameEvent[], toScreen: ToScreen): void {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.audio.play('shot');
          break;
        case 'hit': {
          this.audio.play('hit');
          const p = toScreen(e.x, e.z);
          this.routineBurst(p.sx, p.sy - 20, '#FFFFFF');
          if (e.target === 'boss') this.kick(4);
          break;
        }
        case 'destroyed': {
          const p = toScreen(e.x, e.z);
          const color = TARGET_COLORS[e.target] ?? '#FFFFFF';
          if (e.target === 'enemy' || e.target === 'heavy') {
            this.routineBurst(p.sx, p.sy - 20, color);
            this.crowdKills++;
            if (this.crowdWindow === 0) this.crowdWindow = 0.25;
            if (this.crowdKills >= 8 && this.celebrationCooldown <= 0) {
              this.burst(p.sx, p.sy - 20, 12, (i) => CONFETTI[i % CONFETTI.length], 180, 0.6);
              this.crowdKills = 0;
              this.celebrationCooldown = 0.7;
            }
          } else {
            this.burst(p.sx, p.sy - 20, 12, (i) => (i % 2 === 0 ? color : CONFETTI[i % CONFETTI.length]), 220, 0.8);
          }
          break;
        }
        case 'gain':
        case 'lose': {
          const p = toScreen(e.x, e.z);
          const good = e.type === 'gain';
          this.addPopup(e.amount, good, p.sx, p.sy - 50);
          if (!good) this.routineBurst(p.sx, p.sy - 20, '#2F7DE1');
          this.audio.play(e.type);
          break;
        }
        case 'bossArrive':
          this.audio.play('boss');
          break;
        case 'bossWindup':
          this.audio.play('warn');
          break;
        case 'bossSummon':
          this.kick(3);
          this.audio.play('boss');
          break;
        case 'bossEnrage':
          this.kick(8);
          this.audio.play('boss');
          break;
        case 'bossDead': {
          const p = toScreen(e.x, e.z);
          this.kick(14);
          this.burst(p.sx, p.sy - 60, 60, (i) => CONFETTI[i % CONFETTI.length], 420, 1.4);
          this.audio.play('win');
          break;
        }
        case 'burstReady':
          this.audio.play('ready');
          break;
        case 'burstStart':
          this.kick(6);
          this.audio.play('burst');
          break;
        case 'lost':
          this.audio.play('fail');
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    this.routineBudget = Math.min(16, this.routineBudget + dt * 90);
    this.crowdWindow = Math.max(0, this.crowdWindow - dt);
    if (this.crowdWindow === 0) this.crowdKills = 0;
    this.celebrationCooldown = Math.max(0, this.celebrationCooldown - dt);
    this.pool.update(dt, GRAVITY);
    for (const p of this.list) p.age += dt;
    this.list = this.list.filter((p) => p.age < POPUP_LIFE);
    this.shakeMag *= Math.pow(0.85, dt * 60);
    if (this.shakeMag < 0.05) this.shakeMag = 0;
    const a = Math.random() * Math.PI * 2;
    this.shakeVec = { x: Math.cos(a) * this.shakeMag, y: Math.sin(a) * this.shakeMag };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.pool.forEach((p) => {
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * p.life);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    for (const p of this.list) {
      const t = p.age / POPUP_LIFE;
      ctx.globalAlpha = 1 - t * t;
      label(ctx, p.text, p.x, p.y - tweenValue(0, POPUP_RISE, t, ease.outCubic), 30, p.color);
    }
    ctx.globalAlpha = 1;
  }

  get shake(): { x: number; y: number } {
    return this.shakeVec;
  }

  get popups(): readonly Popup[] {
    return this.list;
  }

  private addPopup(amount: number, good: boolean, x: number, y: number): void {
    x = Math.max(48, Math.min(492, x));
    y = Math.max(180, Math.min(850, y));
    const color = good ? '#7CFC6A' : '#FF6B6B';
    const nearby = this.list.filter(p => Math.abs(p.x - x) < 48 && Math.abs(p.anchorY - y) < 36);
    const existing = nearby.find(p => p.color === color && p.age < 0.12);
    if (existing) {
      existing.amount += amount;
      existing.text = `${good ? '+' : '−'}${existing.amount}`;
      return;
    }
    // Keep gains and losses separate and stagger simultaneous reward numbers.
    const occupied = this.list.map(p => p.y - tweenValue(0, POPUP_RISE, p.age / POPUP_LIFE, ease.outCubic));
    let displayY = y;
    while (this.list.some((p, i) => Math.abs(p.x - x) < 80 && Math.abs(occupied[i] - displayY) < 32)) displayY -= 34;
    if (this.list.length >= 6) this.list.shift();
    this.list.push({ text: `${good ? '+' : '−'}${amount}`, x, y: displayY, anchorY: y, amount, age: 0, color });
  }

  private routineBurst(x: number, y: number, color: string): void {
    const count = Math.min(2, Math.floor(this.routineBudget));
    this.routineBudget -= count;
    this.burst(x, y, count, () => color, 100, 0.22);
  }

  private kick(mag: number): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private burst(x: number, y: number, n: number, color: (i: number) => string, speed: number, life: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.pool.emit({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.4),
        color: color(i),
        size: 5 + Math.random() * 5,
        spin: (Math.random() - 0.5) * 20,
      });
    }
  }
}
