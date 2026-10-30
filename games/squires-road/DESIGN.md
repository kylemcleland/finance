# Squire's Road — design & build contract

A mobile-first, live-action medieval tournament RPG. You explore a top-down,
tile-based open world (Pokémon-style towns and routes). You start in the
village of **Thornbrook** with nothing but a wooden stick. You grow stronger by
fighting live battles in the wild and in tournament halls. Each town's hall
specializes in one discipline: **Sword**, **Archery** or **Joust**. Earn the
three Seals and win the **Grand Tourney** at Crownhold.

Everything runs in one HTML file with no dependencies. All art is drawn
procedurally on a canvas, and all sound is synthesized with WebAudio.

---------------------------------------------------------------------------

## 1. Layout & build

```
games/squires-road/
  DESIGN.md          this file
  build.mjs          node build.mjs → dist/index.html (one self-contained file)
  dist/index.html    built game (committed)
  src/core/*.js      engine core (owner: lead)
  src/data/*.js      shared data: items, perks, enemy/opponent rosters
  src/game/*.js      state, commands, menus, shops, tournaments
  src/world/*.js     overworld engine + tile art
  src/content/*.js   maps, NPCs, story scripts, encounter tables
  src/battle/*.js    live battle scenes (sword, joust, archery)
  src/main.js        boot, title screen, main loop (owner: lead)
```

* Plain browser JS, **no modules, no imports**. Every file is wrapped in an
  IIFE: `(() => { ... })();`. It registers what it defines on the global `G`.
* Load order: `core/` (fixed order), then `data/`, `game/`, `world/`,
  `content/`, `battle/` (alphabetical inside each), then `main.js`.
* **At load time a file may only read `G.U`, `G.gfx`, `G.draw` and other core
  objects, or write to `G`.** Never call another non-core module at load time.
  The order between non-core files must not matter.
* To build, run `node games/squires-road/build.mjs`. It also syntax-checks
  every file.
* To test, run `node games/squires-road/test/smoke.mjs`. It runs a Playwright
  smoke test against `dist/index.html`.
  `G.debug` hooks exist for tests. See §10.

## 2. Screen, coordinates, rendering

* The canvas fills the window. Scenes draw in **logical pixels**. `G.W` × `G.H`
  is the logical view size. It changes on resize and rotation. The short side
  is always ≥ 180 logical px. Portrait is the primary target; landscape must
  also work. **Never assume a fixed W/H.** Lay out relative to `G.W`/`G.H`.
* `ctx` is already scaled so 1 unit = 1 logical px, and image smoothing is
  off. Text is drawn as vector text through the scaled transform, so it stays
  crisp. Use `G.draw.text`.
* Tile size `G.TILE = 16`.
* The palette is warm and saturated pixel art. Use `G.PAL` for shared UI colors.

## 3. Input — the invisible joypad (core/input.js)

Pointer input is split into two zones by screen half: **L** (x < W/2) and
**R** (x ≥ W/2). Nothing is drawn by default. A faint ring appears under the
left thumb while the stick is active.

* **Left zone = floating joystick.** Its origin is wherever the thumb lands,
  with a 22 px radius. `G.input.stick` → `{x, y, mag, active}`, where x and y
  range over −1..1. Keyboard WASD/arrows also drive the stick.
  `G.input.dir4()` → `'up'|'down'|'left'|'right'|null` (dead zone 0.35).
* **Right zone = action gestures.** Each frame, `G.input.events` is a list of:
  * `{type:'down', zone, x, y, id}`
  * `{type:'up', zone, x, y, id, dur, dist, cancelled}`: cancelled is true for pointercancel or window blur (never a tap)
  * `{type:'tap', zone, x, y}`: up with dur < 260 ms and dist < 12 px
  * `{type:'hold', zone, x, y, id}`: once, when held ≥ 200 ms and dist < 12
  * `{type:'flick', zone, dx, dy, x, y}`: once per pointer, when it moves
    ≥ 20 px within 240 ms of down. dx and dy are normalized.
  * Keyboard: `{type:'key', key, down}` with virtual keys
    `a` (Z, J, Space, Enter), `b` (X, K), `c` (C, L, Shift), `menu` (Esc, M).
