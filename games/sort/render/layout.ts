// Where the tubes and buttons go in a window of any size. Tubes fill the space
// between a HUD band at the top and a button band at the bottom, in centred
// rows (see rowsFor).
import { controlRects, hitRect, type Rect } from '../../../engine/controls.ts';

export const TOP_BAND = 70;
export const BOTTOM_BAND = 90;
const MAX_W = 80;
const MIN_W = 44;
const RATIO = 3.6; // tube height / width
const GAP = 0.6; // gap between tubes, and between rows, in tube widths
export const LIFT = 0.3; // how far a lifted tube rises, in tube widths
const SIDE = 24; // margin at the window's left and right
const HIT_SLOP = 10;

// The widest tube that fits `count` tubes into `rows` rows.
function widthFor(count: number, rows: number, w: number, h: number): number {
  const perRow = Math.ceil(count / rows);
  const across = (w - 2 * SIDE) / (perRow + GAP * (perRow - 1));
  // A lifted tube in the top row rises into the space above it.
  const down = (h - TOP_BAND - BOTTOM_BAND) / (rows * RATIO + (rows - 1) * GAP + LIFT);
  // Never below a drawable width, even when the window is too small to fit the tubes.
  return Math.max(8, Math.floor(Math.min(MAX_W, across, down)));
}

// Landscape: one row whenever the tubes can be MIN_W wide, else as few rows as
// keep them that wide. Portrait (an upright phone): one row would leave the
// tubes small with the height unused, so take the rows that give the biggest
// tubes, the fewest on a tie.
function rowsFor(count: number, w: number, h: number): number {
  const portrait = h > w;
  let best = 1;
  for (let rows = 1; rows <= count; rows++) {
    const tw = widthFor(count, rows, w, h);
    if (!portrait && tw >= MIN_W) return rows;
    if (tw > widthFor(count, best, w, h)) best = rows;
  }
  return best; // also a tiny landscape window: whatever gives the biggest tubes
}

export function layoutTubes(count: number, w: number, h: number): Rect[] {
  if (count === 0) return [];
  const rows = rowsFor(count, w, h);
  const tw = widthFor(count, rows, w, h);
  const th = tw * RATIO;
  const gap = tw * GAP;
  const block = rows * th + (rows - 1) * gap;
  const lift = tw * LIFT;
  const top = TOP_BAND + lift + (h - TOP_BAND - BOTTOM_BAND - lift - block) / 2;
  const rects: Rect[] = [];
  // Spread evenly: the first rows take one extra tube when it does not divide.
  const base = Math.floor(count / rows);
  const extra = count % rows;
  for (let r = 0; r < rows; r++) {
    const inRow = base + (r < extra ? 1 : 0);
    const rowW = inRow * tw + (inRow - 1) * gap;
    const left = (w - rowW) / 2;
    for (let i = 0; i < inRow; i++) rects.push({ x: left + i * (tw + gap), y: top + r * (th + gap), w: tw, h: th });
  }
  return rects;
}

const BUTTON_W = 128;
const BUTTON_H = 44;

// Undo and Restart, side by side at the bottom centre.
export function buttonRects(w: number, h: number): { undo: Rect; restart: Rect } {
  const y = h - BUTTON_H - 14;
  return {
    undo: { x: w / 2 - 8 - BUTTON_W, y, w: BUTTON_W, h: BUTTON_H },
    restart: { x: w / 2 + 8, y, w: BUTTON_W, h: BUTTON_H },
  };
}

// The symbols on/off button, just left of pause.
export function symbolsRect(w: number): Rect {
  const { pause } = controlRects(w);
  return { x: pause.x - pause.w - 6, y: pause.y, w: pause.w, h: pause.h };
}

export function tubeAt(rects: readonly Rect[], x: number, y: number): number | null {
  const i = rects.findIndex((r) => hitRect(r, { x, y }, HIT_SLOP));
  return i < 0 ? null : i;
}
