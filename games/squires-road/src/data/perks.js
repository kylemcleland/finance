// Shared data: perk trees (DESIGN.md §6). Unlock in order, 1 point each.
(() => {
  G.perkTrees = {
    blade: {
      name: 'Blade', color: '#d6453d', icon: '⚔',
      perks: [
        { id: 'parry_master', name: 'Parry Master', desc: 'Parry window +80 ms.' },
        { id: 'riposte', name: 'Riposte', desc: 'First strike within 1s after a parry deals 2.5x.' },
        { id: 'whirlwind', name: 'Whirlwind', desc: 'Hold right 0.6s, release: spin attack hits all around.' },
        { id: 'second_wind', name: 'Second Wind', desc: 'Landing hits restores stamina and a little HP.' },
        { id: 'blade_dancer', name: 'Blade Dancer', desc: 'Longer dodge invulnerability; dodges cost less.' },
      ],
    },
    lance: {
      name: 'Lance', color: '#3f7fd1', icon: '♞',
      perks: [
        { id: 'steady_hand', name: 'Steady Hand', desc: 'Lance tip wobbles 30% less.' },
        { id: 'spurs', name: 'Spurs', desc: 'Horse accelerates 20% faster.' },
        { id: 'iron_seat', name: 'Iron Seat', desc: '40% less likely to be unhorsed.' },
        { id: 'shatter', name: 'Shatter', desc: 'Solid hits break lances more often.' },
        { id: 'lance_champion', name: 'Lance Champion', desc: 'Impact timing window 1.6x wider.' },
      ],
    },
    bow: {
      name: 'Bow', color: '#5bb04a', icon: '➶',
      perks: [
        { id: 'eagle_eye', name: 'Eagle Eye', desc: 'Magnified view while fully drawn.' },
        { id: 'calm_breath', name: 'Calm Breath', desc: '35% less sway.' },
        { id: 'windreader', name: 'Windreader', desc: 'Shows exactly where wind will carry the arrow.' },
        { id: 'quick_draw', name: 'Quick Draw', desc: 'Draw 35% faster.' },
        { id: 'bullseye', name: 'Bullseye', desc: 'Inner ring 1.4x larger.' },
      ],
    },
  };
})();