* Helpers:
  * `G.input.pressed('a'|'b'|'c'|'menu')`: true on the frame it went down.
    Keyboard only, except that a **R-zone tap** also counts as `pressed('a')`
    at the moment of the tap.
  * `G.input.down(k)` is the held state. A held R-zone pointer counts as
    `down('a')`.
  * `G.input.rHold()` → `{x, y, dur, dist, id, startX, startY}` or `null`.
    This is the longest-held active R-zone pointer.
  * `G.input.lHold()` is the same for L, and also gives raw drag (dx/dy from
    its origin).
  * `G.input.consumeTap(rect)` → the tap inside rect, or null. It removes that
    tap so nothing else sees it. Rect is `{x, y, w, h}` in logical px. Use it
    for UI buttons. It works in **both** zones.
  * `G.input.anyTap()` is true if any tap (or `a`/`b` keypress) happened this
    frame. Use it to advance dialogs.
* Events are cleared at the end of every frame by the main loop.
* Battle scenes interpret gestures their own way, and each **must show a short
  control hint** the first few seconds (e.g. "Left: move • Tap right: strike
  • Hold right: block • Flick right: dodge").

## 4. Scenes (core/scenes.js)

`G.scenes` is a stack. Only the top scene gets `update`. All scenes from the
top down to the first one with `opaque !== false` get `draw`, bottom first.

```
scene = { name, opaque?:true, enter?(), exit?(), update(dt), draw(ctx), resize?() }
G.scenes.push(scene) / pop() / replace(scene) / top()
G.scenes.fade(fn, {color:'#000', ms:300}) → Promise   // fade out, fn(), fade in
G.scenes.flash(times)                                 // battle-start flash effect
```

`dt` is in **seconds** and clamped to ≤ 1/20. The dialog/UI layer (`G.ui`) is
drawn above all scenes. While it is blocking, scene `update` still runs, and
scenes should check `G.ui.busy()` before reading movement or action input.

## 5. Core services

* `G.U`: math helpers: `clamp, lerp, rand, randi, pick, chance, dist, angle,
  approach, ease.*, shuffle, wrapText, sign`.
* `G.draw`: `text(str, x, y, {size=8, color, align, baseline, bold, shadow,
  maxW})`, `rect, rrect(x,y,w,h,r,fill,stroke), bar(x,y,w,h,frac,fg,bg),
  panel(x,y,w,h)` (the standard parchment UI panel), `button(x,y,w,h,label,
  opts)` (draws and returns true if tapped this frame; uses `consumeTap`),
  `circle, line, shadow(x,y,w)`.
* `G.chars.draw(ctx, look, dir, frame, x, y, scale=1)` draws a character. It
  uses a 16×20 frame anchored at **bottom-center = (x, y)**. `dir` is one of
  `'down'|'up'|'left'|'right'`, and `frame` is 0 (stand), 1 or 2 (walk).
  `look` is `{skin, hair, hairStyle:'short'|'long'|'bald'|'spiky',
  tunic, tunic2?, pants, boots, helmet?:color, plume?:color, cape?:color,
  beard?:color, hat?:color, hood?:color, apron?:color, crown?:bool,
  dress?:bool}`. Use `G.looks[name]` for presets.
* `G.sfx.play(name)`: `'step','hit','clang','swing','block','parry','dodge',
  'hurt','coin','select','confirm','cancel','text','levelup','win','lose',
  'arrow','thud','charge','crowd','horn','break','gallop','bush','door'`.
  `G.music.play(trackName)` / `G.music.stop()` play simple procedural loops:
  `'title','village','route','town','battle','boss','tourney','victory','castle'`.
* `G.ui` (game/ui in core):
  * `await G.ui.say(text | [text…], {name, look})`: bottom dialog box with a
    typewriter effect. A tap fast-forwards, then advances. `\n` makes a new
    line. Long text is paged automatically.
  * `await G.ui.ask(text, ['Yes','No'], {name})` → the chosen index. A cancel
    or `b` press gives the last option.
  * `G.ui.toast(text, color?)`: a small top banner that fades.
  * `G.ui.busy()` → true while a dialog or ask is open.
  * `await G.ui.menu(title, items, opts)` → the index, or −1. It is a generic
    vertical list for simple choices.

## 6. Game state (game/state.js — core)

`G.state` is the save data, a plain JSON object. Save it with `G.save()`; it
also autosaves on map change and after battles. Load it with `G.load()`.

```
{ name:'Squire', look:{...}, level:1, xp:0, gold:0, hp, maxHp(derived),
  perkPoints:0, perks:{}, stamina,
  equip:{ weapon:'stick', shield:null, armor:'tunic', lance:null, horse:null, bow:null },
  bag:{ itemId: qty }, seals:{ sword:false, archery:false, joust:false, grand:false },
  flags:{}, map:'thornbrook', x, y, dir, lastInn:{map,x,y},
  ranks:{ sword:0, archery:0, joust:0 },        // tournament cups won per discipline
  wins:{}, defeated:{}, playTime:0 }
```

* `G.player.stats()` → derived stats. **Battles must read from this**:
  `{ level, maxHp, hp, atk, def, maxSta, speed, weapon, shield, armor, lance,
  horse, bow }`. `weapon`, `shield` and the rest are the full item defs from
  `G.items`, or null.
* `G.player.gainXp(n)` → returns the number of levels gained. It also shows
  the level-up toast.
* `G.player.addGold(n)`, `G.player.give(id, qty)`, `take`, `has(id)`,
  `count(id)`.
* `G.player.hasPerk(id)`, `G.player.heal(amount|'full')`,
  `G.player.setHp(hp)`.
* Leveling: xpToNext(L) = `round(20 * L^1.45)`. Each level gives +8 max HP,
  +2 % attack, +4 max stamina, and **1 perk point**. The level cap is 30.

### Items (data/items.js — core)

Each item is `{ id, name, type, price, desc, ...stats }`. The types are:

| type | stats |
|---|---|
| weapon (swords) | `dmg, speed (swing time mult, lower=faster), reach (px), heavy` |
| shield | `block (0..1 dmg reduction when blocking), parry (ms window bonus), def` |
| armor | `def (flat dmg reduction), hp (bonus max hp), weight (0..1 slows)` |
| lance | `power, stability (0..1 less wobble), breakChance` |
| horse | `speed, stamina, control (0..1)` |
| bow | `power (arrow speed/less wind drift), steady (0..1 less sway), draw (s to full)` |
| consumable | `heal` (and/or `sta`), usable from the Bag and in sword battle (quick-use button) |
| key | quest items |

### Perks (data/perks.js — core)

There are three trees, five perks each, unlocked in order, at 1 perk point each.

* **Blade**: `parry_master` (+80 ms parry window), `riposte` (2.5× damage on
  your first strike within 1 s after a parry), `whirlwind` (hold-release
  heavy spin, hits all around), `second_wind` (+20 stamina and +5 HP on each
  hit you land… capped), `blade_dancer` (dodge i-frames +50 %, dodge costs
  −30 % stamina).
* **Lance**: `steady_hand` (−30 % reticle wobble), `spurs` (+20 % charge
  acceleration), `iron_seat` (−40 % chance to be unhorsed), `shatter` (+30 %
  lance-break chance on solid hits), `lance_champion` (impact timing window
  ×1.6).
* **Bow**: `eagle_eye` (scope shows a 1.5× magnified view while fully
  drawn), `calm_breath` (−35 % sway), `windreader` (shows the exact wind
  drift marker), `quick_draw` (draw time −35 %), `bullseye` (inner ring
  radius ×1.4).

## 7. Battles (G.battle)

```
const result = await G.battle.start(type, opts)
// type: 'sword' | 'joust' | 'archery'
// result: { won:bool, fled?:bool, score?:{...}, hp?:number }
```

Each battle module registers itself:
`G.battle.register('sword', (opts, done) => scene)`. The scene must call
`done(result)` exactly once, then it is popped automatically. `G.battle.start`
does the flash transition, pushes the scene, and resolves when it is done. It
also restores the previous music.

**Battles never grant XP or gold themselves.** The caller does that (the
encounter or tournament code), using the roster entries' `xp` and `gold`.

### 7a. Sword (battle/sword.js) — top-down live arena

The arena fits the screen in any orientation. Characters are drawn with
`G.chars` at 2× scale, with weapon and shield drawn on top. It's a souls-lite
on a phone:

* Left stick: move. **Tap R**: strike (a 3-hit light combo with timing).
  **Hold R**: raise shield / block. Raising the block within
  `120 ms + shield.parry + perk` of an enemy hit = **PARRY**, which staggers
  the enemy. **Flick R**: dodge-roll in the flick direction, with i-frames.
  Keyboard: `a` strike, `b` hold to block, `c` dodge in the stick direction.
* Stamina is used by strikes, blocks and dodges, and regenerates.
* The `whirlwind` perk: hold R ≥ 600 ms then release = spin attack.
* Enemies **telegraph** (wind-up flash plus a "!" glint) before attacks, so
  timing is readable. Juice: hit-stop, screen shake, particles, damage
  numbers, knockback.
* Multiple enemies are supported (wild packs, the Grand Melee).
* A quick-use **potion button** (small, top-left, shows the count) heals with
  the best consumable.
* opts:
  `{ enemies:[rosterId…], arena:'pit'|'field'|'forest'|'road'|'castle'|'practice', canFlee:bool, title:string,
  boss?:bool, intro?:string, noDeath?:bool }`. If `canFlee`, show a small
  "Run" button. It succeeds unless boss.
* `result.hp` is the player's HP left. The caller writes it back for wild
  fights, while tournaments restore HP.
* Rosters live in `data/roster_sword.js`:
  `G.roster.sword[id] = { name, look, hp, dmg, def, speed, ai:'brawler'|'knight'|'heavy'|'duelist'|'wolf'|'boar'|'bandit'|'dummy'|'champion', weapon:'short'|'long'|'axe'|'club'|'fangs'|'tusks', shield:bool, aggression 0..1, xp, gold }`.

### 7b. Joust (battle/joust.js) — first-person charge down the tilt

Each pass is a pseudo-3D view down the tilt barrier, with the opponent
charging toward you and growing as he closes.

1. **Charge**: tap R in rhythm to spur the horse. The speed meter has a sweet
   zone; overspurring makes the lance wobble.
2. **Aim**: the L-drag moves the lance tip reticle, which wobbles with speed,
   horse control, lance stability and perks. Keep it on the opponent's shield.
   The shield has a gold boss for center hits.
3. **Impact**: a shrinking timing ring. Tap R when it closes. Hit quality
   comes from aim × timing × speed × lance power.
4. Results: miss 0, glance 1, solid shield hit 2, **lance broken** 3,
   **unhorse = instant win**. The opponent strikes you too. Your brace timing
   and armor resist being unhorsed.

The bout is best of 3 passes (sudden-death passes if tied, up to 5). It
needs `equip.lance` and `equip.horse`; the caller ensures this.
opts: `{ opponent:rosterId, title, boss? }`.
Rosters live in `data/roster_joust.js`:
`G.roster.joust[id] = { name, look, horseColor, skill 0..1 (aim), power, seat 0..1, speed, xp, gold }`.

### 7c. Archery (battle/archery.js) — contest at the butts

Each round is a target at a distance, with wind. **Hold R** to draw: power
fills, and sway grows after the full draw (stamina). **L-drag** aims the
reticle, and you **release** to loose. The arrow flies with an arc and wind
drift, and lands on the target face with a zoomed hit view. Rings score
10/8/6/4/2 (bullseye inner = 10).

A contest has 3 ends of 3 arrows. Later tiers add moving targets, gusts and
farther distances. Rival archers' arrows are simulated and shown on the
scoreboard after each end. Win by the highest total.
opts: `{ rivals:[rosterId…], tier:1..4, title, boss? }`.
Rosters live in `data/roster_archery.js`:
`G.roster.archery[id] = { name, look, skill 0..1, xp, gold }`.

## 8. World (world/*.js + content/*.js)

### Tiles — legend for map strings (world/tiles.js defines art + solidity)

```
.  grass            ,  tall grass (encounters)   :  flowers
_  dirt path        =  cobblestone               ~  water (solid, animated)
s  sand             T  tree (solid, 1 tile; draw as round canopy)
t  pine tree(solid) r  rock (solid)              b  bush (solid)
f  fence (solid)    F  fence gate (walkable)     w  stone wall (solid)
#  house wall(solid)^  roof (solid)              d  door (warp; walkable)
W  window wall      h  hay bale (solid)           x  crate/barrel (solid)
S  sign (solid; interact)  B  bridge (walk)      o  well (solid)
c  castle wall (solid)     C  castle battlement/top (solid)  g  castle gate (walk; warp)
k  wooden floor (interior)  K  stone floor (interior)  n  interior wall (solid)
v  counter/table (solid)   e  bed (solid)        l  bookshelf (solid)
a  arena sand floor   q  arena wall/stands (solid)   |  tilt barrier (solid)
p  banner pole (solid)     m  market stall (solid)    u  stairs/ladder (walk)
"  void/black (solid)      *  torch (solid, animated)   ;  shallow ford (walk)
```

Roofs and walls auto-shade by neighbors. Tiles may have animated frames.
Unknown characters render as grass, and the validator flags them.

### Maps (content/maps_*.js)

```
G.maps[id] = {
  id, name, music:'village'|..., outdoor:true, encounterRate:0.08,
  encounters:[ {enemies:['wolf'], w:3}, {enemies:['bandit','bandit'], w:1}, ... ],
  tiles:[ "....TTT...", ... ],            // all rows the same length
  warps:[ {x,y, to:'mapId', tx,ty, dir} ],  // stepping on x,y (or interacting with door) warps
  edges:{ north:{to, offset}, south:..., east:..., west:... },  // optional: walk off map edge
  npcs:[ npc... ], signs:[ {x,y,text} ], objects:[ {x,y,type:'chest', id, item, qty} ],
  onEnter?: async (c) => {}
}
npc = { id, x, y, look:'presetName'|{...}, dir:'down', move:'still'|'wander'|'turn',
        name, script: async (c, npc) => {}, cond?: () => bool,
        trainer?: { sight:4, flag:'beat_x', battle:{type:'sword', opts:{...}},
                    intro:'text', win:'text after you win', lose:'text if you lose',
                    xp, gold } }
```

### Script commands (`c` = `G.cmd`, implemented in game/cmd.js plus world/overworld.js)

Core (game/cmd.js): `say, ask, flag(name), setFlag(name,v=true), give(id,q), take(id,q),
has(id), gold(n) (adds), canAfford(n), heal(), battle(type,opts), wait(ms),
toast(t), sfx(n), xp(n), seal(discipline)`.

World (overworld.js): `warp(mapId,x,y,dir), walkPlayer(path), walkNpc(id,path),
faceNpc(id,dir), facePlayer(dir), showNpc(id,bool), shake(ms), npc(id)`.
Paths are strings like `'UULLD'`.

UI/Menus (game/*.js): `shop(shopId), inn(price), tournament(hallId), stable(), trainer(...)`.

### World layout and story

```
                     [Crownhold] (capital: Grand Tourney, castle)
                          |
                    Route 3: Kingsroad (hard: bandit camp, knights)
                          |
 [Thornbrook] — Route 1: Whisperwood — [Millbridge] — Route 2: Greenmeadow — [Harrowfield]
  start village      (wolves, boars,      archery town      (fields, river,     horse/joust town
  Sword Pit          bandits, forest)     Archery Range     hedge knights)      Jousting Lists
```

Route 3 starts north of Harrowfield/Greenmeadow and is gated by needing at
least 2 seals (the guard at the gate). Crownhold's Grand Tourney requires all
3 seals.

**Story beats** (flags in quotes):

1. Wake in the hayloft of the Thornbrook stable (you are an orphaned stable
   hand). Old **Sir Aldric** (retired knight, mentor) sees you swinging a
   stick and offers training → practice duel vs a training dummy, then
   Aldric himself with `noDeath`. "met_aldric", "trained".
2. The rival **Cedric of Vane** (a rich lordling with a fine sword, mocking
   but not evil) shows up and beats you in a scripted, unwinnable-but-noDeath
   fight. Or you can win, which gives a bonus. "rival1".
3. **Thornbrook Sword Pit**: Novice Cup (3 opponents), then the Pit Master
   **Bram** seal bout → **Seal of the Blade**. Aldric gives the Rusty Sword
   before the Novice Cup.
4. Route 1 Whisperwood: tall-grass wolves, boars and bandits; two hedge-knight
   trainers; a hidden chest. Exit guarded until you hold any 1 cup win or
   Aldric's blessing ("trained" is enough).
5. **Millbridge**: the Archery Range master **Wren**, a bow shop, an inn. Quest:
   the miller's lost arrows → free Hunting Bow. Archery Novice Cup → seal
   contest vs Wren → **Seal of the Arrow**.
6. Route 2 Greenmeadow: hedge knights, bandits, a river with a bridge, a
   second rival encounter (Cedric, real fight).
7. **Harrowfield**: the horse town. The Stable sells horses (Old Nag 120 g,
   Palfrey 400 g, Destrier 1200 g). **Lady Rowena** of the Lists gives a
   Practice Lance and a tilting lesson vs a quintain-like squire. Joust Novice
   Cup → seal bout vs Rowena → **Seal of the Lance**.
8. Route 3 Kingsroad: needs 2 seals. It is the toughest area: a bandit camp
   with the boss **Black Hugh**.
9. **Crownhold**: the castle, the best shops, and the Grand Tourney (needs 3
   seals): Sword round → Archery round → Joust final vs **Sir Varek the
   Undefeated**, with Cedric appearing as a semifinalist. Win → credits →
   continue free-roaming, with the cups repeatable for gold.

**Specialization**: each discipline has a rank ladder with repeatable cups in
its hall (Novice, Squire, Knight, plus the Seal bout). Winning cups raises
`ranks[discipline]` and gives gold, XP and gear. Perk trees let the player
specialize. The Grand Tourney scales with the player's best discipline and
needs all three.

## 9. Tournaments, shops, menus (game/menus.js, game/tournament.js, data/tournaments.js, data/shops.js)

* `await G.tournament.run(hallId)` shows the hall UI: a list of cups with
  name, discipline, entry fee, minimum level, reward and status
  (locked/available/won). Picking one shows the bracket/ladder screen
  (portraits of opponents), then runs the battles in sequence. HP is
  restored before each match. Between rounds there is a "Round 2 of 3" card.
  Winning gives the reward screen (gold, XP, item, seal, rank up). Losing
  gives "You were eliminated", and you keep half the XP.
* `data/tournaments.js`:
  `G.halls[hallId] = { name, discipline, master:'name', cups:[ {id, name, fee, minLevel, rounds:[{type, opts}], reward:{gold, xp, item?, seal?}, repeatable, requires?:[cupId] } ] }`.
* `await G.shop.open(shopId)` is buy/sell with gear comparison (± stats).
  Shop data lives in `data/shops.js`.
* `await G.shop.inn(price)`: rest (full heal), save, set `lastInn`.
* Pause menu (the `menu` key, or the small ☰ button the overworld draws
  top-right): **Status** (stats, XP bar, seals), **Gear** (equip by slot,
  with comparisons), **Bag** (use consumables), **Perks** (three trees with
  unlock buttons), **Map** (world sketch with current location), **Save**,
  **Sound on/off**. Fully touch-friendly, with big tap targets ≥ 24 logical px.
* Defeat in the wild leads to a blackout: lose 25 % of gold, wake at
  `lastInn` with full HP. Use `G.game.blackout()`.

## 10. Testing hooks

* `G.debug.newGame()`, `G.debug.warp(map,x,y)`, `G.debug.give(...)`,
  `G.debug.setLevel(n)`, `G.debug.skipBattle(won)` (finishes the current
  battle), `G.debug.state()`.
* Append `?debug=1` to show an FPS counter and tile coordinates.
* Each battle scene must support `G.debug.skipBattle` by setting
  `scene.debugEnd = (won) => done({won, hp:…})`.

## 11. Quality bar

* 60 fps on a mid phone. No allocations-heavy work per frame in hot loops.
* Every interaction works with touch only, and with keyboard only.
* Battles must be **readable and fair**: clear telegraphs, generous early
  difficulty, and difficulty that rises by roster stats.
* Never throw: guard missing data with fallbacks and log to the console.

## 12. Cross-module APIs (who provides what)

| API | Provided by | Used by |
|---|---|---|
| `G.world.start()` (enter the overworld at `G.state.map/x/y/dir`; replaces the scene stack) | world/overworld.js | main.js |
| `G.world.scene` (current overworld scene), `G.world.refresh()` (re-evaluate NPC `cond`s) | world | content, menus |
| `G.cmd.warp / walkPlayer / walkNpc / faceNpc / facePlayer / showNpc / shake / npc` | world | content scripts |
| `G.tiles` (tile defs + `G.tiles.draw(ctx, ch, x, y, mapCtx)`) | world/tiles.js | world |
| `G.menus.open()` (pause menu; overworld ☰ button and the `menu` key call it) | game/menus.js | world |
| `G.cmd.shop(shopId)`, `G.cmd.inn(price)`, `G.cmd.tournament(hallId)` → `{won, cupId}` or null | game/shop.js, game/tournament.js | content |
| `G.shop.open`, `G.shop.inn`, `G.tournament.run` | game/* | via cmd |
| `G.game.credits()` (ending sequence after the Grand Tourney, then back to the overworld) | content/ending.js | content |
| `G.game.blackout()` | game/battle.js (core) | world, content |
| Wild encounter flow | world (it picks from `map.encounters`, calls `G.battle.start('sword', {enemies, arena:map.arena or 'field', canFlee:true})`, then applies `G.cmd.reward('sword', enemies)` on a win, `G.player.setHp(result.hp)`, or `G.game.blackout()` on a loss) | — |
| Trainer flow | world (line of sight → "!" → walks up → intro say → battle → win say + reward + `setFlag(trainer.flag)`; loss → for sword: blackout) | content supplies the data |

### Equipment model
`G.state.equip[slot]` holds the equipped item id. **Equipped items are NOT in
`bag`.** `G.player.equip(id)` moves an item from the bag to the slot and
returns the old one to the bag. Buying gear adds it to the bag. Stick and tunic
are the defaults: they are never put in the bag and can't be sold.

### ID registry (create exactly these; add more if you like)

**Maps** (content): `thornbrook_stable` (the start: an interior stable/hayloft;
**(3,3) must be walkable**, and the player wakes there), `thornbrook`,
`thornbrook_aldric`, `thornbrook_store`, `thornbrook_inn`, `thornbrook_pit`
(an interior arena hall), `route1`, `millbridge`, `millbridge_inn`,
`millbridge_bowyer`, `millbridge_smith`, `millbridge_range`, `route2`,
`harrowfield`, `harrowfield_inn`, `harrowfield_stable`, `harrowfield_armory`,
`harrowfield_lists`, `route3`, `bandit_camp`, `crownhold`, `crownhold_inn`,
`crownhold_market`, `crownhold_castle`, `crownhold_arena`.

**Halls** (tournament agent): `thornbrook_pit` (sword), `millbridge_range`
(archery), `harrowfield_lists` (joust), `crownhold_grand` (the Grand Tourney:
mixed; requires all 3 seals), `crownhold_arena` (high-level repeatable cups
in all three disciplines, for grinding gold).

**Shops** (shop agent): `thornbrook_store`, `millbridge_bowyer`,
`millbridge_smith`, `harrowfield_stable` (horses), `harrowfield_armory`,
`crownhold_market`, `crownhold_smith`.

**Sword roster** (sword agent; the **target player level** is in brackets):
`dummy`[1, does not attack], `aldric_spar`[1, gentle], `cedric1`[1, tough
but beatable], `wolf`[2], `wolf_alpha`[4], `boar`[3],
`bandit`[3], `bandit_thug`[5], `hedge_knight`[4], `hedge_duelist`[6],
`pit_tom`[2], `pit_meg`[3], `pit_oswin`[4] (Novice Cup), `pit_squire1..3`[5–7],
`pit_knight1..3`[9–12], `bram`[6, seal boss], `cedric2`[8], `river_troll`[10,
optional big brute on Route 2], `brigand`[12], `brigand_brute`[14],
`rogue_knight`[15], `black_hugh`[16, boss], `crown_knight1..3`[16–20],
`cedric3`[17], `gareth`[18, Grand Tourney sword-round champion],
`varek_sword`[20, optional post-game rematch].

**Joust roster**: `quintain_squire`[lesson, very easy], `joust_ned`, `joust_pip`,
`joust_hal` (Novice), `joust_squire1..3`, `joust_knight1..2`, `rowena` (seal
boss), `cedric_joust`, `varek` (Grand final), `crown_lancer1..2`.

**Archery roster**: `arch_tam`, `arch_lia`, `arch_bo` (Novice), `arch_squire1..3`,
`arch_knight1..2`, `wren` (seal boss), `grand_archer1..2`, `cedric_archer`.

### Reward guidance (keep consistent)
* Wild enemies: xp ≈ `5 + 3*L^1.2`, gold ≈ `2 + 2*L`, where L is the target
  level.
* Cups: Novice 100 xp / 60 g, Squire 250 xp / 150 g, Knight 500 xp / 400 g,
  Seal bout 400 xp / 200 g plus a prize item, Grand 2500 xp / 2000 g.
* Area target levels: Thornbrook 1–4, Route 1 2–5, Bram 6, Route 2 6–10,
  Harrowfield 8–12, Route 3 12–16, Grand 16–20.
* Archery and joust depend mostly on skill, gear and perks, not level.
