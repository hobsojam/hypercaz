import { describe, expect, test } from 'vitest';
import { createStorage } from '../../engine/storage.ts';
import { BLAST_STORAGE, loadBest } from '../../games/blast/game.ts';
import { renderBlast, type BlastView } from '../../games/blast/render/draw.ts';
import { BAY, CELL, snapCell, TOUCH_LIFT, traySlotCentre, trayHit } from '../../games/blast/render/layout.ts';
import { emptyBoard } from '../../games/blast/sim/board.ts';
import { pieceById } from '../../games/blast/sim/pieces.ts';
import { createBlast } from '../../games/blast/sim/state.ts';
import { stubCtx } from '../squad/stubCtx.ts';

const p = pieceById;
const view = (over: Partial<BlastView> = {}): BlastView => ({ best: 0, time: 0, drag: null, hidden: new Set(), ...over });
const texts = (ctx: ReturnType<typeof stubCtx>) => (ctx.calls.fillText ?? []).map(([t]) => t);

describe('layout', () => {
  test('snapCell centres the piece on the pointer', () => {
    const sq2 = p('sq2');
    expect(snapCell(sq2, BAY.x + 2 * CELL, BAY.y + 2 * CELL, false)).toEqual({ col: 1, row: 1 });
    // On touch the piece floats 1.5 cells above the finger.
    expect(snapCell(sq2, BAY.x + 2 * CELL, BAY.y + 3 * CELL, true)).toEqual({ col: 1, row: 1 });
    expect(snapCell(sq2, BAY.x + 2 * CELL, BAY.y + 2 * CELL + TOUCH_LIFT, true)).toEqual({ col: 1, row: 1 });
  });

  test('trayHit finds slots and ignores gaps', () => {
    const s = createBlast(1);
    s.hand = [p('1x1'), p('h5'), p('sq3')];
    expect([0, 1, 2].map((slot) => trayHit(s, traySlotCentre(slot)))).toEqual([0, 1, 2]);
    expect(trayHit(s, { x: 270, y: 600 })).toBeNull();
    expect(trayHit(s, { x: 180, y: 800 })).toBeNull(); // between a single and a bar's end
    s.hand[1] = null;
    expect(trayHit(s, traySlotCentre(1))).toBeNull();
  });
});

describe('renderBlast', () => {
  test('draws score and best, and the streak from x2', () => {
    const s = createBlast(1);
    s.score = 1234;
    s.streak = 3;
    const ctx = stubCtx();
    renderBlast(ctx, s, view({ best: 99 }));
    expect(texts(ctx)).toEqual(expect.arrayContaining(['1234', 'Best: 99', '×3']));
    s.streak = 1;
    const one = stubCtx();
    renderBlast(one, s, view({ best: 99 }));
    expect(texts(one).some((t) => String(t).startsWith('×'))).toBe(false);
  });

  test('dims a tray piece that fits nowhere', () => {
    const s = createBlast(1);
    const roomy = stubCtx();
    s.board = emptyBoard();
    s.hand = [null, p('sq3'), null];
    renderBlast(roomy, s, view());
    expect((roomy.calls['=globalAlpha'] ?? []).some(([a]) => (a as number) < 1)).toBe(false);
    s.board = emptyBoard().fill(1);
    const full = stubCtx();
    renderBlast(full, s, view());
    expect((full.calls['=globalAlpha'] ?? []).some(([a]) => (a as number) < 1)).toBe(true);
  });

  test('draws the ghost and glow without throwing', () => {
    const s = createBlast(1);
    const ctx = stubCtx();
    const drag = { slot: 0, x: 200, y: 300, ghost: { col: 2, row: 1 }, glow: { rows: [1], cols: [2] } };
    expect(() => renderBlast(ctx, s, view({ drag, hidden: new Set(['0,0']) }))).not.toThrow();
  });

  test('hides crates that are animating away', () => {
    const s = createBlast(1);
    s.board = emptyBoard();
    s.board[0] = 1;
    const shown = stubCtx();
    renderBlast(shown, s, view());
    const hidden = stubCtx();
    renderBlast(hidden, s, view({ hidden: new Set(['0,0']) }));
    expect((hidden.calls.roundRect ?? []).length).toBeLessThan((shown.calls.roundRect ?? []).length);
  });
});

test('a corrupt best reads as 0', () => {
  const backend = { getItem: (k: string) => (k === `${BLAST_STORAGE}.best` ? 'x' : null), setItem: () => undefined };
  expect(loadBest(createStorage(BLAST_STORAGE, backend))).toBe(0);
});
