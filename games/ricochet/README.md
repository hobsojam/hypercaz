# Ricochet Rescue

Eight small bank-shot rescue puzzles. Drag to aim, release to fire, and free every caged soldier. Cages stay rescued between shots; Retry starts a fresh attempt. Three stars mean finishing at par or better, two mean one shot over par, and one means rescuing everyone within the remaining budget. Every puzzle is available from the Puzzles screen.

This is a standalone game. The shared game picker, root page, engine and PWA build are intentionally untouched; picker wiring belongs to the later integration work.

## Play locally

From the repository root:

```bash
npm ci
npm run dev
```

Open `/games/ricochet/` on the URL Vite prints. The existing root game is unchanged.

## Controls

- Drag anywhere in the courtyard to aim upward, then release to fire. A tap at a valid aim point also fires.
- Release outside the courtyard or below the launcher to cancel. Canceling a touch gesture never spends a shot.
- Left/right arrows adjust aim; hold Shift for fine adjustment. Space fires.
- R retries, Escape pauses/resumes, M toggles sound. Enter opens the next puzzle after winning.
- In the puzzle grid, arrows choose a card and Enter opens it. Every puzzle is selectable.
- The ball banks off side/top walls and teal obstacles. The bottom returns it; eight banks also return it so a shot cannot loop forever. The dotted preview shows the path through the first two banks.
- Switching tabs or moving focus away pauses play. Resume explicitly to continue.

## Standalone build

```bash
npx vite build --config games/ricochet/vite.config.ts
```

The output is `games/ricochet/dist/` and can be served as a static site. To use a temporary output directory:

```bash
npx vite build --config games/ricochet/vite.config.ts --outDir /tmp/hypercaz-ricochet-dist
```

The root `npm run build` still builds the existing application; adding this game to that build is deferred with picker integration.

## Mount contract for later integration

```ts
import { mountRicochet } from './games/ricochet/mount.ts';

const dispose = await mountRicochet(canvas, {
  onStatus: message => { liveRegion.textContent = message; },
  onError: error => { console.error(error); },
});
// Before navigating away:
dispose();
```

Give the canvas its display size with CSS. The mount handles letterboxing, device pixel ratio, resizing, scoped input and pause-on-hide. Its idempotent disposer stops animation, removes listeners, releases pointer capture, restores the canvas focus/touch settings and silences its audio. Options can supply an AssetStore, audio adapter or namespaced storage adapter. Best stars and mute use `hypercaz.ricochet.progress` by default, separate from Squad Shooter.

Selected existing cage, broken-cage and soldier sprites are bundled by URL import. The game has no new dependencies and uses only the existing engine's asset, sound, loop, letterbox and storage helpers.

## Verification

```bash
npm test -- tests/ricochet
npm test
npm run build
npm run lint
```

`tests/ricochet/levels.test.ts` contains independent shot sequences that solve all eight puzzles at par through the real simulation. Physics tests cover continuous collisions, banks, rescue chains, preview agreement, shot limits and scoring. Session/input/mount tests cover retry, pause, canceled and multiple-pointer gestures, persistence and teardown.
