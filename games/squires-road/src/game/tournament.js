// Tournament halls: cup list → ladder → rounds (live battles) → reward / eliminated. DESIGN.md §9.
// await G.tournament.run(hallId) → { won, cupId } | null (backed out).
(() => {
  const U = G.U;
  const D = () => G.draw;
  const M = () => G.mui;
  const ctx = () => G.gfx.ctx;

  const RANK_TIERS = ['novice', 'squire', 'knight', 'seal', 'champion'];
  const SEAL_NAMES = { sword: 'Seal of the Blade', archery: 'Seal of the Arrow', joust: 'Seal of the Lance', grand: 'Crown of the Realm' };

  // ------------------------------------------------------------------ helpers
  const pretty = (id) => String(id).replace(/[_-]+/g, ' ').replace(/\d+$/, (n) => ' ' + n).replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  function guessLook(id) {
    const m = [
      [/cedric/, 'cedric'], [/varek/, 'varek'], [/bram/, 'bram'], [/wren/, 'wren'], [/rowena/, 'rowena'],
      [/gareth|crown_knight|crown_lancer|knight/, 'knight'], [/squire/, 'squire'], [/arch|archer/, 'archer'],
      [/joust/, 'hedgeKnight'], [/hugh/, 'hugh'], [/pit_meg/, 'villagerF'], [/pit/, 'villagerM'],
    ];
    for (const [re, l] of m) if (re.test(id)) return l;
    return 'bandit';
  }
  function oppsOf(round) {
    const t = round.type, o = round.opts || {};
    const ids = t === 'sword' ? o.enemies || [] : t === 'joust' ? [o.opponent] : o.rivals || [];
    return ids.filter(Boolean).map((id) => {
      const r = G.roster && G.roster[t] && G.roster[t][id];
      return { id, name: (r && r.name) || pretty(id), look: (r && r.look) || guessLook(id), r };
    });
  }
  function cupDiscipline(cup) {
    const types = new Set(cup.rounds.map((r) => r.type));
    if (types.size === 1) return [...types][0];
    return 'mixed';
  }
  function findCup(id) {
    for (const hid in G.halls) for (const c of G.halls[hid].cups || []) if (c.id === id) return c;
    return null;
  }
  const wins = (id) => (G.state.wins && G.state.wins[id]) || 0;

  // Requirements: → { ok, reasons:[{ok, text}], afford }
  function check(cup) {
    const s = G.state;
    const reasons = [];
    reasons.push({ ok: s.level >= (cup.minLevel || 1), text: `Level ${cup.minLevel || 1}+` + (s.level < (cup.minLevel || 1) ? ` (you are ${s.level})` : '') });
    for (const r of cup.requires || []) {
      const c = findCup(r);
      reasons.push({ ok: wins(r) > 0, text: `Win the ${c ? c.name : pretty(r)} first` });
    }
    if (cup.needSeals) {
      const have = cup.needSeals.filter((d) => s.seals[d]).length;
      reasons.push({ ok: have >= cup.needSeals.length, text: `Hold all ${cup.needSeals.length} Seals (${have}/${cup.needSeals.length})` });
    }
    const types = new Set(cup.rounds.map((r) => r.type));
    if (types.has('joust')) {
      const miss = [];
      if (!s.equip.lance) miss.push('a lance');
      if (!s.equip.horse) miss.push('a horse');
      reasons.push({ ok: !miss.length, text: miss.length ? `Equip ${miss.join(' and ')} to joust` : 'Lance and horse equipped' });
    }
    if (types.has('archery')) reasons.push({ ok: !!s.equip.bow, text: s.equip.bow ? 'Bow equipped' : 'Equip a bow to compete' });
    const afford = s.gold >= (cup.fee || 0);
    const ok = reasons.every((r) => r.ok);
    return { ok, reasons, afford };
  }
  // Locked = a hard requirement (level/prior cup/seal) is missing; gear just warns.
  function statusOf(cup) {
    const s = G.state;
    const hard = s.level >= (cup.minLevel || 1) && (cup.requires || []).every((r) => wins(r) > 0) && (!cup.needSeals || cup.needSeals.every((d) => s.seals[d]));
    if (!hard) return 'locked';
    if (wins(cup.id) > 0) return 'won';
    return 'open';
  }
  function rewardFor(cup) {
    const r = cup.reward || {};
    const first = wins(cup.id) === 0;
    return {
      first,
      gold: first ? r.gold || 0 : Math.floor((r.gold || 0) / 2),
      xp: first ? r.xp || 0 : Math.floor((r.xp || 0) / 2),
      item: first ? r.item || null : null,
      qty: r.qty || 1,
      seal: r.seal && !G.state.seals[r.seal] ? r.seal : null,
    };
  }

  // ------------------------------------------------------------------ main
  async function run(hallId) {
    const hall = G.halls && G.halls[hallId];
    if (!hall) { console.warn('unknown hall', hallId); G.ui.toast('The hall is closed today.', '#ffb08a'); return null; }
    const prevMusic = G.music.current;
    G.music.play('tourney');
    G.sfx.play('crowd');
    let result = null;
    try {
      result = await tourneyScene(hall);
    } catch (e) {
      console.error('tournament error', e);
    }
    G.player.heal('full');
    if (prevMusic) G.music.play(prevMusic);
    return result;
  }

  // One scene drives the whole visit: hall → ladder → cards → reward.
  function tourneyScene(hall) {
    const mui = M();
    const nav = mui.makeNav();
    const fx = mui.makeFx();
    const S = {
      mode: 'hall', sel: null, cup: null, round: 0, results: [], t: 0, card: null, reward: null,
      waiting: null, crowd: makeCrowd(),
    };
    let finish;
    const done = new Promise((r) => (finish = r));

    const waitBtn = () => new Promise((r) => (S.waiting = r));
    const resolveWait = (v) => { const w = S.waiting; S.waiting = null; if (w) w(v); };
    const setMode = (m) => { S.mode = m; S.t = 0; nav.focus = null; };

    const def = {
      name: 'tournament',
      update(dt) {
        S.t += dt;
        fx.update(dt);
        updateCrowd(S.crowd, dt);
        const k = nav.update(dt);
        if (S.mode === 'hall') {
          if (k.back || k.menu) { G.sfx.play('cancel'); def.close(null); }
        } else if (S.mode === 'ladder') {
          if ((k.back || k.menu) && S.round === 0 && !S.paid) { G.sfx.play('cancel'); setMode('hall'); }
        } else if (S.mode === 'card') {
          if (S.t > 0.4 && (G.input.anyTap() || G.input.pressed('a'))) { G.input.consumeAllTaps(); S.t = Math.max(S.t, S.card.dur); }
          if (S.t >= S.card.dur) resolveWait();
        } else if (S.mode === 'reward' || S.mode === 'elim') {
          const end = S.mode === 'reward' ? S.reward.end : 1.4;
          if (S.t < end && S.t > 0.3 && (G.input.events.some((e) => e.type === 'tap') || keyA())) { G.input.consumeAllTaps(); S.t = end; S.skipped = true; }
          stepReward();
        }
      },
      draw(c, k) {
        const W = G.W, H = G.H;
        c.globalAlpha = k;
        drawBackdrop(c, S);
        nav.begin();
        try {
          if (S.mode === 'hall') drawHall();
          else if (S.mode === 'ladder' || S.mode === 'card') drawLadder();
          else if (S.mode === 'reward') drawReward();
          else if (S.mode === 'elim') drawElim();
          if (S.mode === 'card') drawCard();
        } catch (e) { console.error('tourney draw', e); }
        fx.draw();
        c.globalAlpha = 1;
        void W; void H;
      },
    };
    const keyA = () => mui.keyDown('a') && G.input.pressed('a');
    const narrow = () => G.W <= G.H * 1.15;

    // -------------------------------------------------- hall (cup list)
    function panelRect() {
      const W = G.W, H = G.H, land = !narrow();
      const pw = Math.min(W - 8, land ? 620 : 420), ph = Math.min(H - 8, land ? 420 : 700);
      return { x: Math.round((W - pw) / 2), y: Math.round((H - ph) / 2), w: pw, h: ph, land };
    }
    function drawHall() {
      const P = panelRect();
      mui.parchment(P.x, P.y, P.w, P.h);
      // header
      mui.portraitFrame(hall.masterLook || 'knight', P.x + 10, P.y + 10, 28, { bg1: '#e8c88a', bg2: '#b07a4a' });
      let ns = 10;
      while (ns > 7 && D().measure(hall.name, ns) > P.w - 90) ns -= 0.5;
      D().text(hall.name, P.x + 46, P.y + 9, { size: ns, bold: true, color: '#3a2414' });
      const disc = mui.DISC[hall.discipline] || mui.DISC.mixed;
      let cx = P.x + 46;
      cx += mui.chip(cx, P.y + 22, disc.name, disc.color) + 4;
      if (G.state.ranks && G.state.ranks[hall.discipline] != null) {
        const r = G.state.ranks[hall.discipline];
        mui.chip(cx, P.y + 22, 'Your rank: ' + mui.rankTitle(r), r >= 3 ? '#b8862a' : r >= 2 ? '#7a5aa8' : r >= 1 ? '#4a8a58' : '#8a7a5a');
      }
      if (mui.closeBtn(nav, P.x + P.w - 30, P.y + 5)) def.close(null);
      const top = P.y + 44;
      const ih = D().text(`“${hall.intro || ''}”`, P.x + 10, top - 4, { size: 6, color: '#7a4b2a', maxW: P.w - 20, lineH: 7.5 });
      const top2 = top + ih;
      const cups = hall.cups || [];
      if (!S.sel && cups.length) S.sel = cups.find((c) => statusOf(c) === 'open') || cups[0];
      let LA, DA;
      const bodyH = P.y + P.h - 8 - top2;
      if (P.land) {
        const lw = Math.floor((P.w - 16) * 0.48);
        LA = { x: P.x + 8, y: top2, w: lw, h: bodyH };
        DA = { x: P.x + 8 + lw + 6, y: top2, w: P.w - 16 - lw - 6, h: bodyH };
      } else {
        const dh = Math.min(210, Math.max(170, bodyH * 0.52));
        LA = { x: P.x + 8, y: top2, w: P.w - 16, h: bodyH - dh - 4 };
        DA = { x: P.x + 8, y: top2 + bodyH - dh, w: P.w - 16, h: dh };
      }
      nav.scroll('cups', LA, (oy) => {
        let y = oy + 1;
        for (const cup of cups) {
          const st = statusOf(cup);
          const d = cupDiscipline(cup);
          const dd = mui.DISC[d] || mui.DISC.mixed;
          const rh = 34;
          if (nav.btn('cup_' + cup.id, LA.x, y, LA.w - 5, rh - 3, '', {
            pri: st === 'open',
            draw(r, bst) {
              mui.drawRow(r, bst, { selected: S.sel === cup, accent: dd.color, fill: st === 'locked' ? '#e6d7b8' : undefined });
              // emblem
              const ex = r.x + 17, ey = r.y + r.h / 2;
              D().circle(ex, ey + 1, 11, 'rgba(60,30,10,0.3)');
              D().circle(ex, ey, 11, st === 'won' ? '#f2c14e' : st === 'locked' ? '#cbb994' : '#f8ebcb', '#7a4b2a', 1);
              if (cup.reward && cup.reward.seal) mui.sealBadge(mui.SEALS.find((s) => s.id === cup.reward.seal) || mui.SEALS[0], ex, ey, 8, st !== 'locked', 0);
              else mui.icon(st === 'won' ? 'trophy' : dd.icon, ex, ey, 14);
              if (st === 'locked') { ctx().globalAlpha = 0.8; mui.icon('lock', ex + 8, ey + 7, 9); ctx().globalAlpha = 1; }
              D().text(cup.name, r.x + 33, r.y + 5, { size: 8, bold: true, color: st === 'locked' ? '#8a7a5a' : '#2b1d14' });
              let x = r.x + 33;
              x += mui.chip(x, r.y + 17, `Lv ${cup.minLevel || 1}`, '#8a7a5a') + 3;
              x += mui.chip(x, r.y + 17, cup.fee ? `${cup.fee}g` : 'Free', cup.fee && G.state.gold < cup.fee ? '#b0453a' : '#a07a3a') + 3;
              x += mui.chip(x, r.y + 17, `${cup.rounds.length} rd${cup.rounds.length > 1 ? 's' : ''}`, '#7a6a5a') + 3;
              // status chip
              const sc = st === 'won' ? ['Won ×' + wins(cup.id), '#c99a2e'] : st === 'locked' ? ['Locked', '#8a7a6a'] : ['Open', '#4a8a3a'];
              mui.chip(r.x + r.w - 5, r.y + 4, sc[0], sc[1], { align: 'right' });
            },
          })) { S.sel = cup; if (!P.land) nav.setFocus('enter'); }
          y += rh;
        }
        return y - oy + 2;
      });
      drawCupDetail(DA);
    }

    function drawCupDetail(A) {
      mui.inset(A.x, A.y, A.w, A.h, 'rgba(255,250,235,0.55)');
      const cup = S.sel;
      if (!cup) {
        D().text('Choose a cup to see its prizes and rules.', A.x + A.w / 2, A.y + A.h / 2 - 6, { size: 7, align: 'center', color: '#8a6a4a', maxW: A.w - 20 });
        return;
      }
      const chk = check(cup);
      const rw = rewardFor(cup);
      let y = A.y + 6;
      D().text(cup.name, A.x + 8, y, { size: 9, bold: true, color: '#2b1d14' });
      y += 12;
      y += D().text(cup.desc || '', A.x + 8, y, { size: 6, color: '#6a4a2a', maxW: A.w - 16, lineH: 7.5 }) + 2;
      // opponents strip
      const opps = [];
      cup.rounds.forEach((r) => oppsOf(r).forEach((o) => opps.push(o)));
      const ps = 16;
      const maxN = Math.floor((A.w - 16) / (ps + 3));
      opps.slice(0, maxN).forEach((o, i) => mui.portraitFrame(o.look, A.x + 9 + i * (ps + 3), y + 1, ps, { bg1: '#d9c08f', bg2: '#b08a5a', edge: '#5a3418' }));
      y += ps + 7;
      // prize line
      D().text(rw.first ? 'PRIZE' : 'PRIZE (repeat: half, no item)', A.x + 8, y, { size: 6, color: '#8a5a2a' });
      y += 9;
      let x = A.x + 8;
      mui.icon('coin', x + 5, y + 6, 10); D().text(`${rw.gold}`, x + 12, y + 6.5, { size: 8, baseline: 'middle', bold: true, color: '#3a2414' });
      x += 18 + D().measure(String(rw.gold), 8) + 4;
      D().text(`${rw.xp} XP`, x, y + 6.5, { size: 8, baseline: 'middle', bold: true, color: '#2f6fa8' });
      x += D().measure(`${rw.xp} XP`, 8) + 8;
      const it = rw.item && G.items[rw.item];
      if (it) {
        mui.itemIcon(it, x + 8, y + 6, 10);
        const nm = (rw.qty > 1 ? rw.qty + '× ' : '') + it.name;
        D().text(nm, x + 17, y + 6.5, { size: 7, baseline: 'middle', color: '#3a2414', maxW: A.x + A.w - x - 20 });
      }
      y += 15;
      if (cup.reward && cup.reward.seal) {
        const sd = mui.SEALS.find((s) => s.id === cup.reward.seal);
        if (sd) {
          mui.sealBadge(sd, A.x + 14, y + 5, 6, true, G.time);
          D().text(G.state.seals[sd.id] ? `${sd.name} (earned)` : `+ ${sd.name}!`, A.x + 24, y + 5.5, { size: 7, baseline: 'middle', bold: true, color: sd.color });
          y += 14;
        }
      }
      // requirements
      const btnH = 24;
      const reqBottom = A.y + A.h - btnH - 10;
      for (const r of chk.reasons) {
        if (y + 8 > reqBottom) break;
        mui.icon(r.ok ? 'check' : 'lock', A.x + 13, y + 4, 8, { color: '#5bb04a' });
        D().text(r.text, A.x + 21, y + 4.5, { size: 6, baseline: 'middle', color: r.ok ? '#4a6a3a' : '#b0453a' });
        y += 9;
      }
      // enter button
      const bw = Math.min(A.w - 16, 150), bx = A.x + A.w - bw - 8, by = A.y + A.h - btnH - 8;
      const label = !chk.ok ? 'Locked' : !chk.afford ? `Need ${cup.fee}g` : cup.fee ? `Enter (${cup.fee}g)` : 'Enter';
      if (nav.btn('enter', bx, by, bw, btnH, label, { color: chk.ok && chk.afford ? '#b8442f' : '#a39580', icon: chk.ok ? 'trophy' : 'lock', tapDisabled: true, sfx: false, pri: true })) {
        if (!chk.ok) {
          G.sfx.play('cancel');
          const why = chk.reasons.find((r) => !r.ok);
          fx.text(bx + bw / 2, by - 6, why ? why.text : 'Locked', '#ffb08a', 8);
        } else if (!chk.afford) {
          G.sfx.play('cancel');
          fx.text(bx + bw / 2, by - 6, `Entry is ${cup.fee} gold`, '#ffb08a', 8);
        } else {
          G.sfx.play('confirm');
          startCup(cup);
        }
      }
    }

    // -------------------------------------------------- the cup flow
    async function startCup(cup) {
      S.cup = cup; S.round = 0; S.results = []; S.paid = false;
      setMode('ladder');
      const go = await waitBtn();
      if (go !== 'go') return; // backed out to hall
      if (cup.fee) { G.state.gold -= cup.fee; G.sfx.play('coin'); }
      S.paid = true;
      const n = cup.rounds.length;
      let won = true;
      for (let i = 0; i < n; i++) {
        S.round = i;
        if (i > 0) {
          setMode('ladder');
          await waitBtn();
        }
        const round = cup.rounds[i];
        const opps = oppsOf(round);
        G.player.heal('full'); // sword HP restored before every match
        S.card = { title: round.label || (i === n - 1 ? 'Final' : `Round ${i + 1}`), sub: `Round ${i + 1} of ${n}`, names: opps.map((o) => o.name).join(' & '), dur: 1.7, kind: 'round' };
        setMode('card');
        G.sfx.play('horn');
        await waitBtn();
        const opts = Object.assign({}, round.opts || {});
        if (!opts.title) opts.title = `${cup.name} — ${S.card.title}`;
        let res;
        try { res = await G.battle.start(round.type, opts); } catch (e) { console.error('battle error', e); res = { won: false }; }
        res = res || { won: false };
        S.results.push(!!res.won);
        G.player.heal('full');
        if (!res.won) { won = false; break; }
        if (i < n - 1) {
          S.card = { title: 'Advance!', sub: `${opps.map((o) => o.name).join(' & ')} defeated`, names: '', dur: 1.3, kind: 'advance' };
          setMode('card');
          G.sfx.play('crowd');
          G.sfx.play('confirm');
          await waitBtn();
        }
      }
      if (won) await rewardPhase(cup);
      else await elimPhase(cup);
      G.player.heal('full');
      G.save();
      def.close({ won, cupId: cup.id });
    }

    async function rewardPhase(cup) {
      const rw = rewardFor(cup);
      const d = cupDiscipline(cup);
      // rank up: first win of a tier in this discipline
      let rankUp = null;
      if (rw.first && G.state.ranks && G.state.ranks[d] != null && RANK_TIERS.includes(cup.tier)) {
        let before = false;
        for (const hid in G.halls) for (const c of G.halls[hid].cups || []) {
          if (c !== cup && c.tier === cup.tier && cupDiscipline(c) === d && wins(c.id) > 0) before = true;
        }
        if (!before) {
          const from = G.state.ranks[d];
          G.state.ranks[d] = from + 1;
          rankUp = { from: mui.rankTitle(from), to: mui.rankTitle(from + 1), d };
        }
      }
      G.state.wins = G.state.wins || {};
      G.state.wins[cup.id] = wins(cup.id) + 1;
      const goldBefore = G.state.gold, levelBefore = G.state.level;
      G.player.addGold(rw.gold);
      const ups = G.player.gainXp(rw.xp);
      if (rw.item && G.items[rw.item]) G.player.give(rw.item, rw.qty);
      if (rw.seal) G.state.seals[rw.seal] = true;
      // timeline
      let t = 0.7;
      const tl = { gold: t, xp: (t += 0.9), item: rw.item ? (t += 0.9) : null, seal: rw.seal ? (t += 0.9) : null, rank: rankUp ? (t += 1.2) : null };
      tl.end = t + 0.8;
      S.reward = { rw, rankUp, tl, end: tl.end, goldBefore, levelBefore, ups, fired: {} };
      setMode('reward');
      G.music.play('victory');
      G.sfx.play('win');
      await waitBtn();
    }
    function stepReward() {
      if (S.mode !== 'reward') return;
      const R = S.reward, f = R.fired, t = S.t;
      const P = rewardLayout();
      if (!f.gold && t >= R.tl.gold) { f.gold = 1; G.sfx.play('coin'); fx.sparkle(P.trophy.x, P.trophy.y, 20, '#ffe48a', 80); }
      if (R.tl.item != null && !f.item && t >= R.tl.item) { f.item = 1; G.sfx.play('confirm'); fx.sparkle(P.item.x, P.item.y, 14, '#fff3b0', 60); }
      if (R.tl.seal != null && !f.seal && t >= R.tl.seal) {
        f.seal = 1;
        G.cmd.seal(R.rw.seal);
        fx.sparkle(P.seal.x, P.seal.y - 8, 30, '#ffe48a', 100);
        fx.sparkle(P.seal.x, P.seal.y - 8, 16, '#ffffff', 60);
      }
      if (R.tl.rank != null && !f.rank && t >= R.tl.rank) { f.rank = 1; G.sfx.play('levelup'); fx.sparkle(P.rank.x, P.rank.y, 20, '#d9b8ff', 80); }
      if (S.skipped) {
        // fire everything that was skipped (once)
        if (R.tl.seal != null && !f.seal) { f.seal = 1; G.cmd.seal(R.rw.seal); }
        S.skipped = false;
      }
    }
    async function elimPhase(cup) {
      const rw = rewardFor(cup);
      const n = cup.rounds.length;
      const wonRounds = S.results.filter(Boolean).length;
      const xp = Math.floor((rw.xp / n) * wonRounds * 0.5);
      if (xp > 0) G.player.gainXp(xp);
      S.elim = { xp, wonRounds, n };
      setMode('elim');
      G.sfx.play('lose');
      await waitBtn();
    }

    // -------------------------------------------------- ladder screen
    function drawLadder() {
      const P = panelRect();
      const cup = S.cup;
      const n = cup.rounds.length;
      const land = P.land;
      mui.parchment(P.x, P.y, P.w, P.h);
      const dcol = (mui.DISC[cupDiscipline(cup)] || mui.DISC.mixed).color;
      mui.ribbon(P.x + P.w / 2, P.y + 8, Math.min(P.w - 40, D().measure(cup.name, 10) + 40), cup.name, dcol, { size: 10, h: 18 });
      D().text(hall.name, P.x + P.w / 2, P.y + 33, { size: 6, align: 'center', color: '#7a4b2a' });
      const btnH = 26;
      const by = P.y + P.h - 10 - btnH;
      // ---- bracket row
      const colTop = P.y + (land ? 40 : 44);
      const cw = (P.w - 16) / n;
      const ps = U.clamp(cw - 12, 18, land ? 24 : 36);
      const nameLines = land ? 1 : 2;
      const rowH = 28 + ps + 6 + nameLines * 7;
      for (let i = 0; i < n; i++) {
        const r = cup.rounds[i];
        const opps = oppsOf(r);
        const cx = P.x + 8 + cw * (i + 0.5);
        const state = i < S.results.length ? (S.results[i] ? 'beat' : 'lost') : i === S.round ? 'now' : 'next';
        ctx().font = D().font(6, true);
        const lab = U.wrapText(ctx(), r.label || (i === n - 1 ? 'Final' : `Round ${i + 1}`), cw - 2).slice(0, 2);
        lab.forEach((l, k2) => D().text(l, cx, colTop + k2 * 7 + (lab.length === 1 ? 3 : 0), { size: 6, align: 'center', color: state === 'now' ? '#b8442f' : '#7a5a3a', bold: true }));
        const py = colTop + 26;
        const m = opps.length;
        const off = m > 1 ? Math.min(ps * 0.45, (cw - 6 - ps) / (m - 1)) : 0;
        const gw = ps + off * (m - 1);
        const startX = cx - gw / 2;
        if (state === 'now') {
          const g = 0.5 + 0.5 * Math.sin(G.time * 5);
          D().rrect(startX - 4, py - 4, gw + 8, ps + 8, 6, `rgba(255,214,100,${0.35 + 0.35 * g})`);
          const b = Math.abs(Math.sin(G.time * 4)) * 2;
          ctx().fillStyle = '#d6453d';
          ctx().beginPath(); ctx().moveTo(cx - 4, py - 11 - b); ctx().lineTo(cx + 4, py - 11 - b); ctx().lineTo(cx, py - 6 - b); ctx().fill();
        }
        opps.forEach((o, j) => mui.portraitFrame(o.look, startX + j * off, py, ps, { dim: state === 'beat', edge: state === 'now' ? '#b8442f' : '#5a3418', bg1: '#e8c88a', bg2: '#b07a4a' }));
        if (state === 'beat') {
          const yy = py + ps / 2;
          D().line(cx - ps * 0.32, yy - ps * 0.32, cx + ps * 0.32, yy + ps * 0.32, '#c0392b', 2.5);
          D().line(cx + ps * 0.32, yy - ps * 0.32, cx - ps * 0.32, yy + ps * 0.32, '#c0392b', 2.5);
        }
        ctx().font = D().font(6, true);
        const lines = U.wrapText(ctx(), opps.map((o) => o.name).join(' & '), cw - 3).slice(0, nameLines);
        lines.forEach((l, k) => D().text(l, cx, py + ps + 3 + k * 7, { size: 6, align: 'center', color: state === 'beat' ? '#9a8466' : '#3a2414' }));
        if (i < n - 1) {
          const x1 = startX + gw + 3, x2 = P.x + 8 + cw * (i + 1.5) - (ps + (oppsOf(cup.rounds[i + 1]).length > 1 ? ps * 0.45 : 0)) / 2 - 3;
          if (x2 > x1 + 2) {
            ctx().setLineDash([2, 2]);
            D().line(x1, py + ps / 2, x2, py + ps / 2, i < S.results.length ? '#c9893c' : 'rgba(90,60,30,0.4)', 1.2);
            ctx().setLineDash([]);
          }
        }
        if (i === n - 1 && state !== 'now') mui.icon('trophy', startX + gw, py - 2, 10);
      }
      // ---- duel panel: you vs the current opponent(s)
      const dy = colTop + rowH + 4, dh = by - 8 - dy;
      mui.inset(P.x + 10, dy, P.w - 20, dh, 'rgba(255,250,235,0.45)');
      const cur = S.round < n ? oppsOf(cup.rounds[S.round]) : [];
      const curNames = cur.map((o) => o.name).join(' & ');
      const pulse = 1 + Math.sin(G.time * 6) * 0.05;
      const vsBadge = (x, y, r) => {
        D().circle(x, y + 1.5, r * pulse, '#5a1e12');
        D().circle(x, y, r * pulse, '#b8442f', '#5a1e12', 1.5);
        D().text('VS', x, y + 0.5, { size: r * 0.75, align: 'center', baseline: 'middle', bold: true, color: '#fff3d6', outline: '#5a1e12', outlineW: 2 });
      };
      if (dh < 80) {
        // compact single-row duel (short landscape screens)
        const s2 = Math.max(16, dh - 8), cy = dy + dh / 2;
        mui.portraitFrame(G.state.look || 'hero', P.x + 16, cy - s2 / 2, s2, { edge: '#3b6fc4' });
        D().text(G.state.name || 'You', P.x + 22 + s2, cy - 4, { size: 8, bold: true, baseline: 'middle', color: '#2b1d14' });
        D().text(`Level ${G.state.level}`, P.x + 22 + s2, cy + 6, { size: 6, baseline: 'middle', color: '#7a4b2a' });
        vsBadge(P.x + P.w / 2, cy, 11);
        const m = cur.length, off = s2 * 0.55;
        const ox = P.x + P.w - 16 - s2 - off * (m - 1);
        cur.forEach((o, j) => mui.portraitFrame(o.look, ox + j * off, cy - s2 / 2, s2, { edge: '#b8442f', bg1: '#f0c8a0', bg2: '#b07a4a' }));
        D().text(curNames, ox - 6, cy, { size: 7, bold: true, align: 'right', baseline: 'middle', color: '#2b1d14', maxW: 0 });
      } else {
        const big = U.clamp(Math.min((P.w - 20) * 0.27, dh - 40), 24, 72);
        const lx = P.x + 10 + (P.w - 20) * 0.25, rx = P.x + 10 + (P.w - 20) * 0.75;
        const cy = dy + dh / 2 - 6;
        D().circle(lx, cy, big * 0.75, 'rgba(255,240,190,0.5)');
        D().circle(rx, cy, big * 0.75, 'rgba(255,200,170,0.4)');
        mui.portraitFrame(G.state.look || 'hero', lx - big / 2, cy - big / 2, big, { edge: '#3b6fc4' });
        D().text(G.state.name || 'You', lx, cy + big / 2 + 5, { size: 8, align: 'center', bold: true, color: '#2b1d14' });
        D().text(`Level ${G.state.level}`, lx, cy + big / 2 + 15, { size: 6, align: 'center', color: '#7a4b2a' });
        const m = cur.length;
        const ob = m > 1 ? big * 0.75 : big;
        const off = m > 1 ? Math.min(ob * 0.5, ((P.w - 20) * 0.45 - ob) / (m - 1)) : 0;
        cur.forEach((o, j) => mui.portraitFrame(o.look, rx - (ob + off * (m - 1)) / 2 + j * off, cy - ob / 2 + (j % 2) * 4, ob, { edge: '#b8442f', bg1: '#f0c8a0', bg2: '#b07a4a' }));
        ctx().font = D().font(7, true);
        U.wrapText(ctx(), curNames, (P.w - 20) * 0.46).slice(0, 3)
          .forEach((l, k) => D().text(l, rx, cy + big / 2 + 5 + k * 9, { size: 7, align: 'center', bold: true, color: '#2b1d14' }));
        vsBadge(P.x + P.w / 2, cy, 13);
        D().text(`Round ${Math.min(S.round + 1, n)} of ${n}`, P.x + P.w / 2, dy + 5, { size: 6, align: 'center', color: '#8a5a2a' });
        // prize preview
        const rw = rewardFor(cup);
        const it = rw.item && G.items[rw.item];
        const py2 = dy + 18;
        const txt = `${rw.gold}g  ·  ${rw.xp} XP` + (it ? '  ·  ' + it.name : '') + (rw.seal ? '  ·  Seal' : '');
        const tw = D().measure(txt, 7) + 22;
        mui.icon('trophy', P.x + P.w / 2 - tw / 2 + 6, py2 + 4, 10);
        D().text(txt, P.x + P.w / 2 - tw / 2 + 14, py2 + 4.5, { size: 7, baseline: 'middle', color: '#5a3418', bold: true });
      }
      // ---- buttons
      if (S.mode !== 'ladder') return;
      if (!S.paid) {
        const bw = Math.min(140, (P.w - 30) * 0.6);
        if (nav.btn('back', P.x + 10, by, P.w - 30 - bw, btnH, 'Back', { color: '#8a6a4a', sfx: 'cancel' })) { setMode('hall'); resolveWait('back'); }
        if (nav.btn('go', P.x + P.w - 10 - bw, by, bw, btnH, cup.fee ? `Begin (${cup.fee}g)` : 'Begin!', { color: '#b8442f', icon: 'trophy', pri: true, sfx: 'confirm' })) resolveWait('go');
      } else {
        const bw = Math.min(180, P.w - 20);
        if (nav.btn('go', P.x + P.w / 2 - bw / 2, by, bw, btnH, S.round === n - 1 ? 'To the Final!' : `Fight Round ${S.round + 1}!`, { color: '#b8442f', icon: 'weapon', pri: true, sfx: 'confirm' })) resolveWait('go');
      }
      if (!nav.focus && !G.input.lastWasTouch) nav.focus = 'go';
    }

    // -------------------------------------------------- cards
    function drawCard() {
      const c = ctx(), W = G.W, H = G.H, C = S.card;
      const k = U.clamp(S.t / 0.25, 0, 1), out = U.clamp((S.t - (C.dur - 0.25)) / 0.25, 0, 1);
      c.globalAlpha = 0.75 * k * (1 - out);
      D().rect(0, 0, W, H, '#140a05');
      c.globalAlpha = 1 - out;
      const e = U.ease.outBack(k);
      const cy = H / 2;
      const bw = Math.min(W - 20, 260) * e;
      if (C.kind === 'advance') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + S.t;
          c.fillStyle = 'rgba(255,214,100,0.18)';
          c.beginPath(); c.moveTo(W / 2, cy); c.lineTo(W / 2 + Math.cos(a) * 300, cy + Math.sin(a) * 300); c.lineTo(W / 2 + Math.cos(a + 0.18) * 300, cy + Math.sin(a + 0.18) * 300); c.fill();
        }
      }
      mui.ribbon(W / 2, cy - 18, Math.max(20, bw), C.title, C.kind === 'advance' ? '#4a8a3a' : '#b23a3a', { size: 14, h: 28 });
      D().text(C.sub, W / 2, cy + 18, { size: 8, align: 'center', color: '#fff3d6', outline: '#2b1d14', outlineW: 2.5 });
      if (C.names) D().text('vs ' + C.names, W / 2, cy + 31, { size: 9, align: 'center', bold: true, color: '#ffe48a', outline: '#2b1d14', outlineW: 3, maxW: W - 30 });
      c.globalAlpha = 1;
    }

    // -------------------------------------------------- reward
    // Stack of reward elements; portrait = one column, landscape = two columns.
    function rewardLayout() {
      const W = G.W, H = G.H, R = S.reward;
      const land = !narrow();
      const ts = Math.min(60, Math.min(W, H) * (land ? 0.22 : 0.2));
      const L = { land, ts, cx: W / 2 };
      if (land) {
        const lx = W * 0.3, rx = W * 0.7;
        L.cont = { x: rx, y: H - 34 };
        L.trophy = { x: lx, y: Math.max(H * 0.14, 38) + 22 + ts / 2 };
        L.sub = { x: lx, y: L.trophy.y + ts / 2 + 6 };
        L.counters = { x: lx, y: L.sub.y + 14 };
        const items = [R.tl.item != null && 'item', R.tl.seal != null && 'seal', R.tl.rank != null && 'rank'].filter(Boolean);
        const hs = { item: 40, seal: 62, rank: 30 };
        let tot = items.reduce((a, k) => a + hs[k], 0), y = Math.max(40, (H - 40 - tot) / 2 + 6);
        for (const k of items) { L[k] = { x: rx, y: y + hs[k] / 2 }; y += hs[k]; }
        L.victory = { x: lx, y: L.trophy.y - ts / 2 - 22 };
        return L;
      }
      const parts = [['victory', 26], ['trophy', ts + 6], ['sub', 16], ['counters', 44]];
      if (R.tl.item != null) parts.push(['item', 42]);
      if (R.tl.seal != null) parts.push(['seal', 68]);
      if (R.tl.rank != null) parts.push(['rank', 32]);
      const tot = parts.reduce((a, p) => a + p[1], 0);
      let y = Math.max(8, (H - 40 - tot) / 2);
      for (const [k, h] of parts) { L[k] = { x: W / 2, y: k === 'victory' || k === 'sub' || k === 'counters' ? y : y + h / 2 }; y += h; }
      return L;
    }
    function drawReward() {
      const c = ctx(), W = G.W, H = G.H, R = S.reward, t = S.t, L = rewardLayout();
      // light rays behind the trophy
      c.save(); c.translate(L.trophy.x, L.trophy.y); c.rotate(t * 0.3);
      for (let i = 0; i < 14; i++) {
        c.rotate((Math.PI * 2) / 14);
        c.fillStyle = 'rgba(255,220,120,0.13)';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.max(W, H), -30); c.lineTo(Math.max(W, H), 30); c.fill();
      }
      c.restore();
      const k = U.clamp(t / 0.6, 0, 1);
      const ts = L.ts * U.ease.outBack(k);
      if (ts > 1) {
        D().circle(L.trophy.x, L.trophy.y, ts * 0.7, 'rgba(255,240,180,0.25)');
        mui.icon(R.rw.seal === 'grand' ? 'crown' : 'trophy', L.trophy.x, L.trophy.y + Math.sin(t * 2) * 2, ts);
      }
      D().text('VICTORY!', L.victory.x, L.victory.y, { size: 18, align: 'center', bold: true, color: '#ffe48a', outline: '#3a1a10', outlineW: 4 });
      D().text(S.cup.name + (R.rw.first ? ' — Champion!' : ' — won again!'), L.sub.x, L.sub.y, { size: 8, align: 'center', color: '#fff3d6', outline: '#2b1d14', outlineW: 2.5 });
      // counters
      const gk = U.clamp((t - R.tl.gold) / 0.8, 0, 1), xk = U.clamp((t - R.tl.xp) / 0.8, 0, 1);
      if (t >= R.tl.gold - 0.1) {
        const ww = Math.min(W * (L.land ? 0.4 : 1) - 24, 190), px = L.counters.x - ww / 2, y = L.counters.y;
        D().rrect(px, y + 2, ww, 38, 6, 'rgba(0,0,0,0.35)');
        D().rrect(px, y, ww, 38, 6, 'rgba(40,24,12,0.88)', '#c9962e', 1.2);
        mui.icon('coin', px + 14, y + 11, 12);
        D().text(`+${Math.round(R.rw.gold * U.ease.outQuad(gk))}`, px + 25, y + 11.5, { size: 10, baseline: 'middle', bold: true, color: '#ffe48a' });
        D().text('gold', px + ww - 8, y + 11.5, { size: 7, align: 'right', baseline: 'middle', color: '#c9a36a' });
        if (t >= R.tl.xp - 0.1) {
          D().text('XP', px + 14, y + 27, { size: 7, align: 'center', baseline: 'middle', bold: true, color: '#8fd3ff' });
          D().text(`+${Math.round(R.rw.xp * U.ease.outQuad(xk))}`, px + 25, y + 27.5, { size: 10, baseline: 'middle', bold: true, color: '#8fd3ff' });
          if (R.ups && xk >= 1) mui.chip(px + ww - 6, y + 22, `Level ${G.state.level}!`, '#4a8a3a', { align: 'right', size: 7 });
          else D().text('experience', px + ww - 8, y + 27.5, { size: 7, align: 'right', baseline: 'middle', color: '#7aa8c8' });
        }
        if (!R.rw.first) D().text('Repeat win: half purse', L.counters.x, y + 44, { size: 6, align: 'center', color: 'rgba(255,243,214,0.7)' });
      }
      // item card
      if (R.tl.item != null && t >= R.tl.item) {
        const ik = U.ease.outBack(U.clamp((t - R.tl.item) / 0.4, 0, 1));
        const it = G.items[R.rw.item];
        c.save(); c.translate(L.item.x, L.item.y); c.scale(ik, ik);
        const w = Math.min(170, W * (L.land ? 0.38 : 0.8));
        D().rrect(-w / 2, -15, w, 32, 5, 'rgba(0,0,0,0.35)');
        D().rrect(-w / 2, -17, w, 32, 5, '#f4e4c1', '#7a4b2a', 1.5);
        mui.itemIcon(it, -w / 2 + 17, -1, 16);
        D().text('NEW ITEM!', -w / 2 + 32, -11, { size: 6, color: '#b8442f' });
        D().text((R.rw.qty > 1 ? R.rw.qty + '× ' : '') + it.name, -w / 2 + 32, -2, { size: 8, bold: true, color: '#2b1d14' });
        c.restore();
      }
      // seal ceremony
      if (R.tl.seal != null && t >= R.tl.seal) {
        const sk = U.clamp((t - R.tl.seal) / 0.7, 0, 1);
        const sd = mui.SEALS.find((s2) => s2.id === R.rw.seal);
        const sx = L.seal.x, sy = L.seal.y - 8;
        const r = 18 * U.ease.outElastic(sk);
        if (sd && r > 0.5) {
          D().circle(sx, sy, r * 1.6, 'rgba(255,230,140,0.18)');
          mui.sealBadge(sd, sx, sy, r, true, G.time);
          for (let i = 0; i < 6; i++) {
            const a = G.time * 1.6 + i * 1.047, rr = 27 + Math.sin(G.time * 3 + i) * 3;
            const tw = Math.abs(Math.sin(G.time * 6 + i * 2));
            const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
            D().rect(px - 2.5 * tw, py - 0.4, 5 * tw, 0.8, '#fff8d0'); D().rect(px - 0.4, py - 2.5 * tw, 0.8, 5 * tw, '#fff8d0');
          }
          c.globalAlpha = sk;
          D().text(SEAL_NAMES[sd.id] || sd.name, sx, sy + 30, { size: 10, align: 'center', bold: true, color: '#ffe48a', outline: '#3a1a10', outlineW: 3 });
          c.globalAlpha = 1;
        }
      }
      // rank banner
      if (R.tl.rank != null && t >= R.tl.rank) {
        const rk = U.ease.outBack(U.clamp((t - R.tl.rank) / 0.5, 0, 1));
        const dn = (mui.DISC[R.rankUp.d] || {}).name || '';
        mui.ribbon(L.rank.x, L.rank.y - 10, Math.max(10, Math.min(W * (L.land ? 0.4 : 1) - 40, 200) * rk), `${dn} rank: ${R.rankUp.to}!`, '#7a5aa8', { size: 9, h: 20 });
      }
      // continue
      if (t >= R.end) {
        const bw = 130, bh = 26;
        const cx2 = L.cont ? L.cont.x : W / 2;
        if (nav.btn('cont', cx2 - bw / 2, H - bh - 8, bw, bh, 'Continue', { color: '#5a8a3a', pri: true, sfx: 'confirm' })) resolveWait('ok');
        if (!G.input.lastWasTouch) nav.focus = 'cont';
      } else D().text('tap to skip', W / 2, H - 12, { size: 6, align: 'center', color: 'rgba(255,243,214,0.6)' });
    }

    function drawElim() {
      const W = G.W, H = G.H, t = S.t, E = S.elim;
      const k = U.ease.outBack(U.clamp(t / 0.5, 0, 1));
      const cy = H * (narrow() ? 0.4 : 0.38);
      // broken blade
      const c = ctx();
      c.save(); c.translate(W / 2 - 8, cy - 30); c.rotate(-0.4 * k); mui.icon('weapon', 0, 0, 30 * k, { color: '#9aa0aa' }); c.restore();
      c.save(); c.translate(W / 2 + 12, cy - 22 + 6 * k); c.rotate(0.9 * k); c.beginPath(); c.rect(-20, -20, 40, 20); c.clip(); mui.icon('weapon', 0, 0, 24 * k, { color: '#9aa0aa' }); c.restore();
      mui.ribbon(W / 2, cy, Math.min(W - 40, 210) * k + 1, 'Eliminated', '#6a5a5a', { size: 13, h: 26 });
      D().text(`You fell in round ${E.wonRounds + 1} of ${E.n}.`, W / 2, cy + 38, { size: 8, align: 'center', color: '#fff3d6', outline: '#2b1d14', outlineW: 2.5 });
      D().text(E.xp > 0 ? `+${E.xp} XP for the rounds you won` : 'Train hard and try again!', W / 2, cy + 52, { size: 8, align: 'center', color: E.xp > 0 ? '#8fd3ff' : '#ffe48a', outline: '#2b1d14', outlineW: 2.5 });
      if (S.cup.fee) D().text(`(Entry fee: ${S.cup.fee}g)`, W / 2, cy + 66, { size: 6, align: 'center', color: 'rgba(255,243,214,0.7)' });
      if (t >= 1.4) {
        const bw = 130, bh = 26;
        if (nav.btn('cont', W / 2 - bw / 2, H - bh - 10, bw, bh, 'Continue', { color: '#8a6a4a', pri: true, sfx: 'confirm' })) resolveWait('ok');
        if (!G.input.lastWasTouch) nav.focus = 'cont';
      }
    }

    // -------------------------------------------------- backdrop: the stands
    function drawBackdrop(c, S2) {
      const W = G.W, H = G.H;
      const dark = S2.mode === 'reward' || S2.mode === 'elim';
      const g = c.createLinearGradient(0, 0, 0, H);
      if (S2.mode === 'elim') { g.addColorStop(0, '#2a2030'); g.addColorStop(1, '#141018'); }
      else { g.addColorStop(0, '#3a6fa8'); g.addColorStop(0.55, '#8fc6e8'); g.addColorStop(1, '#d9b77a'); }
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // stands with crowd
      const sy = H * 0.12;
      D().rect(0, sy, W, H * 0.22, '#6a3b1f');
      for (let i = 0; i < 3; i++) D().rect(0, sy + 6 + i * H * 0.07, W, 2, '#4a2a14');
      drawCrowd(S2.crowd, sy, H * 0.22);
      // banners
      const cols = ['#b23a3a', '#3b6fc4', '#f2c14e', '#4a8a3a'];
      for (let x = 6, i = 0; x < W; x += 34, i++) {
        const sw = Math.sin(G.time * 2 + i) * 1.5;
        c.fillStyle = cols[i % 4];
        c.beginPath(); c.moveTo(x, sy - 2); c.lineTo(x + 12, sy - 2); c.lineTo(x + 12 + sw, sy + 14); c.lineTo(x + 6 + sw, sy + 10); c.lineTo(x + sw, sy + 14); c.fill();
        D().rect(x - 1, sy - 4, 14, 2, '#c9962e');
      }
      // pennant line
      c.strokeStyle = '#4a2a14'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, 6);
      for (let x = 0; x <= W; x += 12) c.lineTo(x, 6 + Math.sin(x * 0.05) * 3);
      c.stroke();
      for (let x = 4, i = 0; x < W; x += 12, i++) {
        c.fillStyle = cols[i % 4];
        const yy = 6 + Math.sin(x * 0.05) * 3;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 6, yy); c.lineTo(x + 3, yy + 6); c.fill();
      }
      if (dark) { c.fillStyle = S2.mode === 'elim' ? 'rgba(10,6,12,0.7)' : 'rgba(20,10,4,0.55)'; c.fillRect(0, 0, W, H); }
      else { c.fillStyle = 'rgba(20,12,8,0.25)'; c.fillRect(0, 0, W, H); }
    }
    function makeCrowd() {
      const rng = U.rng(42);
      return Array.from({ length: 90 }, () => ({ x: rng(), row: Math.floor(rng() * 3), c: ['#d6453d', '#3f7fd1', '#f2c14e', '#5bb04a', '#c9a36a', '#7b3fb5', '#e8e2d2'][Math.floor(rng() * 7)], ph: rng() * 6, skin: ['#f1c27d', '#c98e5d', '#e8b98a', '#8a5a3a'][Math.floor(rng() * 4)] }));
    }
    function updateCrowd() { /* animated in draw via G.time */ }
    function drawCrowd(crowd, sy, sh) {
      const W = G.W;
      const cheer = S.mode === 'reward' || S.mode === 'card' ? 1 : 0.3;
      for (const p of crowd) {
        const x = p.x * W, y = sy + 4 + p.row * sh * 0.32 + sh * 0.22;
        const jump = Math.max(0, Math.sin(G.time * (6 + p.ph) + p.ph)) * 2.5 * cheer;
        D().rect(x - 2.5, y - 5 - jump, 5, 6, p.c);
        D().circle(x, y - 7.5 - jump, 2.2, p.skin);
        if (cheer > 0.5 && Math.sin(G.time * 5 + p.ph) > 0.4) D().rect(x + 2, y - 11 - jump, 1, 4, p.skin);
      }
    }

    return mui.runScene(def).then((v) => v || null).then((v) => { void done; return v; });
  }

  G.tournament = { run, check, statusOf, rewardFor, oppsOf };
  G.cmd = G.cmd || {};
  G.cmd.tournament = (hallId) => G.tournament.run(hallId);
})();
