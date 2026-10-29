/**
 * Dashboard renderer. Plain DOM + inline SVG, no dependencies, so the same
 * file runs inside the Next.js page and inline in the published snapshot.
 * @param {HTMLElement} root
 * @param {import("@/lib/dashboard-data").DashboardData & { note?: string, reviewHref?: string, banksHref?: string, categoryHref?: string }} data
 */
export function renderDashboard(root, data) {
  const months = data.months;
  const state = { month: months[months.length - 1] };
  const ME = data.people?.me ?? "Me", HER = data.people?.her ?? "Her";
  const EMPTY = { me: 0, her: 0, shared: 0, undecided: 0 };
  const splitOf = (m) => ({ ...EMPTY, ...(data.split[m] ?? {}) });
  const splitTotal = (p) => p.me + p.her + p.shared + p.undecided;
  const splitParts = (p) => [
    { label: "Shared", value: p.shared, color: "var(--shared)" },
    { label: ME, value: p.me, color: "var(--me)" },
    { label: HER, value: p.her, color: "var(--her)" },
    { label: "Undecided", value: p.undecided, color: "var(--undecided)", darkText: true },
  ];
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
    const pct = totalBudget ? spent / totalBudget : 0;
    const spentTile = el("div", { class: "tile" }, [
      el("div", { class: "label" }, "Spent"),
      el("div", { class: "value num" }, usd(spent)),
      totalBudget
        ? el("div", { class: `note ${pct > 1 ? "over" : ""}` }, pct > 1 ? `${usd(spent - totalBudget)} over the ${usd(totalBudget, { compact: true })} budget` : `${Math.round(pct * 100)}% of ${usd(totalBudget, { compact: true })} budget`)
        : el("div", { class: "note" }, "No budget set"),
      totalBudget ? el("div", { class: "meter" }, el("i", { class: pct > 1 ? "over" : "", style: `width:${Math.min(100, pct * 100)}%` })) : null,
      ...paceNotes(m, monthTotal),
    ]);
    const all = splitOf(m);
    const tot = splitTotal(all);
    const pc = (v) => (tot ? Math.round((v / tot) * 100) : 0);
    const balTile = el("div", { class: "tile" }, [
      el("div", { class: "label" }, "Shared"),
      el("div", { class: "value num" }, `${pc(all.shared)}%`),
      el("div", { class: "note" }, tot ? `${ME} ${pc(all.me)}% \u00b7 ${HER} ${pc(all.her)}%${all.undecided ? ` \u00b7 ${pc(all.undecided)}% undecided` : ""}` : "No spending yet"),
    ]);
    return el("div", { class: "tiles" }, [spentTile, balTile]);
  }

  /**
   * "On pace for $X this month" (spend so far / days elapsed x days in the
   * month) for a month in progress, and "about $Y a year" from the average of
   * the last three full months before the selected one (or the selected one
   * if it is complete).
   */
  function paceNotes(m, totalFor) {
    // "Today" is when the data was built; a month is in progress if it is today's month.
    const today = (data.generatedAt ?? new Date().toISOString()).slice(0, 10);
    const current = today.slice(0, 7);
    const notes = [];
    if (m === current) {
      const elapsed = +today.slice(8, 10);
      const [yy, mm] = m.split("-").map(Number);
      const days = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      // Early in a month one big bill (rent, a mortgage) dominates; wait until the 10th.
      if (elapsed >= 10 && elapsed < days) notes.push(el("div", { class: "note" }, `On pace for ${usd((totalFor(m) / elapsed) * days)} this month`));
    }
    const i = months.indexOf(m);
    // History that begins mid-month makes that first month look small: leave it out.
    const firstPartial = data.earliestDate && +data.earliestDate.slice(8, 10) > 3 ? data.earliestDate.slice(0, 7) : null;
    const full = months.slice(0, i + 1).filter((mm) => mm !== current && mm !== firstPartial).slice(-3);
    if (full.length) {
      const avg = full.reduce((s2, mm) => s2 + totalFor(mm), 0) / full.length;
      notes.push(el("div", { class: "note" }, `About ${usd(avg * 12, { compact: true })} a year at the ${full.length === 1 ? mShort(full[0]) : `${full.length}-month average`} rate`));
    }
    return notes;
  }

  // ---------- stacked bars ----------
  function stackedChart() {
    const W = 360, H = 230, padL = 34, padR = 6, padT = 22, padB = 22;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const maxVal = Math.max(totalBudget, ...months.map(monthTotal), 1);
    const step = niceStep(maxVal);
    let top = Math.ceil(maxVal / step) * step;
    if (top - maxVal < step * 0.25) top += step; // room for the total labels
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
    const sp = splitOf(m);
    const al = data.allocated[m] ?? { me: 0, her: 0 };
    const t1 = splitTotal(sp);
    const forParts = splitParts(sp);
    const legend = el("div", { class: "legend" }, forParts.map((p) => el("span", {}, [el("i", { style: `background:${p.color}` }), `${p.label} `, el("b", { class: "num" }, usd(p.value))])));
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Who it was for"), el("div", { class: "sub" }, mShort(m))]),
      el("div", { class: "bar-row" }, [
        el("div", { class: "bar-title" }, [el("span", {}, "Allocated"), el("b", { class: "num" }, `${ME} ${usd(al.me)} \u00b7 ${HER} ${usd(al.her)}`)]),
        hBar(forParts, t1, "Allocation this month"),
        legend,
      ]),
      el("div", { class: "sub" }, sp.undecided ? `Undecided purchases are counted half each until someone picks a split. ${usd(sp.undecided)} is waiting this month.` : "Shared purchases are split evenly; the totals on the right count half of them to each person."),
    ]);
  }

  // ---------- allocation by month ----------
  function allocationChart() {
    const W = 360, H = 190, padL = 34, padR = 6, padT = 22, padB = 22;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const totals = months.map((m) => splitTotal(splitOf(m)));
    const step = niceStep(Math.max(1, ...totals));
    let top = Math.ceil(Math.max(1, ...totals) / step) * step;
    if (top - Math.max(...totals) < step * 0.25) top += step;
    const y = (v) => padT + innerH - (v / top) * innerH;
    const slot = innerW / months.length;
    const barW = Math.min(44, slot * 0.62);
    const s = svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Allocation by month" });
    for (let v = 0; v <= top; v += step) {
      s.append(svg("line", { class: v === 0 ? "baseline" : "grid", x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
      s.append(svg("text", { x: padL - 6, y: y(v) + 4, "text-anchor": "end" }, usd(v, { compact: true })));
    }
    months.forEach((m, i) => {
      const p = splitOf(m);
      const cx = padL + slot * i + slot / 2, x = cx - barW / 2;
      const g = svg("g", { class: `col ${m === state.month ? "" : "dim"}`, onclick: () => { state.month = m; draw(); } });
      const clipId = `aclip-${m}`;
      g.append(svg("defs", {}, svg("clipPath", { id: clipId }, svg("rect", { x, y: y(totals[i]), width: barW, height: Math.max(0, innerH - (y(totals[i]) - padT)), rx: 4 }))));
      const inner = svg("g", { "clip-path": `url(#${clipId})` });
      let acc = 0;
      for (const { label, value: v, color } of splitParts(p)) {
        if (v <= 0) continue;
        const r = svg("rect", { class: "seg", x, y: y(acc + v), width: barW, height: y(acc) - y(acc + v), style: `fill:${color}` });
        r.append(svg("title", {}, `${label}: ${usd(v)} (${mLong(m)})`));
        inner.append(r);
        acc += v;
      }
      g.append(inner);
      g.append(svg("rect", { x: padL + slot * i, y: padT - 16, width: slot, height: innerH + 16, fill: "transparent" }));
      g.append(svg("text", { class: `total ${m === state.month ? "sel" : ""}`, x: cx, y: y(totals[i]) - 6, "text-anchor": "middle" }, totals[i] ? `${Math.round((p.shared / totals[i]) * 100)}%` : ""));
      g.append(svg("text", { class: `month ${m === state.month ? "sel" : ""}`, x: cx, y: H - 6, "text-anchor": "middle" }, mShort(m)));
      s.append(g);
    });
    return el("section", {}, [
      el("div", { class: "sec-head" }, [el("h2", {}, "Shared vs personal, by month"), el("div", { class: "sub" }, "% = shared")]),
      s,
      el("div", { class: "legend" }, splitParts(EMPTY).map((p) => el("span", {}, [el("i", { style: `background:${p.color}` }), p.label]))),
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
      const label = data.categoryHref
        ? el("a", { href: `${data.categoryHref}?category=${encodeURIComponent(c.name)}&month=${m}` }, c.name)
        : c.name;
      const name = el("div", { class: "name" }, [el("i", { style: `background:${catColor(c)}` }), label]);
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
      el("div", { class: "sec-head" }, [el("h2", {}, "Needs a look"), data.reviewHref ? el("a", { class: "pill warn", href: data.reviewHref }, `Review ${r.count} \u2192`) : el("span", { class: "pill warn" }, `${r.count} undecided`)]),
      el("div", { class: "sub" }, "Purchases nobody has decided on yet, counted half each meanwhile. Biggest merchants first."),
      list,
    ]);
  }

  function foot() {
    const src = Object.entries(data.counts.bySource).map(([k, v]) => `${v} by ${k}`).join(", ");
    return el("footer", { class: "foot" }, [
      el("div", {}, data.note ?? ""),
      el("div", {}, `${data.counts.transactions} transactions through ${data.latestDate ?? "—"} · ${src}.`),
      data.banksHref ? el("div", {}, el("a", { href: data.banksHref }, "Banks and sync")) : null,
    ]);
  }

  function draw() {
    root.innerHTML = "";
    root.className = "dash";
    if (!months.length) {
      root.append(el("div", { class: "empty" }, data.banksHref
        ? ["No transactions yet. ", el("a", { href: data.banksHref }, "Link a bank"), " to get started."]
        : "No transactions yet. Import a CSV or sync Plaid, then run classify."));
      return;
    }
    // Sections return null when they have nothing to show; append() would print "null".
    root.append(...[header(), tiles(), stackedChart(), splitSection(), allocationChart(), table(), review(), foot()].filter(Boolean));
  }
  draw();
}
