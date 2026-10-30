// Archery roster (DESIGN.md §7c, §12). skill 0..1 ≈ average points per arrow / 10.
// Optional: spread (form variance between ends, 1 = normal), nerve (extra
// variance under pressure, default derived from skill), quip (intro line).
(() => {
  const R = G.roster.archery;
  const add = (id, o) => (R[id] = { id, ...o });

  // --- Novice cup (≈ 100 xp / 60 g for the cup) -------------------------------
  add('arch_tam', {
    name: 'Tam', skill: 0.53, xp: 30, gold: 18,
    look: { skin: '#f1c27d', hair: '#a0602a', hairStyle: 'spiky', tunic: '#c0763a', pants: '#5a4632', boots: '#3a2616', hat: '#6a8a3a' },
    quip: 'My da says I shoot like a scarecrow. A lucky one!',
  });
  add('arch_lia', {
    name: 'Lia', skill: 0.6, xp: 33, gold: 20,
    look: { skin: '#f5cfa8', hair: '#e0b050', hairStyle: 'long', tunic: '#4a8ac0', pants: '#4a3a2a', boots: '#3a2a1a' },
    quip: 'Watch the pennants, not the crowd!',
  });
  add('arch_bo', {
    name: 'Big Bo', skill: 0.64, xp: 36, gold: 22,
    look: { skin: '#d9a77a', hair: '#3a2210', hairStyle: 'short', beard: '#3a2210', tunic: '#8a4a2a', pants: '#3a2c20', boots: '#1f150e' },
    quip: 'Bo hits the hay. Sometimes the gold.',
  });

  // --- Squire cup (≈ 250 xp / 150 g) --------------------------------------------
  add('arch_squire1', {
    name: 'Squire Edda', skill: 0.69, xp: 80, gold: 50,
    look: { skin: '#f0c9a0', hair: '#5a3a1a', hairStyle: 'long', tunic: '#3f7a3a', tunic2: '#d9c08f', pants: '#5a4630', boots: '#3a2a18' },
  });
  add('arch_squire2', {
    name: 'Squire Pell', skill: 0.71, xp: 85, gold: 50,
    look: { skin: '#e2ae80', hair: '#2a1a10', hairStyle: 'short', tunic: '#7a3a5a', pants: '#3a3040', boots: '#2a2028', hat: '#5a2a40' },
  });
  add('arch_squire3', {
    name: 'Squire Rook', skill: 0.73, xp: 90, gold: 55,
    look: { skin: '#c98e5d', hair: '#151515', hairStyle: 'spiky', tunic: '#3a4a6a', tunic2: '#f2c14e', pants: '#2f2f3f', boots: '#1d1d26' },
  });

  // --- Knight cup (≈ 500 xp / 400 g) ---------------------------------------------
  add('arch_knight1', {
    name: 'Sir Alder', skill: 0.79, xp: 240, gold: 190, spread: 0.8,
    look: { skin: '#e2ae80', hair: '#6a4a2a', beard: '#6a4a2a', tunic: '#2f5e2b', tunic2: '#f2c14e', pants: '#4a4a40', boots: '#2b2b20', cape: '#1f3e1b' },
    quip: 'A knight\'s arrow flies true. Mostly.',
  });
  add('arch_knight2', {
    name: 'Dame Sorrel', skill: 0.81, xp: 260, gold: 210, spread: 0.8,
    look: { skin: '#f4d0b0', hair: '#c2552c', hairStyle: 'long', tunic: '#8a2f22', tunic2: '#e8e8e8', pants: '#5a5a66', boots: '#2b2b33', cape: '#5a1a12' },
  });

  // --- Seal contest (400 xp / 200 g + prize) -------------------------------------
  add('wren', {
    name: 'Wren', look: 'wren', skill: 0.87, spread: 0.45, nerve: 0.12, xp: 400, gold: 200,
    quip: 'Breathe out. Let the string go on its own.',
  });

  // --- Grand Tourney / Crownhold ----------------------------------------------------
  add('grand_archer1', {
    name: 'Royal Archer Kestrel', skill: 0.88, spread: 0.6, nerve: 0.2, xp: 700, gold: 550,
    look: { skin: '#e9b98a', hair: '#2a1a10', hairStyle: 'short', tunic: '#8a1f2f', tunic2: '#f2c14e', pants: '#3a2a4a', boots: '#2a1a2a', hat: '#5a1020' },
    quip: 'The King\'s own bow. Do try to keep up.',
  });
  add('grand_archer2', {
    name: 'Royal Archer Merle', skill: 0.885, spread: 0.6, nerve: 0.2, xp: 700, gold: 550,
    look: { skin: '#f0c9a0', hair: '#d8d8d8', hairStyle: 'long', tunic: '#2a5aa0', tunic2: '#f2c14e', pants: '#2f2f3f', boots: '#1d1d26', hood: '#1f3f78' },
  });
  add('cedric_archer', {
    name: 'Cedric of Vane', look: 'cedric', skill: 0.72, spread: 1.2, nerve: 0.5, xp: 300, gold: 250,
    quip: 'Archery? Peasant sport. I shall win it anyway.',
  });
})();
