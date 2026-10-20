import { AssetStore, parseManifest } from '../../engine/assets.ts';
import source from '../squad/assets/manifest.json';
import cage from '../squad/assets/cage.png?url';
import broken from '../squad/assets/cage_broken.png?url';
import soldier from '../squad/assets/soldier_run.png?url';

const selected = new Set(['cage', 'cage_broken', 'soldier_run']);
export const MANIFEST = parseManifest({ version: 1, entries: source.entries.filter(e => selected.has(e.id)) });
const urls: Record<string, string> = { 'cage.png': cage, 'cage_broken.png': broken, 'soldier_run.png': soldier };
export const loadAssets = () => AssetStore.load(MANIFEST, file => urls[file] ?? null);
