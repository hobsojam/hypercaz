# Arrow Escape

A calm removal-order puzzle for Hypercaz. A flat board contains arrows occupying continuous, unbranched grid paths. Tap an arrow whose path is clear to unthread it from the board; remove every arrow to clear the puzzle. Existing arrows are the only blockers, and heads cannot rotate, change their exit direction or move backward. A valid removal never makes the remaining puzzle harder or unsolvable. The distinct car/repositioning concept is recorded in GitHub issue #40.

## Scope and feel

Ship 12 fixed, independently verified puzzles, beginning with small boards that teach direction, blockers and long shafts, then introducing an L shape in puzzle 3, two bends in puzzle 4, and denser mixed layouts. Existing puzzle ids and saved completion remain intact. Board size ranges from 4×4 to 8×8. Every puzzle is selectable. No timers, lives, currency, ads, dependencies or raster assets. Native canvas arrows and a restrained cream/teal palette keep the paths readable on phones.

An arrow is identified by a stable id, a cardinal head direction and a readonly sequence of occupied cells ordered from tail to head. Each consecutive pair is orthogonally adjacent; the final segment agrees with the head direction. Paths cannot overlap, revisit a cell or point back into their own bodies. Its exit ray starts immediately beyond the head and stops at the board edge. Any occupied cell on that ray blocks removal, including another arrow's shaft. Off-row, behind-head and removed arrows do not block it. Malformed, overlapping and cyclic layouts must be rejected before play.

A blocked attempt leaves the puzzle unchanged and briefly marks the arrow, its first blocker and the blocked path. A successful head moves forward along its exit ray, while the tail advances along the original path with constant arc length, straightening as it leaves. The whole tail clears the edge before play continues. Input does not remove another arrow during this short exit animation. The final animation finishes before the success panel appears. A free Hint highlights one legal arrow without removing it. Retry clears transient state; completed puzzles stay completed. Progress records completion only, so experimentation is not penalized.

## Flow and controls

Start on the first incomplete puzzle, or puzzle one when all are complete. The game exposes a Puzzles grid, Retry, Hint, Pause, mute and All games. Success offers Next (or Puzzles after the last puzzle). Pointer/touch activates the arrow beneath any of its cells. Keyboard arrow keys move a visible cell cursor, Enter/Space tries its arrow, H hints, R retries, Escape pauses/resumes. The grid uses arrows and Enter/Space. A hidden tab pauses; resume is explicit. Pausing freezes visual flight and board input; mute and navigation remain available.

Use the existing engine boot, input, controls, audio, loop, UI and storage conventions. Keep game rules and session independent of the DOM. Publish a proper `/arrows/` entry, picker tile with cleared-puzzle count, production bundle and offline precache route. Save under `hypercaz.arrows`; sanitize progress against the actual puzzle ids and persist mute. Add an accessible canvas label and a live status element updated only when the message changes. No shared engine modifications are planned.

## Verification

Tests cover all four exit rays, shaft blockers, first blockers, missing/already removed arrows, blocked no-op, legal removal and final clear, validation failures and an independent cell-based solver for all 12 layouts. Validate that any available legal move preserves solvability. Session/control tests pin animation input lock, repeated completion, retry/select resets, hints, pause/hide, keyboard focus, muted/blocked storage and corrupt progress. Rendering and layout checks pin phone-sized hit areas and screen flows. Build, lint, full repository suite and real phone/desktop browser checks verify picker launch, pointer/keyboard wins, return progress and offline loading. Independently review the final branch and resolve material findings before publishing a PR.
