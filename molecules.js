/* ============================================================
   Molecules + page lines.

   One input drives everything: the scroll position. Each molecule's route is planned once
   (in document coordinates, around the real text boxes), then every frame is a pure function
   of scrollY. Nothing accumulates, so scrolling back reproduces earlier frames exactly.

   Routes, sizes and padding live in flow.js. The page's hairlines are drawn here, on the same
   canvas, so holes can be cut exactly where a strand or molecule passes through them.
   ============================================================ */
(function () {
  "use strict";
  const S = window.SITE, F = window.FLOW;
  const cv = document.getElementById("field");
  const ctx = cv && cv.getContext && cv.getContext("2d");
  if (!S || !F || !ctx) return;

  const root = document.documentElement;
  if (innerWidth >= 1024 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    try { history.scrollRestoration = "manual"; } catch (e) { /* ignore */ }
    scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const sm = (p) => { p = clamp(p); return p * p * (3 - 2 * p); };
  const TAU = Math.PI * 2;
  const LABELS = S.clusters || [];
  const K = Math.min(LABELS.length, F.routes.length);
  const NP = 16;
  const INK = "23,23,23";

  /* ---------- the molecules: fixed shapes, seeded ---------- */
  let seed = 11;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mols = [];
  for (let k = 0; k < K; k++) {
    const pts = [];
    let minD = 0.66, guard = 0;
    while (pts.length < NP) {
      const p = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
      if (p[0] * p[0] + p[1] * p[1] + p[2] * p[2] > 1) continue;
      if (pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) >= minD)) pts.push(p);
      else if (++guard % 400 === 0) minD *= 0.93;
    }
    // walk the points nearest-neighbour first: that order is the string, so it unravels as one clean line
    const rest = pts.slice().sort((a, b) => a[0] - b[0]), order = [rest.shift()];
    while (rest.length) {
      const l = order[order.length - 1];
      let bi = 0, bd = 1e9;
      rest.forEach((p, i) => { const d = Math.hypot(p[0] - l[0], p[1] - l[1], p[2] - l[2]); if (d < bd) { bd = d; bi = i; } });
      order.push(rest.splice(bi, 1)[0]);
    }
    const nodes = order.map((g, i) => ({ g, rank: i / (NP - 1), ph: (i / (NP - 1)) * TAU * 2.2 + k }));
    // bonds inside the coil: each node to its two nearest, besides its neighbours along the string
    const seen = new Set(), prox = [];
    nodes.forEach((n, i) => {
      nodes.map((m, j) => ({ j, d: Math.hypot(n.g[0] - m.g[0], n.g[1] - m.g[1], n.g[2] - m.g[2]) }))
        .filter((o) => Math.abs(o.j - i) > 1).sort((a, b) => a.d - b.d).slice(0, 2)
        .forEach((o) => { const key = Math.min(i, o.j) * 99 + Math.max(i, o.j); if (!seen.has(key)) { seen.add(key); prox.push([Math.min(i, o.j), Math.max(i, o.j)]); } });
    });
    mols.push({ nodes, prox, yaw: k * 1.7 });
  }

  /* ---------- geometry helpers ---------- */
  const inside = (r, x, y) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;
  const inflate = (r, c) => ({ x0: r.x0 - c, y0: r.y0 - c, x1: r.x1 + c, y1: r.y1 + c });
  function blocked(ax, ay, bx, by, rs) {
    const dx = bx - ax, dy = by - ay;
    for (let n = 0; n < rs.length; n++) {
      const r = rs[n];
      if (Math.max(ax, bx) <= r.x0 || Math.min(ax, bx) >= r.x1 || Math.max(ay, by) <= r.y0 || Math.min(ay, by) >= r.y1) continue;
      let t0 = 0, t1 = 1, ok = true;
      const p = [-dx, dx, -dy, dy], q = [ax - r.x0, r.x1 - ax, ay - r.y0, r.y1 - ay];
      for (let i = 0; i < 4 && ok; i++) {
        if (p[i] === 0) { if (q[i] <= 0) ok = false; }
        else {
          const t = q[i] / p[i];
          if (p[i] < 0) { if (t > t1) ok = false; else if (t > t0) t0 = t; }
          else { if (t < t0) ok = false; else if (t < t1) t1 = t; }
        }
      }
      if (ok && t1 - t0 > 1e-6) return true;
    }
    return false;
  }

  /* ---------- state ---------- */
  let W = 0, H = 0, dpr = 1, wide = false, built = false;
  let M = null, rects = [], prects = [], lines = [], items = [], routes = [], statics = [];
  let t0 = 0;

  /* ---------- measure the page (document coordinates) ---------- */
  function measure() {
    const sy = scrollY, sx = scrollX;
    const top = (el) => el.getBoundingClientRect().top + sy;
    const main = $("main"), mcs = getComputedStyle(main);
    const pl = parseFloat(mcs.paddingLeft) || 0, pr = parseFloat(mcs.paddingRight) || 0;
    const cl = main.getBoundingClientRect().left + sx + pl;
    const cw = main.clientWidth - pl - pr;
    const docH = Math.max(root.scrollHeight, document.body.scrollHeight);

    const marks = [["top", 0], ["intro", top(document.querySelector(".intro"))], ["stats", top($("highlights"))]];
    const nextItems = [];
    [...document.querySelectorAll("main section")].forEach((s, i) => {
      marks.push(["s" + i, top(s)]);
      const sec = S.sections[i], list = (sec && S[sec.key]) || [];
      [...s.querySelectorAll(".item")].forEach((it, j) => {
        const r = it.getBoundingClientRect();
        if (j > 0) marks.push(["s" + i + "i" + j, r.top + sy]);
        nextItems.push({ top: r.top + sy, bottom: r.bottom + sy, focus: (list[j] && list[j].focus) || (sec && sec.focus) || [] });
      });
    });
    const footTop = top(document.querySelector(".foot"));
    marks.push(["foot", footTop], ["end", docH]);
    marks.sort((a, b) => a[1] - b[1]);
    const idx = {};
    marks.forEach((m, i) => { idx[m[0]] = i; });
    const yOf = (name, f) => {
      let i = idx[name];
      if (i == null) { const m = /^s(\d+)i\d+$/.exec(name); i = m ? idx["s" + m[1]] : 0; }
      if (i == null) i = 0;
      const a = marks[i][1], b = (marks[i + 1] || marks[i])[1];
      return a + f * (b - a);
    };

    // every block of text is an obstacle: the union of its line boxes
    const TEXT = ".fig,.tagline,.meter,.bio,.links,.highlights > div,.sec-num,h2,.date,h3,.body p,.tags,.empty,.foot > *";
    const rg = document.createRange(), rs = [];
    document.querySelectorAll(TEXT).forEach((el) => {
      rg.selectNodeContents(el);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const r of rg.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (x1 > x0 && y1 > y0) rs.push({ x0: x0 + sx, y0: y0 + sy, x1: x1 + sx, y1: y1 + sy });
    });

    // page hairlines (the CSS borders are hidden once the canvas takes over)
    const ls = [];
    document.querySelectorAll(".intro,#highlights,main section,.item,.foot").forEach((el) => {
      if (el.classList.contains("item") && !el.previousElementSibling) return;
      const r = el.getBoundingClientRect();
      ls.push({ y: r.top + sy, x0: r.left + sx, x1: r.right + sx });
    });

    // where the molecules rest at the bottom: the empty band between the last text and the footer rule
    let gapTop = 0;
    rs.forEach((r) => { if (r.y1 < footTop) gapTop = Math.max(gapTop, r.y1); });
    const dockY = (gapTop + footTop) / 2 - 4;
    return { cl, cw, docH, yOf, dockY, rects: rs, lines: ls, items: nextItems, footTop, marks };
  }

  /* ---------- plan a route around the text ---------- */
  function makePlanner(rs, c) {
    const inf = rs.map((r) => inflate(r, c));
    const eps = 1.5, cn = [];
    inf.forEach((r) => {
      [[r.x0 - eps, r.y0 - eps], [r.x1 + eps, r.y0 - eps], [r.x1 + eps, r.y1 + eps], [r.x0 - eps, r.y1 + eps]].forEach((p) => {
        if (!inf.some((q) => inside(q, p[0], p[1]))) cn.push(p);
      });
    });
    const n = cn.length, memo = new Uint8Array(n * n);
    const cc = (i, j) => {
      const key = i * n + j;
      if (!memo[key]) {
        memo[key] = blocked(cn[i][0], cn[i][1], cn[j][0], cn[j][1], inf) ? 2 : 1;
        memo[j * n + i] = memo[key];
      }
      return memo[key] === 1;
    };
    function pushOut(p) {
      let x = p.x, y = p.y;
      for (let it = 0; it < 12; it++) {
        const r = inf.find((q) => inside(q, x, y));
        if (!r) break;
        const d = [x - r.x0, r.x1 - x, y - r.y0, r.y1 - y], m = Math.min(...d);
        if (m === d[0]) x = r.x0 - eps; else if (m === d[1]) x = r.x1 + eps; else if (m === d[2]) y = r.y0 - eps; else y = r.y1 + eps;
      }
      return { x, y };
    }
    function detour(a, b) {
      if (!blocked(a.x, a.y, b.x, b.y, inf)) return [a, b];
      const nodes = cn.concat([[a.x, a.y], [b.x, b.y]]), A = n, B = n + 1;
      const vis = (i, j) => (i < n && j < n ? cc(i, j) : !blocked(nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1], inf));
      const dist = new Float64Array(n + 2).fill(Infinity), prev = new Int32Array(n + 2).fill(-1), done = new Uint8Array(n + 2);
      dist[A] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < n + 2; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0 || u === B) break;
        done[u] = 1;
        for (let v = 0; v < n + 2; v++) {
          if (done[v] || v === u) continue;
          const d = dist[u] + Math.hypot(nodes[u][0] - nodes[v][0], nodes[u][1] - nodes[v][1]);
          if (d < dist[v] && vis(u, v)) { dist[v] = d; prev[v] = u; }
        }
      }
      if (!isFinite(dist[B])) return [a, b];
      const path = [];
      for (let v = B; v >= 0; v = prev[v]) path.push({ x: nodes[v][0], y: nodes[v][1] });
      return path.reverse();
    }
    return { pushOut, detour };
  }

  function minDist(x, y, rs, lim) {
    let m = lim;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      const dx = Math.max(r.x0 - x, 0, x - r.x1);
      if (dx >= m) continue;
      const dy = Math.max(r.y0 - y, 0, y - r.y1);
      if (dy >= m) continue;
      const d = Math.hypot(dx, dy);
      if (d < m) m = d;
    }
    return m;
  }

  function planRoute(k, planner) {
    const rt = F.routes[k], step = 4;
    let pts = rt.waypoints.map(([u, lm, f]) => ({ x: M.cl + u * M.cw, y: M.yOf(lm, f) }));
    pts.push({ x: M.cl + rt.endU * M.cw, y: M.dockY });
    pts = pts.map(planner.pushOut);
    const poly = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const seg = planner.detour(pts[i - 1], pts[i]);
      for (let j = 1; j < seg.length; j++) poly.push(seg[j]);
    }
    // resample finely, then relax: round every turn while keeping clear of text
    const dense = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(len / 6));
      for (let j = 0; j < n; j++) dense.push({ x: lerp(a.x, b.x, j / n), y: lerp(a.y, b.y, j / n) });
    }
    dense.push(poly[poly.length - 1]);
    const xs = Float64Array.from(dense, (p) => p.x), ys = Float64Array.from(dense, (p) => p.y), m = xs.length;
    const keep = F.clearance * 0.78, dcur = new Float64Array(m);
    for (let i = 0; i < m; i++) dcur[i] = minDist(xs[i], ys[i], prects, keep);
    for (let it = 0; it < 170; it++) {
      for (let i = 1; i < m - 1; i++) {
        const nx = xs[i] + 0.5 * ((xs[i - 1] + xs[i + 1]) / 2 - xs[i]);
        const ny = ys[i] + 0.5 * ((ys[i - 1] + ys[i + 1]) / 2 - ys[i]);
        const d = minDist(nx, ny, prects, keep);
        if (d >= dcur[i]) { xs[i] = nx; ys[i] = ny; dcur[i] = d; }
      }
    }
    // uniform arclength samples
    const cum = new Float64Array(m);
    for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const len = cum[m - 1], n = Math.max(2, Math.floor(len / step) + 1);
    const X = new Float32Array(n), Y = new Float32Array(n), TX = new Float32Array(n), TY = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++) {
      const s = Math.min(i * step, len);
      while (j < m - 2 && cum[j + 1] < s) j++;
      const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      X[i] = lerp(xs[j], xs[j + 1], f); Y[i] = lerp(ys[j], ys[j + 1], f);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3), dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.hypot(dx, dy) || 1;
      TX[i] = dx / d; TY[i] = dy / d;
    }
    const yEnv = new Float32Array(n);
    let mx = -1e9;
    for (let i = 0; i < n; i++) { mx = Math.max(mx, Y[i]); yEnv[i] = mx; }
    return { X, Y, TX, TY, yEnv, n, step, len: (n - 1) * step, table: null };
  }

  // where along the route the centre of the molecule is for every scroll position, with a speed limit
  function buildTable(k, rt) {
    const Smax = Math.max(0, Math.floor(M.docH - H)), vh = H;
    const tbl = new Float32Array(Smax + 2);
    const vEff = Smax > 0 ? Math.max(F.maxSpeed, (1.1 * rt.len) / Smax) : F.maxSpeed;
    const rowDock = clamp((M.dockY - Smax) / vh, 0.05, 0.95);
    const row0 = rt.Y[0] / vh, row1 = F.rows[k];
    const span = Math.max(1, F.dockSpan * vh);
    const target = (T) => {
      let lo = 0, hi = rt.n - 1;
      if (T >= rt.yEnv[hi]) return rt.len;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (rt.yEnv[mid] >= T) hi = mid; else lo = mid + 1; }
      if (lo === 0) return 0;
      const d = rt.yEnv[lo] - rt.yEnv[lo - 1];
      return (lo - 1 + (d > 0 ? (T - rt.yEnv[lo - 1]) / d : 1)) * rt.step;
    };
    let prev = 0;
    for (let s = 0; s <= Smax + 1; s++) {
      let r = lerp(row0, row1, sm(s / Math.max(1, F.settle * vh)));
      r = lerp(r, rowDock, sm((s - (Smax - span)) / span));
      let v = Math.min(target(s + r * vh), prev + vEff);
      v = Math.max(v, prev);
      v = clamp(v, Math.max(0, rt.len - vEff * (Smax - s)), vEff * s);
      tbl[s] = prev = v;
    }
    tbl[Smax + 1] = tbl[Smax];
    rt.table = tbl; rt.Smax = Smax;
  }

  const at = (rt, s, out) => {
    const f = clamp(s / rt.step, 0, rt.n - 1), i = Math.min(rt.n - 2, Math.floor(f)), p = f - i;
    out.x = lerp(rt.X[i], rt.X[i + 1], p); out.y = lerp(rt.Y[i], rt.Y[i + 1], p);
    out.tx = lerp(rt.TX[i], rt.TX[i + 1], p); out.ty = lerp(rt.TY[i], rt.TY[i + 1], p);
    return out;
  };
  const lookup = (rt, sy) => {
    const f = clamp(sy, 0, rt.Smax), i = Math.min(rt.Smax, Math.floor(f));
    return lerp(rt.table[i], rt.table[i + 1], f - i);
  };

  /* ---------- build / rebuild ---------- */
  function sizeCanvas() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  const cssVar = (n, d) => (getComputedStyle(root).getPropertyValue(n) || d).trim();
  let sansCache = "";
  const SANS = () => sansCache || (sansCache = cssVar("--sans", "system-ui, sans-serif")); // read once: no style reads while drawing
  const MONO = cssVar("--mono", "ui-monospace, Menlo, monospace");
  const hash = (a, b, c) => {
    let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  };

  // the opening: layout and timeline (wide screens, motion allowed)
  let intro = null;
  let iState = 0;     // 0 waiting for fonts · 1 playing · 2 skipped (molecules fading in) · 3 finished
  let waitT0 = 0, introT0 = 0, skipAt = 0, fontsOk = false;

  // a string that flies in from a side of the window and ends on the molecule's first position
  function makeEntry(k, rt) {
    const cfg = (F.intro && F.intro.enter && F.intro.enter[k]) || { side: -1 };
    const side = cfg.side || -1, cx = rt.X[0], cy = rt.Y[0], yE = cfg.y == null ? cy : cfg.y * H;
    const dir = -side, margin = F.stringLength / 2 + 70;
    let pts = [[side < 0 ? -margin : W + margin, yE], [cx - dir * 260, yE], [cx - dir * 110, lerp(yE, cy, 0.72)], [cx, cy]];
    for (let it = 0; it < 3; it++) { // Chaikin corner cutting, ends fixed: a smooth curve through the same corridor
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push([lerp(a[0], b[0], 0.25), lerp(a[1], b[1], 0.25)], [lerp(a[0], b[0], 0.75), lerp(a[1], b[1], 0.75)]);
      }
      out.push(pts[pts.length - 1]); pts = out;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const len0 = cum[cum.length - 1], n = Math.max(2, Math.ceil(len0 / 4) + 1), step = len0 / (n - 1); // equal steps that end exactly on the target
    const X = new Float32Array(n), Y = new Float32Array(n), TX = new Float32Array(n), TY = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++) {
      const s = i * step;
      while (j < pts.length - 2 && cum[j + 1] < s) j++;
      const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      X[i] = lerp(pts[j][0], pts[j + 1][0], f); Y[i] = lerp(pts[j][1], pts[j + 1][1], f);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3), dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.hypot(dx, dy) || 1;
      TX[i] = dx / d; TY[i] = dy / d;
    }
    return { X, Y, TX, TY, n, step, len: (n - 1) * step };
  }

  function buildIntro() {
    intro = null;
    if (!wide || reduce || !F.intro) return;
    const C = F.intro, toks = C.sentence.map((t) => Object.assign({}, t, { text: t.k != null ? LABELS[t.k].toLowerCase() : t.t }));
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.font = "400 100px " + SANS();
    const sp100 = ctx.measureText(" ").width;
    let w100 = 0;
    toks.forEach((t, i) => { w100 += ctx.measureText(t.text).width + (i && !t.p ? sp100 : 0); });
    const tag = document.querySelector(".tagline"), tagTop = tag ? tag.getBoundingClientRect().top + scrollY : H;
    const x0 = tag ? tag.getBoundingClientRect().left + scrollX : M.cl, fs = clamp(Math.floor((100 * (W - x0 - 250)) / w100), 16, 32);
    ctx.font = "400 " + fs + "px " + SANS();
    const sp = ctx.measureText(" ").width;
    let x = x0;
    toks.forEach((t, i) => { if (i && !t.p) x += sp; t.x = x; t.w = ctx.measureText(t.text).width; x += t.w; });

    const nRows = clamp(Math.floor((tagTop - 24 - 186) / 17), 4, 8);
    const base = Math.max(150, Math.min(0.34 * H + fs / 3, tagTop - 46 - nRows * 17 - 24));

    let tt = C.start;
    toks.forEach((t, i) => {
      t.auto = i === 0 || !!t.p;
      t.d = i === 0 ? C.first : t.p ? C.punct : t.k != null ? C.interest : C.step;
      t.t0 = tt; tt += t.d;
    });
    const sep0 = tt + C.hold, enter0 = sep0 + C.enterDelay;
    let s = 99; const rng = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    toks.forEach((t) => {
      if (t.auto) return;
      const rows = t.c.map((c, i) => ({ s: c[0] || t.text, p: c[1], win: i === 0 }));
      while (rows.length < nRows) rows.push({ s: C.noise[Math.floor(rng() * C.noise.length)], p: 0.008 + rng() * 0.03, win: false });
      rows.map((_, i) => [rng(), i]).sort((a, b) => a[0] - b[0]).forEach((o, pos) => { rows[o[1]].o0 = pos; });
      rows.slice().sort((a, b) => b.p - a.p).forEach((r, rank) => { r.o1 = rank; });
      t.rows = rows;
    });
    const arrive = [], dest = [];
    toks.filter((t) => t.k != null).forEach((t, i) => {
      t.sepAt = sep0 + C.separateStagger * i;
      arrive[t.k] = t.sepAt + C.separate;
      const rt = routes[t.k], Rs = Math.min(W, H) * F.startRadius;
      dest[t.k] = { x: rt.X[0], y: rt.Y[0] + Rs * 1.19 + 4 + 18 };
    });
    intro = { C, toks, fs, x0, base, nRows, sep0, enter0, end: enter0 + C.enterStagger * (K - 1) + C.enterDur + 0.05, arrive, dest };
  }

  function build() {
    sizeCanvas();
    wide = W >= 1024;
    M = measure();
    rects = M.rects; lines = M.lines; items = M.items;
    routes = []; statics = [];
    if (wide) {
      // routes keep extra room under every text block, so a title under a clump never lands on text
      const room = F.titleRoom == null ? 24 : F.titleRoom;
      const roomX = F.titleRoomX == null ? 12 : F.titleRoomX;
      prects = rects.map((r) => ({ x0: r.x0 - roomX, x1: r.x1 + roomX, y0: r.y0 - room, y1: r.y1 }));
      const planner = makePlanner(prects, F.clearance);
      for (let k = 0; k < K; k++) { const rt = planRoute(k, planner); buildTable(k, rt); rt.entry = makeEntry(k, rt); routes.push(rt); }
    } else {
      // narrow screens have no free margins: the molecules gather at the top and rest above the footer
      for (let k = 0; k < K; k++) {
        statics.push({
          sx: W * (0.17 + 0.22 * k), sy: H * 0.24 + (k % 2) * 0.1 * H, sr: Math.min(W * 0.075, H * 0.1),
          ex: W * (0.17 + 0.22 * k), ey: M.dockY, er: F.blobRadius * 0.8,
        });
      }
    }
    buildIntro();
    built = true;
    draw(performance.now());
    root.classList.toggle("cl", wide);
  }

  /* ---------- per-frame geometry ---------- */
  const G = Array.from({ length: K }, () => ({ x: new Float64Array(NP), y: new Float64Array(NP), r: new Float64Array(NP), a: new Float64Array(NP), c: new Float64Array(NP), z: new Float64Array(NP), cx: 0, cy: 0, Rb: 30, ta: 0, tit: [] }));
  const tmp = { x: 0, y: 0, tx: 0, ty: 0 }, tmp2 = { x: 0, y: 0, tx: 0, ty: 0 };
  const introOf = (t, k) => (reduce ? 1 : sm((t - 0.3 - 0.6 * k) / 1.3)); // narrow screens only

  function ball(g, yaw, R, out) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), x1 = g[0] * cy + g[2] * sy, z1 = -g[0] * sy + g[2] * cy;
    const tilt = 0.38, y1 = g[1] * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = g[1] * Math.sin(tilt) + z1 * Math.cos(tilt);
    const pz = 1 / (1 - 0.16 * z2);
    out.x = x1 * R * pz; out.y = y1 * R * pz; out.z = z2; out.p = pz;
  }
  const bo = { x: 0, y: 0, z: 0, p: 1 };

  // one molecule: nodes along `path` around centre arclength `sc`, from a coil (coil = 1) to a string (coil = 0)
  function layNodes(k, path, sc, coil, R, yaw, helixAngle, alpha) {
    const m = mols[k], g = G[k], u = 1 - coil;
    for (let i = 0; i < NP; i++) {
      const n = m.nodes[i];
      const w = sm(u * (1 + F.peel) - F.peel * (1 - n.rank));
      const si = clamp(sc + (n.rank - 0.5) * F.stringLength * w, 0, path.len);
      const P = at(path, si, tmp2);
      ball(n.g, yaw, R, bo);
      const al = n.ph + helixAngle, hc = Math.cos(al), hz = Math.sin(al), hp = 1 / (1 - 0.16 * hz);
      const hx = -P.ty * F.helix * hc * hp, hy = P.tx * F.helix * hc * hp;
      g.x[i] = P.x + lerp(bo.x, hx, w); g.y[i] = P.y + lerp(bo.y, hy, w);
      g.z[i] = lerp(bo.z, hz, w);
      g.r[i] = F.nodeRadius * lerp(bo.p, hp, w);
      g.c[i] = 1 - w;
      g.a[i] = alpha;
    }
  }

  function hideMolecule(k) { const g = G[k]; g.a.fill(0); g.ta = 0; g.tit.length = 0; }

  function placeRouted(k, S, fade) {
    const rt = routes[k], m = mols[k], g = G[k];
    const sc = lookup(rt, S), yc = at(rt, sc, tmp).y;
    const start = 1 - sm(sc / F.startBlend), endC = sm((sc - (rt.len - F.endBlend)) / F.endBlend);
    let item = 0;
    const rampPx = clamp(0.3 * H, F.ramp[0], F.ramp[1]);
    for (const it of items) {
      if (!it.focus.includes(k)) continue;
      item = Math.max(item, sm((yc - (it.top - rampPx)) / rampPx) * sm((it.bottom + rampPx - yc) / rampPx));
    }
    const coil = Math.max(start, endC, item), spin = reduce ? 0 : 1;
    const R = lerp(F.blobRadius, Math.min(W, H) * F.startRadius, start * start);
    layNodes(k, rt, sc, coil, R, m.yaw + S * F.spin * spin, S * F.spin * 2.5 * spin, fade);
    // the title returns whenever the molecule is clumped, wherever that happens on the page
    const centre = at(rt, sc, tmp);
    g.cx = centre.x; g.cy = centre.y;
    g.Rb = R * 1.19 + 4;
    g.ta = sm((coil - 0.7) / 0.3) * fade;
  }

  // the opening: the string streams in from its side, then clumps where the molecule starts
  function placeEntry(k, t) {
    const rt = routes[k], en = rt.entry, g = G[k], C = intro.C, Rs = Math.min(W, H) * F.startRadius;
    const tau = clamp((t - (intro.enter0 + C.enterStagger * k)) / C.enterDur);
    g.cx = rt.X[0]; g.cy = rt.Y[0]; g.Rb = Rs * 1.19 + 4;
    g.ta = intro.arrive[k] != null && t >= intro.arrive[k] ? 1 : 0;
    if (tau <= 0) { g.a.fill(0); return; }
    const e = 1 - Math.pow(1 - tau, 3);
    layNodes(k, en, e * en.len, sm((tau - 0.42) / 0.58), Rs * (0.55 + 0.45 * sm(tau)), mols[k].yaw + (1 - sm(tau)) * 1.4, tau * 9, 1);
  }

  function placeStatic(k, S, t) {
    const st = statics[k], m = mols[k], g = G[k], ik = introOf(t, k);
    const Smax = Math.max(0, M.docH - H), atEnd = S > Smax - 1.2 * H;
    const cx = atEnd ? st.ex : st.sx, cy = atEnd ? st.ey : st.sy, R0 = (atEnd ? st.er : st.sr) * (0.6 + 0.4 * ik);
    const vis = atEnd ? sm((S - (Smax - 1.2 * H)) / (0.5 * H)) : 1 - sm(S / (0.5 * H));
    const yaw = m.yaw + S * F.spin * (reduce ? 0 : 1);
    for (let i = 0; i < NP; i++) {
      ball(m.nodes[i].g, yaw, R0, bo);
      g.x[i] = cx + bo.x; g.y[i] = cy + bo.y; g.z[i] = bo.z; g.r[i] = F.nodeRadius * bo.p; g.c[i] = 1;
      g.a[i] = (reduce ? 1 : sm(ik * 1.6 - m.nodes[i].rank * 0.6)) * vis;
    }
    g.cx = cx; g.cy = cy; g.Rb = R0 * 1.19 + 4;
    g.ta = atEnd ? 0 : (reduce ? 1 : sm((t - 0.3 - 0.6 * k - 0.8) / 0.7)) * vis;
  }

  /* ---------- draw ---------- */
  const intervals = [], discs = [], caps = [], boxes = [];

  function capInterval(c, ly, out) {
    // horizontal line y = ly through the capsule (segment a-b, radius r): one interval, since the capsule is convex
    const { ax, ay, bx, by, r } = c;
    let lo = Infinity, hi = -Infinity;
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      const dy = ly - py;
      if (Math.abs(dy) < r) { const h = Math.sqrt(r * r - dy * dy); lo = Math.min(lo, px - h); hi = Math.max(hi, px + h); }
    }
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      const ux = dx / len, uy = dy / len;
      // constraints on x:  0 <= (x-ax)ux + (ly-ay)uy <= len   and   |(x-ax)(-uy) + (ly-ay)ux| <= r
      let xl = -Infinity, xh = Infinity, ok = true;
      const slab = (coef, c0, a, b) => {
        // c0 + coef * (x - ax) in [a, b]
        if (Math.abs(coef) < 1e-9) { if (c0 < a || c0 > b) ok = false; return; }
        const x1 = ax + (a - c0) / coef, x2 = ax + (b - c0) / coef;
        xl = Math.max(xl, Math.min(x1, x2)); xh = Math.min(xh, Math.max(x1, x2));
      };
      slab(ux, (ly - ay) * uy, 0, len);
      slab(-uy, (ly - ay) * ux, -r, r);
      if (ok && xl <= xh) { lo = Math.min(lo, xl); hi = Math.max(hi, xh); }
    }
    if (hi < lo) return false;
    out.push(lo, hi);
    return true;
  }

  /* titles: always directly under the clump, shown whenever the molecule is clumped.
     A title only fades if text, another clump or another title is in its way. */
  const TITLE_FONT = '500 10.5px ' + MONO;
  const gapBox = (a, b) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1));
  function placeTitles(sy) {
    ctx.font = TITLE_FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
    for (let k = 0; k < K; k++) {
      const g = G[k];
      g.tit.length = 0;
      if (g.ta < 0.01 || g.cy - sy < -80 || g.cy - sy > H + 80) continue;
      const w = ctx.measureText(LABELS[k].toUpperCase()).width, y0 = g.cy + g.Rb + 8;
      const box = { x0: g.cx - w / 2, x1: g.cx + w / 2, y0, y1: y0 + 13, al: "center", x: g.cx, y: y0 + 10, a: 0 };
      let d = 40;
      if (wide) {
        for (const r of rects) { const e = gapBox(box, r); if (e < d) d = e; }
        for (let j = 0; j < K; j++) {
          if (j === k) continue;
          const o = G[j];
          for (let i = 0; i < NP; i++) {
            if (o.a[i] < 0.05 || o.c[i] < 0.6) continue; // only another clump blocks a title; a thin string passing over does not
            const e = Math.hypot(Math.max(box.x0 - o.x[i], 0, o.x[i] - box.x1), Math.max(box.y0 - o.y[i], 0, o.y[i] - box.y1)) - o.r[i];
            if (e < d) d = e;
          }
          for (const t of G[j].tit) { if (j < k) { const e = gapBox(box, t); if (e < d) d = e; } }
        }
      }
      box.a = g.ta * (wide ? sm((d - 3) / 9) : 1);
      if (box.a > 0.01) g.tit.push(box);
    }
  }

  /* the opening line: next-token prediction, drawn on the canvas */
  function drawIntro(t) {
    const I = intro, C = I.C, fs = I.fs, base = I.base, x0 = I.x0, sans = SANS();
    const A = sm(t / C.fadeIn), rest = 1 - sm((t - I.sep0) / C.fadeOut), bA = A * rest;
    if (A < 0.002) return;
    ctx.textBaseline = "alphabetic";
    const ink = (a) => "rgba(23,23,23," + a.toFixed(3) + ")", gray = (a) => "rgba(110,110,110," + a.toFixed(3) + ")";
    const ca = (tk) => (tk.auto ? sm((t - tk.t0) / Math.min(0.12, tk.d * 1.2)) : sm(((t - tk.t0) / tk.d - 0.78) / 0.16));
    let cur = null, step = 0, endX = x0;
    I.toks.forEach((tk, i) => {
      if (t >= tk.t0) step = i;
      if (!tk.auto && t >= tk.t0 && t < tk.t0 + tk.d) cur = tk;
      const c = ca(tk);
      if (c > 0.001) endX = Math.max(endX, tk.x + tk.w * c);
    });

    // the sentence so far
    ctx.textAlign = "left"; ctx.font = "400 " + fs + "px " + sans;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    for (const tk of I.toks) {
      const c = ca(tk);
      if (c < 0.002 || (tk.k != null && t >= tk.sepAt)) continue;
      ctx.fillStyle = ink(A * c * (tk.k != null ? 1 : rest));
      ctx.fillText(tk.text, tk.x, base);
    }
    // ruler over the text, ticking at token boundaries
    if (bA > 0.002 && endX > x0 + 1) {
      const by = base - fs * 1.12;
      ctx.strokeStyle = ink(0.7 * bA); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, by); ctx.lineTo(endX, by);
      for (const tk of I.toks) if (ca(tk) > 0.3 && !tk.p) { ctx.moveTo(tk.x, by); ctx.lineTo(tk.x, by + 5); }
      ctx.moveTo(endX, by); ctx.lineTo(endX, by + 5);
      ctx.stroke();
      // attention weights under each token: recomputed on every step
      ctx.font = "400 11px " + MONO; ctx.textAlign = "center";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      I.toks.forEach((tk, i) => {
        const c = ca(tk);
        if (c < 0.002 || tk.p) return;
        ctx.fillStyle = gray(bA * c * 0.85);
        ctx.fillText((0.04 + 0.3 * hash(i, step, 5)).toFixed(2), tk.x + tk.w / 2, base + fs * 0.62 + 5);
      });
    }
    // the prediction in progress
    if (cur) {
      const u = (t - cur.t0) / cur.d, si = I.toks.indexOf(cur), lx = cur.x + cur.w + 20, y0 = base + fs * 0.62 + 40, rh = 17;
      const sA = A * sm(u / 0.08) * (1 - sm((u - 0.94) / 0.06));
      ctx.fillStyle = ink(0.55 * sA); ctx.fillRect(cur.x - 2, base - fs * 0.82, 1.5, fs * 0.95);
      ctx.font = "400 11px " + MONO; ctx.textAlign = "left";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
      ctx.fillStyle = gray(0.9 * sA);
      ctx.fillText(u < 0.4 ? "THINKING" : u < 0.72 ? "SORTING" : "ASSIGN", lx, base - fs * 0.3);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.font = "400 12px " + MONO;
      for (let ri = 0; ri < cur.rows.length; ri++) {
        const r = cur.rows[ri], jit = 0.03 + 0.55 * hash(si, ri, Math.floor(t * 30));
        let yi, al, p;
        if (u < 0.4) { yi = r.o0; p = jit; al = sm(((u / 0.4) * (I.nRows + 3) - r.o0) / 2); }
        else if (u < 0.72) {
          const e = sm((u - 0.4) / 0.32);
          yi = lerp(r.o0, r.o1, e); p = lerp(jit, r.p, e); al = r.o1 < 4 ? 1 : 1 - sm((e - 0.3) / 0.55);
        } else { yi = r.o1; p = r.p; al = r.o1 < 4 ? 1 : 0; if (!r.win) al *= 1 - sm((u - 0.72) / 0.1); }
        al *= sA;
        if (al < 0.01) continue;
        let x = lx, y = y0 + yi * rh;
        if (r.win && u >= 0.72) { // the chosen token slides into the sentence
          const ew = sm((u - 0.74) / 0.2);
          x = lerp(lx, cur.x, ew); y = lerp(y, base, ew); al *= 1 - sm((u - 0.8) / 0.14);
        }
        ctx.textAlign = "left"; ctx.fillStyle = ink(al * 0.9); ctx.fillText(r.s, x, y);
        if (!(r.win && u >= 0.72)) { ctx.textAlign = "right"; ctx.fillStyle = gray(al); ctx.fillText(p.toFixed(2), lx + 170, y); }
      }
    }
    // the four interests leave the sentence and settle beneath where their molecules will clump
    for (const tk of I.toks) {
      if (tk.k == null || t < tk.sepAt || t >= tk.sepAt + C.separate) continue;
      const e = sm((t - tk.sepAt) / C.separate), d = I.dest[tk.k];
      const x = lerp(tk.x + tk.w / 2, d.x, e), y = lerp(base, d.y, e) - Math.sin(Math.PI * e) * 26;
      ctx.textAlign = "center";
      ctx.font = "400 " + lerp(fs, 10.5, e) + "px " + sans;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.fillStyle = ink(1 - sm((e - 0.25) / 0.5)); ctx.fillText(tk.text, x, y);
      ctx.font = TITLE_FONT;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
      ctx.fillStyle = gray(sm((e - 0.3) / 0.6)); ctx.fillText(tk.text.toUpperCase(), x, y);
    }
  }

  function draw(now) {
    if (!built) return;
    if (wide && intro && iState < 2 && scrollY > 0) scrollTo({ top: 0, left: 0, behavior: "instant" }); // the opening plays at the top
    const sy = scrollY, Sx = clamp(sy, 0, 1e9);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // which part of the opening we are in
    let mode = "scroll", t = 99, fade = 1;
    if (wide) {
      if (intro && iState === 0) {
        if (!waitT0) waitT0 = now;
        if (fontsOk || now - waitT0 > 1500) { iState = 1; introT0 = now; }
      }
      if (intro && iState === 1) { t = (now - introT0) / 1000; if (t >= intro.end) { iState = 3; unlock(); } }
      mode = !intro ? "scroll" : iState === 0 ? "wait" : iState === 1 ? "run" : "scroll";
      if (iState === 2) fade = sm((now - skipAt) / 600);
    } else {
      if (!t0) t0 = now;
      t = reduce ? 99 : (now - t0) / 1000;
    }
    const dy = -sy; // molecules and lines are both kept in document space

    // 1. geometry for every molecule
    for (let k = 0; k < K; k++) {
      if (!wide) placeStatic(k, Sx, t);
      else if (mode === "run") placeEntry(k, t);
      else if (mode === "wait") hideMolecule(k);
      else placeRouted(k, Sx, fade);
    }

    // 2. collect what the page lines must open around, from the exact geometry drawn
    discs.length = 0; caps.length = 0; boxes.length = 0;
    const pad = F.pad, ew = F.edgeWidth;
    const edgeList = [];
    for (let k = 0; k < K; k++) {
      const g = G[k], m = mols[k];
      const add = (i, j, alpha) => {
        if (alpha < 0.01) return;
        const depth = 0.72 + 0.28 * ((g.z[i] + g.z[j]) / 2 + 1) / 2;
        edgeList.push([g.x[i], g.y[i] + dy, g.x[j], g.y[j] + dy, alpha * depth]);
        caps.push({ ax: g.x[i], ay: g.y[i] + dy, bx: g.x[j], by: g.y[j] + dy, r: (pad + ew / 2) * Math.min(1, alpha * 8) });
      };
      for (let i = 0; i < NP - 1; i++) add(i, i + 1, 0.62 * Math.min(g.a[i], g.a[i + 1]));
      m.prox.forEach(([i, j]) => add(i, j, 0.5 * Math.min(g.a[i], g.a[j]) * Math.min(g.c[i], g.c[j])));
      for (let i = 0; i < NP; i++) if (g.a[i] > 0.01) discs.push({ x: g.x[i], y: g.y[i] + dy, r: (pad + g.r[i]) * Math.min(1, g.a[i] * 8) });
    }
    placeTitles(sy);
    for (let k = 0; k < K; k++) {
      for (const ti of G[k].tit) {
        const s = Math.min(1, ti.a * 8);
        boxes.push({ x0: ti.x0 - pad * s, x1: ti.x1 + pad * s, y0: ti.y0 + dy - pad * s, y1: ti.y1 + dy + pad * s });
      }
    }

    // 3. the page lines, with holes
    ctx.fillStyle = "rgb(" + F.lineColor + ")";
    const lw = Math.max(1, Math.round((F.lineWidth || 1) * dpr)) / dpr; // whole device pixels, so the line stays crisp
    for (const ln of lines) {
      const ly = Math.round((ln.y - sy - (lw - 1) / 2) * dpr) / dpr;
      if (ly < -pad - 4 || ly > H + pad + 4) continue;
      const mid = ly + lw / 2;
      intervals.length = 0;
      const flat = [];
      for (const d of discs) { const e = mid - d.y; if (Math.abs(e) < d.r) { const h = Math.sqrt(d.r * d.r - e * e); flat.push([d.x - h, d.x + h]); } }
      for (const c of caps) {
        if (mid < Math.min(c.ay, c.by) - c.r || mid > Math.max(c.ay, c.by) + c.r) continue;
        const o = []; if (capInterval(c, mid, o)) flat.push([o[0], o[1]]);
      }
      for (const b of boxes) if (mid >= b.y0 && mid <= b.y1) flat.push([b.x0, b.x1]);
      flat.sort((a, b) => a[0] - b[0]);
      let x = ln.x0;
      for (const [l, r] of flat) {
        if (r <= x) continue;
        if (l >= ln.x1) break;
        if (l > x) ctx.fillRect(x, ly, l - x, lw);
        x = Math.max(x, r);
      }
      if (x < ln.x1) ctx.fillRect(x, ly, ln.x1 - x, lw);
    }

    // 4. the opening line, then bonds, atoms and titles
    if (mode === "run") drawIntro(t);
    ctx.font = TITLE_FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
    ctx.lineWidth = ew; ctx.lineCap = "round";
    for (const e of edgeList) {
      ctx.strokeStyle = "rgba(" + INK + "," + e[4].toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[2], e[3]); ctx.stroke();
    }
    for (let k = 0; k < K; k++) {
      const g = G[k];
      for (let i = 0; i < NP; i++) {
        if (g.a[i] < 0.01) continue;
        const depth = 0.7 + 0.3 * (g.z[i] + 1) / 2;
        ctx.fillStyle = "rgba(" + INK + "," + (g.a[i] * depth).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(g.x[i], g.y[i] + dy, g.r[i], 0, TAU); ctx.fill();
      }
    }
    // titles last, on top of every string, with a paper-coloured halo (the same trick as the hero text)
    ctx.font = TITLE_FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
    ctx.lineJoin = "round"; ctx.lineWidth = 4;
    for (let k = 0; k < K; k++) {
      for (const ti of G[k].tit) {
        const txt = LABELS[k].toUpperCase();
        ctx.textAlign = ti.al;
        ctx.strokeStyle = "rgba(250,250,248," + Math.min(1, ti.a * 1.6).toFixed(3) + ")";
        ctx.strokeText(txt, ti.x, ti.y + dy);
        ctx.fillStyle = "rgba(110,110,110," + ti.a.toFixed(3) + ")";
        ctx.fillText(txt, ti.x, ti.y + dy);
      }
    }
    animating = wide ? (intro ? iState <= 1 || (iState === 2 && now - skipAt < 650) : false) : (!reduce && t < 4.6);
  }

  /* ---------- run ---------- */
  let raf = 0, animating = true;
  const frame = (now) => { raf = 0; draw(now); if (animating) request(); };
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener("scroll", request, { passive: true });
  // The opening plays out in full. A click, Escape, Enter or Space skips it, and so does a deliberate scroll or swipe;
  // brushing the trackpad does not. Until then the page is held at the top.
  let pull = 0, ty = null;
  const live = () => intro && iState < 2;
  const hold = (e, d) => { if (!live()) return; if (e.cancelable) e.preventDefault(); pull += d; if (pull > 520) skip(); };
  const onWheel = (e) => hold(e, Math.abs(e.deltaY));
  const onTouchStart = (e) => { ty = e.touches[0].clientY; };
  const onTouchMove = (e) => { const y = e.touches[0].clientY; hold(e, Math.abs(y - (ty == null ? y : ty)) * 4); ty = y; };
  const onKey = (e) => {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "PageDown" || e.key === "End") { if (live()) e.preventDefault(); skip(); }
  };
  function unlock() {
    removeEventListener("wheel", onWheel); removeEventListener("touchstart", onTouchStart);
    removeEventListener("touchmove", onTouchMove); removeEventListener("keydown", onKey, true); removeEventListener("pointerdown", skip, true);
  }
  function skip() {
    if (!(intro && iState < 2)) return;
    iState = 2; skipAt = performance.now(); animating = true; unlock(); request();
  }
  if (innerWidth >= 1024 && !reduce) {
    addEventListener("pointerdown", skip, true);
    addEventListener("keydown", onKey, true);
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("touchstart", onTouchStart, { passive: true });
    addEventListener("touchmove", onTouchMove, { passive: false });
  }

  let rebuildTimer = 0, lastKey = "";
  function refresh(force) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const key = innerWidth + "x" + innerHeight + ":" + Math.max(root.scrollHeight, document.body.scrollHeight);
      if (!force && key === lastKey) return;
      lastKey = key;
      build(); request();
    }, force ? 0 : 120);
  }
  addEventListener("resize", () => refresh(false));
  if ("ResizeObserver" in window) new ResizeObserver(() => refresh(false)).observe(document.body);
  // the opening waits for the fonts so the typed line is measured once, with the right letterforms
  const fontsReady = () => {
    fontsOk = true; clearTimeout(rebuildTimer);
    lastKey = innerWidth + "x" + innerHeight + ":" + Math.max(root.scrollHeight, document.body.scrollHeight);
    build(); request();
  };
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('400 30px "Instrument Sans"'), document.fonts.load('500 11px "IBM Plex Mono"'), document.fonts.ready]).then(fontsReady, fontsReady);
  } else fontsOk = true;
  addEventListener("load", () => { refresh(true); setTimeout(() => refresh(true), 1800); });

  build(); lastKey = innerWidth + "x" + innerHeight + ":" + Math.max(root.scrollHeight, document.body.scrollHeight);
  request();
})();
