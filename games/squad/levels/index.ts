import { type Level, validateLevel } from '../sim/level.ts';

export interface LevelEntry {
  file: string;
  level: Level | null;
  error: string | null;
}

const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const levels: LevelEntry[] = Object.keys(modules)
  .sort()
  .map((path) => {
    const file = path.replace('./', '');
    try {
      return { file, level: validateLevel(modules[path], file), error: null };
    } catch (err) {
      return { file, level: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
