// Game state, player stats, save/load (DESIGN.md §6).
(() => {
  const SAVE_KEY = 'squires_road_save_v1';

  function fresh() {
    return {
      name: 'Squire', look: 'hero', level: 1, xp: 0, gold: 0, hp: 40,
      perkPoints: 0, perks: {},
      equip: { weapon: 'stick', shield: null, armor: 'tunic', lance: null, horse: null, bow: null },
      bag: { bread: 2 },
      seals: { sword: false, archery: false, joust: false, grand: false },
      flags: {}, map: 'thornbrook_stable', x: 3, y: 3, dir: 'down',
      lastInn: { map: 'thornbrook_stable', x: 3, y: 3 },
      ranks: { sword: 0, archery: 0, joust: 0 },
      wins: {}, defeated: {}, playTime: 0, steps: 0,
    };
  }

  G.state = fresh();

  const xpToNext = (L) => Math.round(20 * Math.pow(L, 1.45));

  const player = {
    xpToNext,
    stats() {
      const s = G.state;
      const it = (id) => (id && G.items[id]) || null;
      const weapon = it(s.equip.weapon) || G.items.stick;
      const shield = it(s.equip.shield), armor = it(s.equip.armor);
      const L = s.level;
      const maxHp = 40 + 8 * (L - 1) + (armor ? armor.hp || 0 : 0);
      return {
        level: L,
        maxHp,
        hp: Math.min(s.hp, maxHp),
        atk: weapon.dmg * (1 + 0.02 * (L - 1)),
        def: (armor ? armor.def || 0 : 0) + (shield ? shield.def || 0 : 0),
        maxSta: 100 + 4 * (L - 1),
        speed: 1 - (armor ? armor.weight || 0 : 0),
        weapon, shield, armor,
        lance: it(s.equip.lance), horse: it(s.equip.horse), bow: it(s.equip.bow),
      };
    },
    maxHp() { return player.stats().maxHp; },
    gainXp(n) {
      const s = G.state;
      n = Math.max(0, Math.round(n));
      s.xp += n;
      let ups = 0;
      while (s.level < 30 && s.xp >= xpToNext(s.level)) {
        s.xp -= xpToNext(s.level);
        s.level++;
        s.perkPoints++;
        ups++;
      }
      if (s.level >= 30) s.xp = Math.min(s.xp, xpToNext(30));
      if (ups) {
        s.hp = player.maxHp();
        G.sfx.play('levelup');
        G.ui.toast(`Level up! You are now level ${s.level}. (+1 perk point)`, '#9ff59a');
      }
      return ups;
    },
    addGold(n) {
      G.state.gold = Math.max(0, G.state.gold + Math.round(n));
      if (n > 0) G.sfx.play('coin');
    },
    give(id, qty = 1) {
      if (!G.items[id]) { console.warn('unknown item', id); return; }
      G.state.bag[id] = (G.state.bag[id] || 0) + qty;
    },
    take(id, qty = 1) {
      const b = G.state.bag;
      if (!b[id]) return false;
      b[id] -= qty;
      if (b[id] <= 0) {
        delete b[id];
        // unequip if it was equipped and none left
        for (const k in G.state.equip) if (G.state.equip[k] === id) G.state.equip[k] = k === 'weapon' ? 'stick' : k === 'armor' ? 'tunic' : null;
      }
      return true;
    },
    // Equipped items count as owned.
    has(id) { return !!G.state.bag[id] || Object.values(G.state.equip).includes(id); },
    count(id) { return G.state.bag[id] || 0; },
    // Equip an owned item (moves it out of the bag; old one goes back).
    equip(id) {
      const item = G.items[id];
      if (!item || !G.slotOf[item.type]) return false;
      const slot = G.slotOf[item.type];
      const old = G.state.equip[slot];
      if (old === id) return true;
      if (!G.state.bag[id]) return false;
      player.take(id, 1);
      if (old && old !== 'stick' && old !== 'tunic') player.give(old, 1);
      G.state.equip[slot] = id;
      G.state.hp = Math.min(G.state.hp, player.maxHp());
      return true;
    },
    unequip(slot) {
      const old = G.state.equip[slot];
      if (!old || old === 'stick' || old === 'tunic') return;
      player.give(old, 1);
      G.state.equip[slot] = slot === 'weapon' ? 'stick' : slot === 'armor' ? 'tunic' : null;
      G.state.hp = Math.min(G.state.hp, player.maxHp());
    },
    hasPerk(id) { return !!G.state.perks[id]; },
    heal(amount) {
      const max = player.maxHp();
      G.state.hp = amount === 'full' ? max : Math.min(max, G.state.hp + amount);
    },
    setHp(hp) { G.state.hp = G.U.clamp(Math.round(hp), 0, player.maxHp()); },
    // Best consumable in bag (smallest that is still useful, else biggest)
    bestHealItem(missing) {
      const ids = Object.keys(G.state.bag).filter((id) => G.items[id] && G.items[id].type === 'consumable');
      if (!ids.length) return null;
      ids.sort((a, b) => G.items[a].heal - G.items[b].heal);
      return ids.find((id) => G.items[id].heal >= missing) || ids[ids.length - 1];
    },
    // Use a consumable; returns healed amount or 0.
    useItem(id) {
      const item = G.items[id];
      if (!item || item.type !== 'consumable' || !G.state.bag[id]) return 0;
      const before = G.state.hp;
      player.take(id, 1);
      player.heal(item.heal || 0);
      G.sfx.play('heal');
      return G.state.hp - before;
    },
  };
  G.player = player;

  G.newGame = () => { G.state = fresh(); };
  G.save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.state));
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  };
  G.hasSave = () => {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  };
  G.load = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const base = fresh();
      G.state = Object.assign(base, data);
      G.state.equip = Object.assign(fresh().equip, data.equip || {});
      G.state.seals = Object.assign(fresh().seals, data.seals || {});
      G.state.ranks = Object.assign(fresh().ranks, data.ranks || {});
      return true;
    } catch (e) { console.warn('load failed', e); return false; }
  };
  G.deleteSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ } };
})();
