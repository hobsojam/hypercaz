// Sprite manifest, loading and drawing. Any sprite that has no file yet (or
// fails to load) is drawn as a labelled coloured placeholder, so the game is
// always playable whatever state the art is in.

export type Group = 'player' | 'enemy' | 'bonus' | 'hazard' | 'scenery' | 'effect';

export interface AssetEntry {
  id: string;
  file: string | null;
  frameW: number;
  frameH: number;
  frames: number;
  fps: number;
  anchor: 'bottom' | 'center';
  group: Group;
}

export interface Manifest {
  version: 1;
  entries: AssetEntry[];
}

export const GROUP_COLORS: Record<Group, string> = {
  player: '#2F7DE1',
  enemy: '#E04040',
  bonus: '#F5C242',
  hazard: '#FF8A1F',
  scenery: '#4E9F3D',
  effect: '#FFFFFF',
};

const GROUPS = Object.keys(GROUP_COLORS) as Group[];

export function parseManifest(raw: unknown): Manifest {
  const fail = (path: string, problem: string): never => {
    throw new Error(`manifest: ${path} ${problem}`);
  };
  if (typeof raw !== 'object' || raw === null) fail('root', 'must be an object');
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) fail('version', 'must be 1');
  if (!Array.isArray(r.entries)) fail('entries', 'must be an array');
  const seen = new Set<string>();
  const entries = (r.entries as unknown[]).map((e, i): AssetEntry => {
    const p = `entries[${i}]`;
    if (typeof e !== 'object' || e === null) fail(p, 'must be an object');
    const o = e as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[a-z0-9_]+$/.test(o.id)) fail(`${p}.id`, 'must be snake_case');
    if (seen.has(o.id as string)) fail(`${p}.id`, `"${o.id}" is a duplicate`);
    seen.add(o.id as string);
    if (o.file !== null && (typeof o.file !== 'string' || !/^[a-z0-9_]+\.(png|svg)$/.test(o.file))) {
      fail(`${p}.file`, 'must be null or a snake_case .png/.svg file name');
    }
    for (const k of ['frameW', 'frameH', 'frames'] as const) {
      if (!Number.isInteger(o[k]) || (o[k] as number) < 1) fail(`${p}.${k}`, 'must be an integer >= 1');
    }
    if (typeof o.fps !== 'number' || o.fps < 0) fail(`${p}.fps`, 'must be a number >= 0');
    if (o.anchor !== 'bottom' && o.anchor !== 'center') fail(`${p}.anchor`, 'must be bottom or center');
    if (!GROUPS.includes(o.group as Group)) fail(`${p}.group`, `must be one of ${GROUPS.join(', ')}`);
    return o as unknown as AssetEntry;
  });
  return { version: 1, entries };
}

export function frameAt(entry: AssetEntry, time: number): number {
  if (entry.frames <= 1 || entry.fps <= 0) return 0;
  return Math.floor(time * entry.fps + 1e-9) % entry.frames;
}

export type UrlResolver = (file: string) => string | null;

// Maps manifest file names to bundler-produced URLs, e.g. from
// import.meta.glob('./assets/*.png', { query: '?url', import: 'default', eager: true }).
// Going through the bundler is what gets the files copied into the build.
export function urlResolver(urls: Record<string, string>, prefix: string): UrlResolver {
  return (file) => urls[prefix + file] ?? null;
}

export class AssetStore {
  private entries = new Map<string, AssetEntry>();
  private images = new Map<string, HTMLImageElement>();
  private warned = new Set<string>();

  static async load(manifest: Manifest, resolve: UrlResolver): Promise<AssetStore> {
    const store = new AssetStore();
    await Promise.all(
      manifest.entries.map(async (e) => {
        store.entries.set(e.id, e);
        if (!e.file) return;
        const url = resolve(e.file);
        if (!url) {
          console.warn(`asset ${e.id}: ${e.file} not found in the build, using placeholder`);
          return;
        }
        const img = new Image();
        img.src = url;
        try {
          await img.decode();
          store.images.set(e.id, img);
        } catch {
          console.warn(`asset ${e.id}: failed to load ${e.file}, using placeholder`);
        }
      }),
    );
    return store;
  }

  static fromManifest(manifest: Manifest): AssetStore {
    const store = new AssetStore();
    for (const e of manifest.entries) store.entries.set(e.id, e);
    return store;
  }

  entry(id: string): AssetEntry | undefined {
    return this.entries.get(id);
  }

  image(id: string): HTMLImageElement | null {
    return this.images.get(id) ?? null;
  }

  warnOnce(id: string, message: string): void {
    if (this.warned.has(id)) return;
    this.warned.add(id);
    console.warn(message);
  }
}

export interface DrawOpts {
  stretchX?: number;
  flash?: number;
  alpha?: number;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  store: AssetStore,
  id: string,
  time: number,
  sx: number,
  sy: number,
  scale: number,
  opts: DrawOpts = {},
): void {
  const entry = store.entry(id);
  if (!entry) {
    store.warnOnce(id, `unknown sprite id: ${id}`);
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(sx - 10 * scale, sy - 20 * scale, 20 * scale, 20 * scale);
    return;
  }
  const w = (entry.frameW / 2) * scale * (opts.stretchX ?? 1);
  const h = (entry.frameH / 2) * scale;
  const x = sx - w / 2;
  const y = entry.anchor === 'bottom' ? sy - h : sy - h / 2;
  const flash = Math.min(1, (opts.flash ?? 0) * 10);
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  const img = store.image(id);
  if (img) {
    if (flash > 0) ctx.filter = `brightness(${1 + flash * 2})`;
    ctx.drawImage(img, frameAt(entry, time) * entry.frameW, 0, entry.frameW, entry.frameH, x, y, w, h);
  } else {
    drawPlaceholder(ctx, entry, x, y, w, h, flash);
  }
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, entry: AssetEntry, x: number, y: number, w: number, h: number, flash: number): void {
  ctx.fillStyle = flash > 0.5 ? '#FFFFFF' : GROUP_COLORS[entry.group];
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.06);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.2);
  ctx.fill();
  ctx.stroke();
  if (h >= 20 && w >= 30) {
    ctx.fillStyle = '#1A1A2E';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.id, x + w / 2, y + h / 2, w - 4);
  }
}
