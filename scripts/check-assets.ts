// Validates an assets directory against its manifest.json:
// every non-null file exists with the right pixel size, and nothing unlisted.
// Usage: node scripts/check-assets.ts <assets-dir>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseManifest } from '../engine/assets.ts';

function imageSize(path: string): { w: number; h: number } | null {
  const buf = readFileSync(path);
  if (path.endsWith('.png')) {
    if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  const root = /<svg\b[^>]*>/.exec(buf.toString('utf8'))?.[0] ?? '';
  const w = /\bwidth="(\d+(?:\.\d+)?)(?:px)?"/.exec(root)?.[1];
  const h = /\bheight="(\d+(?:\.\d+)?)(?:px)?"/.exec(root)?.[1];
  return w && h ? { w: Number(w), h: Number(h) } : null;
}

export function checkAssets(dir: string): string[] {
  const problems: string[] = [];
  let manifest;
  try {
    manifest = parseManifest(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')));
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)];
  }
  const listed = new Set<string>();
  for (const e of manifest.entries) {
    if (!e.file) continue;
    listed.add(e.file);
    const path = join(dir, e.file);
    if (!existsSync(path)) {
      problems.push(`missing file: ${e.file}`);
      continue;
    }
    const size = imageSize(path);
    const want = `${e.frameW * e.frames}x${e.frameH}`;
    if (!size) problems.push(`${e.file}: could not read image size`);
    else if (`${size.w}x${size.h}` !== want) problems.push(`${e.file}: expected ${want}, got ${size.w}x${size.h}`);
  }
  for (const f of readdirSync(dir).sort()) {
    if (f !== 'manifest.json' && !listed.has(f)) problems.push(`unlisted file: ${f}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? 'games/squad/assets';
  const problems = checkAssets(dir);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  const manifest = parseManifest(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')));
  const files = manifest.entries.filter((e) => e.file).length;
  console.log(`assets OK (${files} files, ${manifest.entries.length} entries)`);
}
