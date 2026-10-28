/**
 * Dashboard renderer. Plain DOM + inline SVG, no dependencies, so the same
 * file runs inside the Next.js page and inline in the published snapshot.
 * @param {HTMLElement} root
 * @param {import("@/lib/dashboard-data").DashboardData & { note?: string }} data
 */
export function renderDashboard(root, data) {
  const months = data.months;
  const state = { month: months[months.length - 1] };
  const SLOT_VARS = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"];
  const catColor = (c) => (c.slot ? `var(${SLOT_VARS[c.slot - 1]})` : "var(--s-other)");
  const cats = data.categories;
  const visible = cats.filter((c) => c.slot);
  const otherCats = cats.filter((c) => !c.slot);
  const totalBudget = cats.reduce((s, c) => s + (c.budget ?? 0), 0);

  const usd = (n, opts = {}) => {
    const abs = Math.abs(n);
    const s = opts.compact && abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return (n < 0 ? "−" : "") + s;
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mShort = (m) => MONTHS[+m.slice(5, 7) - 1];
  const mLong = (m) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const monthTotal = (m) => Object.values(data.spend[m] ?? {}).reduce((a, b) => a + b, 0);
  const otherTotal = (m) => otherCats.reduce((s, c) => s + (data.spend[m]?.[c.name] ?? 0), 0);
  const isPartial = (m) => data.latestDate && data.latestDate.slice(0, 7) === m && +data.latestDate.slice(8, 10) < 28;

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) n.append(c);
    return n;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs = {}, children = []) {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) n.append(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }
  const niceStep = (max) => {
    const raw = max / 3;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  };

  // ---------- header ----------
  function header() {
    const m = state.month;
    const partial = isPartial(m);
    const h = el("header", { class: "head" }, [
      el("div", { class: "eyebrow" }, "Household ledger"),
      el("h1", {}, mLong(m)),
      el("div", { class: "sub" }, m === months[months.length - 1] && data.latestDate ? `Through ${mLong(m).split(" ")[0]} ${+data.latestDate.slice(8, 10)}${partial ? " so far" : ""}` : "Full month"),
    ]);
    const chips = el("nav", { class: "months", "aria-label": "Month" });
    for (const mm of months) {
      chips.append(
        el("button", { type: "button", id: `m-${mm}`, "aria-pressed": String(mm === m), onclick: () => { state.month = mm; draw(); } }, mShort(mm)),
      );
    }
    h.append(chips);
    return h;
  }

  // ---------- tiles ----------
  function tiles() {
    const m = state.month;
    const spent = monthTotal(m);
    const bal = data.balance[m] ?? 0;
    const pct = totalBudget ? spent / totalBudget : 0;
    const spentTile = el("div", { class: "tile" }, [
      el("div", { class: "label" }, "Spent"),
      el("div", { class: "value num" }, usd(spent)),
      totalBudget
        ? el("div", { class: `note ${pct > 1 ? "over" : ""}` }, pct > 1 ? `${usd(spent - totalBudget)} over the ${usd(totalBudget, { compact: true })} budget` : `${Math.round(pct * 100)}% of ${usd(totalBudget, { compact: true })} budget`)
        : el("div", { class: "note" }, "No budget set"),
      totalBudget ? el("div", { class: "meter" }, el("i", { class: pct > 1 ? "over" : "", style: `width:${Math.min(100, pct * 100)}%` })) : null,
    ]);
    const who = Math.abs(bal) < 1 ? "Even" : bal > 0 ? "She owes you" : "You owe her";
    const balTile = el("div", { class: "tile" }, [
      el("div", { class: "label" }, "Balance"),
      el("div", { class: "value num" }, Math.abs(bal) < 1 ? "$0" : usd(Math.abs(bal))),
      el("div", { class: "note" }, `${who} · running total since ${mShort(months[0])}`),
    ]);
    return el("div", { class: "tiles" }, [spentTile, balTile]);
  }

  // ---------- stacked bars ----------
  function stackedChart() {
    const W = 360, H = 230, padL = 34, padR = 6, padT = 22, padB = 22;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxVal = Math.max(totalBudget, ...months.map(monthTotal), 1);
    const step = niceStep(maxVal);
    const top = Math.ceil((maxVal * 1.08) / step) * step;
    const y = (v) => padT + innerH - (v / top) * innerH;
    const slot = innerW / months.length;
    const barW = Math.min(44, slot * 0.62);
    const s = svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Monthly spend by category" });
    for (let v = 0; v <= top; v += step) {
      s.append(svg("line", { class: v === 0 ? "baseline" : "grid", x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
      s.append(svg("text", { x: padL - 6, y: y(v) + 4, "text-anchor": "end" }, usd(v, { compact: true })));
    }
    if (totalBudget) {
      s.append(svg("line", { class: "budget", x1: padL, x2: W - padR, y1: y(totalBudget), y2: y(totalBudget) }));
      s.append(svg("text", { x: W - padR, y: y(totalBudget) - 4, "text-anchor": "end" }, "budget"));
    }
    months.forEach((m, i) => {
      const cx = padL + slot * i + slot / 2;
      const x = cx - barW / 2;
      const g = svg("g", { class: `col ${m === state.month ? "" : "dim"}`, onclick: () => { state.month = m; draw(); } });
      const total = monthTotal(m);
      const clipId = `clip-${m}`;
      const defs = svg("defs", {}, svg("clipPath", { id: clipId }, svg("rect", { x, y: y(total), width: barW, height: Math.max(0, innerH - (y(total) - padT)), rx: 4 })));
      g.append(defs);
      const inner = svg("g", { "clip-path": `url(#${clipId})` });
      let acc = 0;
      const segs = [...visible.map((c) => [c.name, data.spend[m]?.[c.name] ?? 0, catColor(c)]), ["Other", otherTotal(m), "var(--s-other)"]];
      for (const [name, v, color] of segs) {
        if (v <= 0) continue;
        const y0 = y(acc + v), h = y(acc) - y(acc + v);
        const r = svg("rect", { class: "seg", x, y: y0, width: barW, height: h, style: `fill:${color}` });
        r.append(svg("title", {}, `${name}: ${usd(v)} (${mLong(m)})`));
        inner.append(r);
        acc += v;
      }
      g.append(inner);
      // tap target over the whole column
      g.append(svg("rect", { x: padL + slot * i, y: padT - 16, width: slot, height: innerH + 16, fill: "transparent" }));
      g.append(svg("text", { class: `total ${m === state.month ? "sel" : ""}`, x: cx, y: y(total) - 6, "text-anchor": "middle" }, total ? usd(total, { compact: true }) : ""));
      g.append(svg("text", { class: `month ${m === state.month ? "sel" : ""}`, x: cx, y: H - 6, "text-anchor": "middle" }, mShort(m)));
      s.append(g);
    });
    const legend = el("div", { class: "legend" }, [
      ...visible.map((c) => el("span", {}, [el("i", { style: `background:${catColor(c)}` }), c.name])),
      otherCats.length ? el("span", {}, [el("i", { style: "background:var(--s-other)" }), `Other (${otherCats.length})`]) : null,
    ]);
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Spend by category"), el("div", { class: "sub" }, "Tap a month")]),
      s,
      legend,
    ]);
  }

  // ---------- horizontal split bars ----------
  function hBar(parts, total, ariaLabel) {
    const W = 360, H = 30;
    const s = svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ariaLabel });
    s.append(svg("defs", {}, svg("clipPath", { id: `hb-${ariaLabel.replace(/\W/g, "")}` }, svg("rect", { x: 0, y: 0, width: W, height: H, rx: 6 }))));
    const g = svg("g", { "clip-path": `url(#hb-${ariaLabel.replace(/\W/g, "")})` });
    let x = 0;
    if (!total) {
      g.append(svg("rect", { x: 0, y: 0, width: W, height: H, style: "fill:var(--grid)" }));
    }
    for (const p of parts) {
      if (!p.value) continue;
      const w = (p.value / total) * W;
      const r = svg("rect", { class: "seg", x, y: 0, width: w, height: H, style: `fill:${p.color}` });
      r.append(svg("title", {}, `${p.label}: ${usd(p.value)}`));
      g.append(r);
      if (w > 44) g.append(svg("text", { class: `inside ${p.darkText ? "dark" : ""}`, x: x + w / 2, y: H / 2 + 4, "text-anchor": "middle" }, `${Math.round((p.value / total) * 100)}%`));
      x += w;
    }
    s.append(g);
    return s;
  }
  function splitSection() {
    const m = state.month;
    const sp = data.split[m] ?? { me: 0, her: 0, shared: 0 };
    const pd = data.paid[m] ?? { me: 0, her: 0, joint: 0 };
    const al = data.allocated[m] ?? { me: 0, her: 0 };
    const t1 = sp.me + sp.her + sp.shared;
    const t2 = pd.me + pd.her + pd.joint;
    const forParts = [
      { label: "Shared", value: sp.shared, color: "var(--shared)" },
      { label: "Me", value: sp.me, color: "var(--me)" },
      { label: "Her", value: sp.her, color: "var(--her)" },
    ];
    const paidParts = [
      { label: "Joint account", value: pd.joint, color: "var(--shared)" },
      { label: "Me", value: pd.me, color: "var(--me)" },
      { label: "Her", value: pd.her, color: "var(--her)" },
    ];
    const legend = (parts) => el("div", { class: "legend" }, parts.map((p) => el("span", {}, [el("i", { style: `background:${p.color}` }), `${p.label} `, el("b", { class: "num" }, usd(p.value))])));
    const monthBal = pd.me + pd.joint / 2 - al.me;
    const settle = Math.abs(monthBal) < 1 ? "This month came out even." : monthBal > 0 ? `This month alone, she owes you ${usd(monthBal)}.` : `This month alone, you owe her ${usd(-monthBal)}.`;
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Who it was for, who paid"), el("div", { class: "sub" }, mShort(m))]),
      el("div", { class: "bar-row" }, [
        el("div", { class: "bar-title" }, [el("span", {}, "Allocated to"), el("b", { class: "num" }, `My share ${usd(al.me)} · hers ${usd(al.her)}`)]),
        hBar(forParts, t1, "Allocation this month"),
        legend(forParts),
      ]),
      el("div", { class: "bar-row" }, [
        el("div", { class: "bar-title" }, [el("span", {}, "Paid from"), el("b", { class: "num" }, usd(t2))]),
        hBar(paidParts, t2, "Who paid this month"),
        legend(paidParts),
      ]),
      el("div", { class: "sub" }, `${settle} Joint-account money counts half each.`),
    ]);
  }

  // ---------- running balance ----------
  function balanceChart() {
    const W = 360, H = 150, padL = 34, padR = 6, padT = 18, padB = 22;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const vals = months.map((m) => data.balance[m] ?? 0);
    const step = niceStep(Math.max(1, ...vals.map(Math.abs)));
    const hi = Math.max(step, Math.ceil(Math.max(0, ...vals) / step) * step);
    const lo = Math.min(0, Math.floor(Math.min(0, ...vals) / step) * step);
    const y = (v) => padT + ((hi - v) / (hi - lo)) * innerH;
    const slot = innerW / months.length;
    const barW = Math.min(44, slot * 0.62);
    const s = svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Running balance by month" });
    for (const v of [...new Set([lo, 0, hi])]) {
      s.append(svg("line", { class: v === 0 ? "baseline" : "grid", x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
      s.append(svg("text", { x: padL - 6, y: y(v) + 4, "text-anchor": "end" }, usd(v, { compact: true })));
    }
    months.forEach((m, i) => {
      const v = vals[i];
      const cx = padL + slot * i + slot / 2;
      const y0 = Math.min(y(0), y(v)), h = Math.abs(y(v) - y(0));
      const g = svg("g", { class: `col ${m === state.month ? "" : "dim"}`, onclick: () => { state.month = m; draw(); } });
      const r = svg("rect", { class: "seg", x: cx - barW / 2, y: y0, width: barW, height: Math.max(h, 1.5), rx: 3, style: `fill:${v >= 0 ? "var(--me)" : "var(--her)"}` });
      r.append(svg("title", {}, `${mLong(m)}: ${v >= 0 ? "she owes you" : "you owe her"} ${usd(Math.abs(v))}`));
      g.append(r);
      g.append(svg("rect", { x: padL + slot * i, y: padT - 14, width: slot, height: innerH + 14, fill: "transparent" }));
      g.append(svg("text", { class: "sign", x: cx, y: v >= 0 ? y0 - 5 : y0 + h + 12, "text-anchor": "middle" }, usd(v, { compact: true })));
      g.append(svg("text", { class: `month ${m === state.month ? "sel" : ""}`, x: cx, y: H - 6, "text-anchor": "middle" }, mShort(m)));
      s.append(g);
    });
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Running balance"), el("div", { class: "sub" }, "Cumulative")]),
      s,
      el("div", { class: "legend" }, [
        el("span", {}, [el("i", { style: "background:var(--me)" }), "She owes you"]),
        el("span", {}, [el("i", { style: "background:var(--her)" }), "You owe her"]),
      ]),
    ]);
  }

  // ---------- category table ----------
  function table() {
    const m = state.month;
    const i = months.indexOf(m);
    const prev = i > 0 ? months[i - 1] : null;
    const window3 = months.slice(Math.max(0, i - 2), i + 1);
    const rows = cats
      .map((c) => {
        const cur = data.spend[m]?.[c.name] ?? 0;
        const last = prev ? data.spend[prev]?.[c.name] ?? 0 : null;
        const avg = window3.reduce((s, mm) => s + (data.spend[mm]?.[c.name] ?? 0), 0) / window3.length;
        return { c, cur, last, avg };
      })
      .filter((r) => r.cur > 0 || r.avg > 0)
      .sort((a, b) => b.cur - a.cur);
    const tbl = el("table", { class: "cats" });
    tbl.append(el("thead", {}, el("tr", {}, [el("th", {}, "Category"), el("th", {}, mShort(m)), el("th", {}, prev ? `vs ${mShort(prev)}` : "vs last"), el("th", {}, "3-mo avg")])));
    const body = el("tbody");
    for (const { c, cur, last, avg } of rows) {
      let delta;
      if (last == null || (last === 0 && cur === 0)) delta = el("td", { class: "delta flat num" }, "—");
      else if (last === 0) delta = el("td", { class: "delta up num" }, "new");
      else {
        const pct = (cur - last) / last;
        const cls = Math.abs(pct) < 0.03 ? "flat" : pct > 0 ? "up" : "down";
        const arrow = cls === "up" ? "↑" : cls === "down" ? "↓" : "→";
        delta = el("td", { class: `delta ${cls} num`, title: `${usd(last)} last month` }, `${arrow} ${Math.abs(Math.round(pct * 100))}%`);
      }
      const name = el("div", { class: "name" }, [el("i", { style: `background:${catColor(c)}` }), c.name]);
      let budget = null;
      if (c.budget) {
        const p = cur / c.budget;
        budget = el("div", { class: `budget ${p > 1 ? "over" : ""}` }, [
          el("div", { class: "meter" }, el("i", { class: p > 1 ? "over" : "", style: `width:${Math.min(100, p * 100)}%` })),
          el("span", { class: "num" }, p > 1 ? `${usd(cur - c.budget)} over ${usd(c.budget, { compact: true })}` : `of ${usd(c.budget, { compact: true })}`),
        ]);
      }
      body.append(el("tr", {}, [el("td", {}, [name, budget]), el("td", { class: "main num" }, usd(cur)), delta, el("td", { class: "avg num" }, usd(avg))]));
    }
    tbl.append(body);
    const note = isPartial(m) ? `${mShort(m)} is still in progress, so comparisons against a full month will read low.` : "Arrows compare with the previous month. Budgets are monthly.";
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Categories"), el("div", { class: "sub" }, mLong(m))]),
      el("div", { class: "table-wrap" }, rows.length ? tbl : el("div", { class: "empty" }, "No spending recorded this month.")),
      el("div", { class: "sub" }, note),
    ]);
  }

  // ---------- review ----------
  function review() {
    const r = data.review;
    if (!r.count) return null;
    const list = el("div", { class: "review" }, r.merchants.map((x) => el("div", { class: "row" }, [el("span", { class: "m" }, x.merchant), el("span", { class: "c num" }, `${x.count} × · ${usd(x.total)}`)])));
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Needs a look"), el("span", { class: "pill warn" }, `${r.count} split 50/50 for now`)]),
      el("div", { class: "sub" }, "Merchants nobody has told the app about yet. Each becomes a rule once you decide whose it is."),
      list,
    ]);
  }

  function foot() {
    const src = Object.entries(data.counts.bySource).map(([k, v]) => `${v} by ${k}`).join(", ");
    return el("footer", { class: "foot" }, [
      el("div", {}, data.note ?? ""),
      el("div", {}, `${data.counts.transactions} transactions through ${data.latestDate ?? "—"} · ${src}.`),
    ]);
  }

  function draw() {
    root.innerHTML = "";
    root.className = "dash";
    if (!months.length) {
      root.append(el("div", { class: "empty" }, "No transactions yet. Import a CSV or sync Plaid, then run classify."));
      return;
    }
    root.append(header(), tiles(), stackedChart(), splitSection(), balanceChart(), table(), review(), foot());
  }
  draw();
}
