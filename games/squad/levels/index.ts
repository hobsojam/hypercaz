import { type Level, validateLevel } from '../sim/level.ts';

export interface LevelEntry {
  file: string;
  level: Level | null;
  error: string | null;
}

// Levels are numbered by file order: progress, unlocking and "Next" all rely
// on level N being the Nth file, so a level whose id disagrees is an error.
export function loadLevels(modules: Record<string, unknown>): LevelEntry[] {
  return Object.keys(modules)
    .sort()
    .map((path, index) => {
      const file = path.replace('./', '');
      try {
        const level = validateLevel(modules[path], file);
        if (level.id !== index + 1) {
          throw new Error(`${file}: id is ${level.id} but this is level ${index + 1} (levels are numbered in file order)`);
        }
        return { file, level, error: null };
      } catch (err) {
        return { file, level: null, error: err instanceof Error ? err.message : String(err) };
      }
    });
}

export const levels: LevelEntry[] = loadLevels(import.meta.glob('./*.json', { eager: true, import: 'default' }));
