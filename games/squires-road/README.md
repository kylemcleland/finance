# Squire's Road

A mobile-first, live-action medieval tournament RPG. You explore Pokémon-style
towns and routes, and fight live sword duels, first-person jousts and archery
contests to earn the three Seals and win the Grand Tourney.

* Play: open `dist/index.html` in a browser (it is one self-contained file; saves go to localStorage).
* Build: `node build.mjs` (add `--artifact --out dist/artifact.html` for the claude.ai artifact page).
* Test: `node test/run.mjs --script test/smoke.mjs` (map tour plus every battle type)
  and `node test/run.mjs --script test/content/story.mjs` (the whole story, from opening to credits).
* Design and module contract: `DESIGN.md`.

Controls: the left thumb moves (an invisible floating stick). Tap the right side
to talk or strike, hold it to block (well-timed = parry), and flick it to dodge.
Joust: tap the right side in rhythm to spur, drag the left side to aim, and tap
as the ring closes. Archery: hold the right side to draw, drag the left side to
aim, and release to loose. Keyboard: arrows/WASD, Z strike, X block, C dodge,
Esc menu.
