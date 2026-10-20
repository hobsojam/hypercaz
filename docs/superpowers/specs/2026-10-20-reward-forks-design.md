# Reward forks: design

Issue: #23. This is the prototype the issue asks for: two or three readable choices in one level, before expanding to the rest.

## Intent

Today a good player collects every cage and fights every crowd, so a level's only question is "can my squad keep up". A fork is a moment where the player **can't have everything** and must pick. Each option has a real reason to choose it, and the right pick depends on how strong the squad is and whether Rapid Fire is ready.

## The two forks (from the conversation)

### Twin cages
- **Layout:** two cages arrive together, on opposite sides of the road, far enough apart that aiming at one never hits the other.
- **The small cage** breaks quickly and holds few soldiers.
- **The big cage** holds roughly two and a half times as many soldiers but takes far more hits.
- **The trade:** time spent on one is time not spent on the other. The squad can break either cage alone before it scrolls past, but not both. Rapid Fire can break both.
- **What a miss costs:** only the soldiers in that cage. That's how cages already work.

### Guarded cage
- **Layout:** a crowd comes down one side of the road while a cage sits on the other side.
- **Going for the cage** leaves the crowd unshot. Crowds already close in on the squad, so it costs soldiers when it arrives.
- **Fighting the crowd** means the cage scrolls past.
- **Rapid Fire** can open the cage quickly or clear the crowd quickly, but not both.

## The prototype level (my call)

**Level 6, "Pincer".** Its name already promises this kind of play. Three fork moments replace some of its current cage-and-crowd beats:

1. **Twin cages, early.** No threat around them, so this teaches the idea: pick one.
2. **Guarded cage, mid-level.** The crowd is big enough that ignoring it costs about as many soldiers as the cage gives. Clearing part of the crowd first and then turning to the cage is the skilful route.
3. **Twin cages with the meter about full, followed closely by a big crowd.** Using Rapid Fire now gets both cages but leaves you meeting the crowd without it. Saving it means giving up the big cage. This is the issue's "use Rapid Fire now or save it" choice.

The rest of level 6 stays as it is: gates, hazards, the Strafer boss. HP, values and stars are retuned so the level is still winnable.

## Numbers (left to the builder, with these targets)

- **Tune against the bot's squad at that moment.** The squad size at each fork is whatever the bot brings there on seeds 1–3.
- **Twin cages:**
  - With normal fire, each cage alone can be broken before it passes; both together can't. Margin: at least 20% either way.
  - With Rapid Fire, both can be broken.
- **Guarded cage:** ignoring the crowd to take the cage, and clearing the crowd while letting the cage pass, end within about 30% of each other in soldiers. The mixed route (clear part, then the cage) does better than either.
- **The crowd has to be able to reach the cage (my call).** Crowds only drift toward the squad at about 0.15 road-widths per second, and only within 30 m. A crowd confined to the far side would slide past a squad parked at the cage, and ignoring it would cost nothing. So the guarded cage's crowd is wide enough, or placed close enough to the middle, that its edge overlaps the cage's lane when it arrives. A fork test checks that ignoring it really costs soldiers.
- **Placement:** forks keep cages at x ≈ ±0.5 and are far enough from the gates and hazards around them that the fork is the only thing on screen to decide about.

## Bot

- **Twin cages:** the bot picks the higher-value cage it can still break in time, and doesn't switch once committed.
- **Rapid Fire:** the existing rule ("burst on a cage I'm lined up on but can't break in time") already covers using it on the big cage.
- **No cleverness required:** the bot doesn't have to find the best route. It only has to win level 6 on seeds 1–3, with 2 stars, like every level.

## Tests

- **Every level:** the existing checks keep passing. The bot wins every level on seeds 1–3 with 2 stars, and standing still loses.
- **Fork tests.** Run level 6 with the bot up to each fork, copy the game state, then play through that fork with fixed routes and compare soldiers once it has passed:
  - **Twin cages:** the small route and the big route each collect their cage. Trying both without Rapid Fire collects at most one. With Rapid Fire, both are collected.
  - **Twin cages:** the big route is worth more than the small route, and the small route is never a loss, so each has a reason.
  - **Guarded cage:** "cage only" and "crowd only" both survive, and neither beats the other by more than about 30%.
  - **Fork 3:** using Rapid Fire on the cages and saving it for the crowd both win the level from that point.
- **Browser:** screenshots of each fork at phone size in headless Chromium, to check both options and their numbers are readable at a glance.
- **Real players:** whether the choices feel like choices is your playtest.

## Not doing (for now)

- **Other levels:** forks in other levels and level 7 "Iron Wall" come after your playtest of level 6.
- **No new engine pieces:** no new enemy or reward types, no new drawing, no new sounds.
- **No progression systems:** no currencies, upgrades or anything that carries between runs.
- **Names:** level names stay as they are (you said they're a nice-to-have).
