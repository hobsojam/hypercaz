import type { Level } from './level.ts';

export function starsFor(level: Level, won: boolean, finalCount: number): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  return (1 + (finalCount >= level.stars[0] ? 1 : 0) + (finalCount >= level.stars[1] ? 1 : 0)) as 1 | 2 | 3;
}
