// Fixed-capacity particle pool: no allocation after construction; when full,
// the oldest particle is overwritten.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  spin: number;
}

export class ParticlePool {
  private items: Particle[];
  private alive: boolean[];
  private next = 0;
  private live = 0;

  constructor(capacity: number) {
    this.items = Array.from({ length: capacity }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0, spin: 0 }));
    this.alive = new Array<boolean>(capacity).fill(false);
  }

  emit(p: Omit<Particle, 'maxLife'>): void {
    const i = this.next;
    this.next = (this.next + 1) % this.items.length;
    if (!this.alive[i]) this.live++;
    this.alive[i] = true;
    Object.assign(this.items[i], p, { maxLife: p.life });
  }

  update(dt: number, gravity: number): void {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.alive[i]) continue;
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.alive[i] = false;
        this.live--;
        continue;
      }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  forEach(fn: (p: Particle) => void): void {
    for (let i = 0; i < this.items.length; i++) if (this.alive[i]) fn(this.items[i]);
  }

  get count(): number {
    return this.live;
  }
}
