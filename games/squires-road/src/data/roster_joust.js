// Joust roster (DESIGN.md §7b, §12). Read by battle/joust.js and tournament/encounter code.
// Fields: name, look, horseColor, skill 0..1 (aim), power (lance force, ~lance.power),
// seat 0..1 (resists being unhorsed), speed (horse, ~horse.speed), xp, gold.
// Extras used by joust.js: herald (line the herald cries), title (short epithet).
// xp/gold follow the wild formula at the target level L: xp ≈ 5 + 3*L^1.2, gold ≈ 2 + 2L.
(() => {
  const R = G.roster.joust;
  const add = (id, o) => (R[id] = { id, ...o });

  // --- Lesson (Lady Rowena's tilting lesson) -------------------------------
  add('quintain_squire', {
    name: 'Squire Tobin', title: 'the Quintain', herald: 'on the practice horse. Be gentle!',
    look: { skin: '#f1c27d', hair: '#a0602a', tunic: '#c9a36a', tunic2: '#8a6a3a', pants: '#5a4632', boots: '#3a2616', helmet: '#a08a6a', plume: '#c9a36a' },
    horseColor: '#b08a5a', skill: 0.05, power: 0.3, seat: 0.12, speed: 0.6, xp: 15, gold: 0,
  });

  // --- Joust Novice Cup (target L8–9: forgiving) ----------------------------
  add('joust_ned', {
    name: 'Ned Barley', title: 'the Miller\'s Son', herald: 'of Millbridge, who has never yet kept his seat!',
    look: { skin: '#e9b98a', hair: '#d9a54a', tunic: '#d9a54a', tunic2: '#6a4022', pants: '#5a4a38', boots: '#33251a', helmet: '#9aa0aa', plume: '#f4e4c1' },
    horseColor: '#8a6a4a', skill: 0.28, power: 0.75, seat: 0.28, speed: 0.75, xp: 41, gold: 18,
  });
  add('joust_pip', {
    name: 'Pip Swiftspur', title: 'the Quick', herald: 'on the fastest pony in Harrowfield!',
    look: { skin: '#f5cfa8', hair: '#c2552c', tunic: '#3fa0a0', tunic2: '#f4e4c1', pants: '#4a5a6a', boots: '#2b2b33', helmet: '#b8bcc6', plume: '#3fa0a0' },
    horseColor: '#c9a36a', skill: 0.34, power: 0.8, seat: 0.33, speed: 0.95, xp: 44, gold: 19,
  });
  add('joust_hal', {
    name: 'Hal Ironbuckle', title: 'the Stout', herald: 'broad as a barn door and twice as stubborn!',
    look: { skin: '#c98e5d', hair: '#2a1a10', beard: '#2a1a10', tunic: '#5a6a3a', tunic2: '#d9c08f', pants: '#4a4a40', boots: '#2b2b20', helmet: '#8a8a7a', plume: '#a8743a' },
    horseColor: '#5a4030', skill: 0.4, power: 0.95, seat: 0.45, speed: 0.8, xp: 47, gold: 20,
  });

  // --- Squire Cup (target L10–11) -----------------------------------------
  add('joust_squire1', {
    name: 'Squire Aldous', title: 'of the Ford', herald: 'sworn squire of the Ford!',
    look: { skin: '#f1c27d', hair: '#6b3e1f', tunic: '#2f6e8a', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#b8bcc6', plume: '#f2c14e' },
    horseColor: '#7a5a3a', skill: 0.5, power: 1.05, seat: 0.5, speed: 0.9, xp: 53, gold: 22,
  });
  add('joust_squire2', {
    name: 'Squire Bertrand', title: 'the Red', herald: 'whose lance has felled three quintains!',
    look: { skin: '#e2ae80', hair: '#9a3a1a', tunic: '#b23a3a', tunic2: '#1f1f28', pants: '#3a2a2a', boots: '#1d1410', helmet: '#9aa0aa', plume: '#1f1f28' },
    horseColor: '#9a4a2a', skill: 0.54, power: 1.1, seat: 0.54, speed: 0.95, xp: 55, gold: 23,
  });
  add('joust_squire3', {
    name: 'Squire Joss', title: 'Hawkbright', herald: 'eyes of a hawk, seat of a mountain!',
    look: { skin: '#f0c9a0', hair: '#1a1a1a', tunic: '#4a8a58', tunic2: '#f4e4c1', pants: '#4a4a40', boots: '#2b2b20', helmet: '#c8ccd6', plume: '#4a8a58' },
    horseColor: '#e8e0d0', skill: 0.58, power: 1.15, seat: 0.58, speed: 1.0, xp: 58, gold: 24,
  });

  // --- Knight Cup (target L12–13) -----------------------------------------
  add('joust_knight1', {
    name: 'Sir Godfrey', title: 'the Green', herald: 'knight of the Greenmeadow, undefeated this season!',
    look: { skin: '#e2ae80', hair: '#5a3a1a', beard: '#5a3a1a', tunic: '#2f7a3a', tunic2: '#f2c14e', pants: '#3a4a3a', boots: '#1f2a1f', helmet: '#c8ccd6', plume: '#f2c14e' },
    horseColor: '#6a4a2e', skill: 0.64, power: 1.25, seat: 0.66, speed: 1.0, xp: 64, gold: 26,
  });
  add('joust_knight2', {
    name: 'Sir Mortimer', title: 'Blackwell', herald: 'lord of Blackwell Keep and master of the couched lance!',
    look: { skin: '#d9a77a', hair: '#151515', tunic: '#2a2a3a', tunic2: '#d6453d', pants: '#1f1f28', boots: '#0d0d10', helmet: '#6a6a78', plume: '#d6453d' },
    horseColor: '#3a2a22', skill: 0.7, power: 1.35, seat: 0.72, speed: 1.05, xp: 70, gold: 28,
  });

  // --- Seal bout (a real test) ----------------------------------------------
  add('rowena', {
    name: 'Lady Rowena', title: 'of the Lists', herald: 'mistress of the Harrowfield Lists, Keeper of the Seal of the Lance!',
    look: { skin: '#f4d0b0', hair: '#3b2414', hairStyle: 'long', tunic: '#c43c3c', tunic2: '#f2e6c8', pants: '#5a5a66', boots: '#2b2b33', helmet: '#d0d4dc', plume: '#f2e6c8' },
    horseColor: '#e8e4dc', skill: 0.8, power: 1.3, seat: 0.86, speed: 1.05, xp: 64, gold: 26, boss: true,
  });

  // --- Crownhold (target L16–20) ------------------------------------------
  add('crown_lancer1', {
    name: 'Sir Ector', title: 'of the Crown', herald: 'lancer of the Royal Guard!',
    look: { skin: '#e2ae80', hair: '#3a2a1a', tunic: '#2a5aa0', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#e2e6ee', plume: '#f2c14e' },
    horseColor: '#4a3a2a', skill: 0.78, power: 1.5, seat: 0.8, speed: 1.1, xp: 89, gold: 34,
  });
  add('crown_lancer2', {
    name: 'Dame Isolde', title: 'the Silver', herald: 'the Silver Lance of Crownhold, twice champion!',
    look: { skin: '#f5cfa8', hair: '#e8e8e8', hairStyle: 'long', tunic: '#a8b0c0', tunic2: '#2a3a6a', pants: '#4a4a55', boots: '#2b2b33', helmet: '#f0f4ff', plume: '#2a3a6a' },
    horseColor: '#d8d8dc', skill: 0.82, power: 1.55, seat: 0.84, speed: 1.12, xp: 101, gold: 38,
  });
  add('cedric_joust', {
    name: 'Cedric of Vane', title: 'the Golden', herald: 'heir of House Vane, in armour of gold!',
    look: { skin: '#f7d2a6', hair: '#f0d264', tunic: '#7b3fb5', tunic2: '#f2c14e', pants: '#2f2f3f', boots: '#1d1d26', helmet: '#e8c860', plume: '#7b3fb5', cape: '#4b2a7a' },
    horseColor: '#f0e8d8', skill: 0.74, power: 1.4, seat: 0.8, speed: 1.12, xp: 95, gold: 36,
  });
  add('varek', {
    name: 'Sir Varek', title: 'the Undefeated', herald: 'Champion of the Realm, never once unhorsed!',
    look: 'varek',
    horseColor: '#1e1e22', skill: 0.9, power: 1.7, seat: 0.95, speed: 1.15, xp: 114, gold: 42, boss: true,
  });
})();
