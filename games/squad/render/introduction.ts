// First-run guidance follows real recruitment and burst events; it never
// pauses play or changes the simulation.
import { DEFAULT_VIEW } from '../../../engine/perspective.ts';
import type { GameState } from '../sim/state.ts';
import { drawCenteredText } from '../ui.ts';
import { BURST_BUTTON } from './draw.ts';
import { projectPlayfieldPoint } from './projection.ts';

interface Hint {
  title: string;
  detail: string;
  footer?: string;
  highlight?: 'rescue' | 'burst';
}

export class Introduction {
  private firstRecruit: { amount: number; time: number } | null = null;
  private burstAt: number | null = null;

  update(state: GameState): void {
    for (const event of state.events) {
      if (event.type === 'gain' && !this.firstRecruit) this.firstRecruit = { amount: event.amount, time: state.time };
      if (event.type === 'burstStart' && this.burstAt === null) this.burstAt = state.time;
    }
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState, touch: boolean): void {
    const hint = this.hint(state, touch);
    if (!hint) return;
    ctx.save();
    ctx.fillStyle = 'rgba(26,26,46,0.86)';
    ctx.beginPath();
    ctx.roundRect(32, 170, 476, hint.footer ? 112 : 88, 14);
    ctx.fill();
    drawCenteredText(ctx, hint.title, 270, 196, 24, '#F5C242');
    drawCenteredText(ctx, hint.detail, 270, 228, 20);
    if (hint.footer) drawCenteredText(ctx, hint.footer, 270, 256, 18);
    if (hint.highlight === 'rescue') drawRescueHighlight(ctx, state);
    if (hint.highlight === 'burst') {
      const { x, y, w, h } = BURST_BUTTON;
      ctx.strokeStyle = '#F5C242';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x - 5, y - 5, w + 10, h + 10, 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  private hint(state: GameState, touch: boolean): Hint | null {
    if (state.phase === 'won' || state.phase === 'lost') return null;
    if (this.burstAt !== null) {
      return state.time - this.burstAt < 2
        ? { title: 'Rapid Fire!', detail: 'Faster shots for a few seconds.' }
        : null;
    }
    if (state.meter >= state.level.burstKills) {
      const crowdAhead = state.entities.some(e => (e.type === 'enemy' || e.type === 'heavy') && e.z > 0 && e.z < 45);
      if (!crowdAhead) return { title: 'Rapid Fire charged', detail: 'Save it for the next red crowd.' };
      return {
        title: 'Rapid Fire is ready',
        detail: touch ? 'Tap the orange Rapid Fire bar above.' : 'Press Space or click the orange bar.',
        highlight: 'burst',
      };
    }
    if (!this.firstRecruit) {
      return {
        title: 'Aim at a cage',
        detail: touch ? 'Drag left or right to aim.' : 'Use ← → / A D, or move your mouse.',
        footer: 'Your squad shoots automatically.',
        highlight: 'rescue',
      };
    }
    if (state.time - this.firstRecruit.time < 2) {
      return { title: `+${this.firstRecruit.amount} recruits!`, detail: 'More soldiers mean more shots.' };
    }
    return { title: 'Charge Rapid Fire', detail: 'Aim at red crowds to fill the orange bar.' };
  }
}

function drawRescueHighlight(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cage = state.entities.find(e => e.type === 'cage' && e.z > 0);
  if (!cage) return;
  const p = projectPlayfieldPoint(DEFAULT_VIEW, cage.x, cage.z);
  ctx.strokeStyle = '#F5C242';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(p.sx - 38 * p.scale, p.sy - 85 * p.scale, 76 * p.scale, 86 * p.scale, 8);
  ctx.stroke();
}
