# Site spec: layout, scroll animation, and how to change them without breaking them

Read this before editing anything in this folder. It is written for an agent (or a person) who has been asked to add a part, change content, or change any dimension (widths, padding, fonts, breakpoints, section lengths).

The site is a static page: HTML, CSS and vanilla JS. There is **no build step, no tests and no git repo**. Verification means looking at it in a real browser and running the sweeps in section 7. "It parses" is not "it works".

```
cd /Users/abhay/personal-site && python3 -m http.server 8765      # then open http://localhost:8765
```

---

## 1. What the page does

- A formal, academic, editorial page: paper background `#FAFAF8`, ink `#171717`, Instrument Serif + Geist + IBM Plex Mono, grayscale only. The name in the header is bold (Instrument Serif has no bold weight, so that is the browser's synthesized bold) and set in the normal ink colour. An accent colour was tried and removed, so keep the page grayscale.
- Four small "molecules" (16 dots joined by bonds) live on a fixed `<canvas id="field">` behind the content. One per interest: 0 Machine Learning, 1 Software Engineering, 2 Quantitative Finance, 3 Mathematics.
- On load (wide screens) an **opening** plays: a next-token-prediction line types out the four interests, the interests drop down to become titles, and the molecules fly in from the sides as strings and clump up (section 5).
- While you scroll, each molecule follows its own hand-traced **route** down the page. It is stretched into a string while travelling and coils into a clump when it reaches an item it belongs to (and at the top and bottom of the page). Each clump has its **title directly under it**.
- Routes keep clear of every piece of text. The page's hairlines (section/item dividers) are drawn on the same canvas, and they **open a hole exactly where a strand or title passes through**.
- The header's "[ MENU ]" opens on hover; its rows slide out from the right.

---

## 2. Files and who owns what

| File | Owns | Edit it to |
|---|---|---|
| `content.js` | `window.SITE`: all words, sections, items, `clusters`, `focus` lists | change content |
| `flow.js` | `window.FLOW`: every tunable number, the four routes, the opening script | tune look/motion/routes/opening |
| `app.js` | renders content into the DOM, builds the menu list, header + menu hover logic, the slow in-page link glide, scroll reveal | change DOM generation or menu behaviour |
| `papers/` | PDFs linked from `content.js` by relative path (currently `proxy-stratified-sampling.pdf`, a copy of the paper; replace the file when the paper changes) | add or replace a PDF |
| `index.html` | static skeleton + script order: `content.js`, `flow.js`, `app.js` (defer), `molecules.js` (defer) | add skeleton elements |
| `styles.css` | all CSS, design tokens in `:root` | change look/layout |
| `molecules.js` | the whole canvas engine (measure, plan, place, draw, opening) | change engine behaviour. Avoid unless needed |

`molecules.js` is one IIFE with these sections, in order (search for the names):
`mols` (seeded shapes) → geometry helpers → state → `measure()` → `makePlanner` / `planRoute` / `buildTable` / `at` / `lookup` → `build()` (+ `makeEntry`, `buildIntro`) → per-frame geometry (`ball`, `layNodes`, `placeRouted`, `placeEntry`, `placeStatic`) → draw (`capInterval`, `placeTitles`, `drawIntro`, `draw`) → run (frame loop, opening skip/lock, `refresh`, fonts/load hooks).

Script order matters: `molecules.js` reads `window.SITE`, `window.FLOW`, and DOM that `app.js` creates. Do not make it run before `app.js`.

---

## 3. Golden rules (the invariants)

Break one of these and the animation breaks. Each rule says why and how to check it.

1. **Everything on screen is a pure function of `scrollY`.** No velocity, no easing toward a target, no `setTimeout`/`requestAnimationFrame` that accumulates state, no "last frame" memory. This is what makes reverse scrolling identical and stops teleports. *The only time-based things are the one-time opening and the menu transitions.* Check: the determinism test in section 7.
2. **All geometry lives in document coordinates and is drawn at `y − scrollY`.** Measure once, in `build()`. Do not mix viewport coordinates into planning.
3. **Never read layout (`getBoundingClientRect`, `offsetTop`, `getComputedStyle` for layout) inside `draw()` or a scroll handler.** All measuring happens in `measure()` during `build()`. Layout reads per frame cause jank and feed back into the animation.
4. **Native scrolling only.** Do not hijack the wheel, add scroll-jacking, parallax transforms on content, or smooth-scroll libraries. Two exceptions: the opening, which holds the page at the top for ~5 s (section 5), and the in-page link glide in `app.js` (menu items, the name, "Top"), which animates `scrollTo` slowly on wide screens so the molecules can be watched travelling (see "Change the menu"). Both stop the moment the reader takes over. `html { scroll-behavior: smooth }` stays as the native fallback for narrow screens and reduced motion.
5. **Text is an obstacle, and the obstacle list is explicit.** `measure()` builds it from the `TEXT` selector:
   `.fig,.tagline,.meter,.bio,.links,.highlights > div,.sec-num,h2,.date,h3,.body p,.tags,.empty,.foot > *`.
   *A new kind of text element is invisible to the molecules until it is added to that selector.*
6. **Nothing that holds text may move relative to the document after `build()`.** No `position: sticky`, no scroll-linked transforms, no layout-changing hover or transition effects on measured elements. (`.sec-head` was deliberately un-stickied for this reason.) Entrance effects on measured elements must be opacity-only. `.js .reveal` is opacity-only for this reason. The hero's `.rise` has a 10 px `translateY`, which is why a delayed re-measure runs at `load + 1.8 s`.
7. **The page's dividers are canvas lines, and the CSS borders under them keep their space.** Under `html.cl` the CSS `border-top` is made `transparent` (not removed) so layout is identical to the no-JS/narrow case. **Never change those borders' width.** The canvas line list comes from the selector `.intro,#highlights,main section,.item,.foot` (first `.item` of a list is skipped). A new divider must be added to that selector **and** to the `html.cl …` / `html:not(.cl) …` rules in `styles.css`.
8. **Holes must come from the exact geometry drawn in the same frame.** `draw()` order is: (1) place every molecule, (2) collect hole shapes (`discs` for dots, `caps` for bonds, `boxes` for title text) from that geometry, (3) draw hairlines with holes, (4) draw the opening text, bonds, dots, and then the titles last, on top of every strand, each with a paper-coloured halo so a passing string never cuts through the letters. If you draw something new that crosses hairlines, push a shape for it in step 2, and in viewport space (`y + dy`).
9. **Layout changes after load must trigger a rebuild.** `refresh()` is called on `resize`, a `ResizeObserver` on `document.body` (catches height changes), `document.fonts` ready, and `load` (+1.8 s). A change that moves things without changing document height (an image swapping in, an accordion, a font swap, async content) will not be seen. Dispatch `window.dispatchEvent(new Event("resize"))` after such a change.
10. **Wide mode is `innerWidth ≥ 1024` in JS and `min-width: 64rem` in CSS. Keep them equal.** Below it, molecules are static balls at the top and above the footer (`placeStatic`), with CSS borders and no opening. If you move the breakpoint, change both places and `innerWidth >= 1024` in the opening-lock block.
11. **Molecules never overlap text.** Routes are planned `clearance` (50 px) from text, smoothing may cut corners to 78 % of that, and a clump's radius takes some of it. Current minimum node-to-text gap is about **9 px**. It must stay above 0.
12. **A title is always directly under its clump.** Never move it to a side or above. It fades only when text, another clump, or another title is in the way. The planner reserves extra room above and beside text (`titleRoom`, `titleRoomX`) so that is rare.
13. **The opening must hand off exactly.** The last opening frame and the first scroll-mode frame at `scrollY = 0` must be identical (positions, radius, yaw, title). Both go through `layNodes()`. If you change start radius, yaw, title offset or start position, change them for **both** `placeEntry` and `placeRouted`. Check: section 7 handoff test.
14. **Strings are speed-capped and monotone.** `buildTable` maps scroll → distance along the route with `maxSpeed` and never goes backwards. Do not replace it with a direct `y = scrollY * k` mapping. Routes are long and bend, and this is what stops teleporting.
15. **Do not add pointer or scroll listeners that write to the canvas state.** The canvas only listens to `scroll` (to request a frame), `resize`, and the opening's skip events. `#field` has `pointer-events: none`; keep it.

Stacking: `#field` z-index 0 → hero/intro/main/footer z-index 1 (they need `position: relative`; a new section needs it too) → menu 25 → header bar 30.

---

## 4. How the scroll animation works (mental model)

1. **`measure()`** reads the page once: content column (`M.cl`, `M.cw` = left edge and width of `<main>`'s content box), document height, **landmarks** (named y positions: `top`, `intro`, `stats`, `s0 … sN` per section, `s0i1 …` per extra item, `foot`, `end`), text rectangles, hairlines, items (with `focus`), and `dockY` (the empty band above the footer where the four molecules end up).
2. **`planRoute(k)`** (wide only) turns each route in `flow.js` into a curve. A waypoint is `[u, landmark, f]`: `u` = across the column (0 left edge, 1 right edge; below 0 is the margin), `landmark` = fixed page point, `f` = fraction down toward the next landmark. Steps:
   - waypoint → pixels;
   - push out of text rectangles inflated by `clearance` (and by `titleRoom`/`titleRoomX`);
   - detour around blocked segments with a visibility graph;
   - 170 rounds of elastic smoothing that never reduces clearance (so no sharp turns);
   - resample to even 4 px steps.
3. **`buildTable(k)`** makes `s(S)`: how far along the route the molecule's centre is for every integer scroll position `S`. It aims at the point whose y equals `S + row·H` (`row` eases from the molecule's opening row to `rows[k]`, then to a docking row near the bottom), is speed-capped, monotone, and forced to arrive at the end exactly at the page bottom.
4. **`placeRouted(k, S, fade)`** each frame: centre = `at(route, s(S))`. `coil = max(start, end, item)`:
   - `start` = 1 at the top of the route, fading over `startBlend` px;
   - `end` = 1 over the last `endBlend` px;
   - `item` = 1 while the centre is level with an item whose `focus` includes this molecule (smooth ramp of 0.3·H, clamped to `ramp`).
   `layNodes()` places the 16 dots. Dot `i` has a `rank` along the string; its unravel weight `w = sm(u·(1+peel) − peel·(1−rank))` blends a 3D ball (yaw spins with `S`) into a helix lying along the route.
5. **Bonds:** chain bonds always; "proximity" bonds fade out as the coil opens (`c`).
6. **Titles** (`placeTitles`): when `ta > 0` (coil near 1), a box directly under the clump at `cy + Rb + 8`. Visibility depends on clearance from text, other clumps (nodes with `c ≥ 0.6`), and earlier titles. A thin string passing over a title does **not** hide it. The halo handles that. (Hiding titles for passing strings made them vanish about a third of the time, so it was removed.)
7. **Holes** (section 3, rule 8): analytic intervals per hairline from dot discs, bond capsules (`capInterval`) and title boxes. Hole radius is `pad` (12 px) around a strand, scaled by `min(1, alpha·8)` so holes fade with the strand.

Frame loop: `request()` coalesces `requestAnimationFrame`; a scroll event requests a frame, and the opening keeps requesting while it plays. `draw()` costs 64 dots + ~100 bonds + a few dozen hairline segments; keep it that cheap.

---

## 5. The opening (`intro` in `flow.js`, `buildIntro`/`drawIntro`/`placeEntry` in `molecules.js`)

States (`iState`): `0` waiting for fonts (≤ 1.5 s), `1` playing, `2` skipped (molecules fade in over 0.6 s), `3` finished. Timeline: tokens type from `start`; interests separate at `sep0`; strings enter from `enterDelay`, staggered; ends at `intro.end` (about 5 s; all timings are in `flow.js` and scale together).

- Wide (≥ 1024 px) and not `prefers-reduced-motion` only. Otherwise the scroll mode shows immediately.
- Always plays at the top: `history.scrollRestoration = "manual"` plus `scrollTo(0,0)` at start, and `draw()` re-pins `scrollY` to 0 while the opening runs. Without this, a reload while scrolled skips it.
- Scroll is held at the top for those ~5 s. Wheel/touch/key scrolling is `preventDefault`ed. **Skip** = click, Esc, Enter, Space, ↓, PageDown, End, or a deliberate scroll/swipe (≥ ~520 px of wheel delta). Light trackpad brushes do not skip. The listeners are removed on skip/finish (`unlock()`); do not leave non-passive wheel listeners on the page.
- The text is drawn on the canvas in **viewport** coordinates (the page is pinned at `scrollY = 0`, so viewport = document). It starts at the left edge of `.tagline` and sits between the header and the tagline.
- To change wording: edit `intro.sentence`. `{ t: "…" }` is a fixed word; `{ k: n }` is an interest (its text comes from `clusters[n]`); `c: [[candidate, probability], …]` is the flavour list (first entry is the winner; `""` means "use the real word"). Entry sides/heights: `intro.enter[k]`.
- The opening waits for fonts (`document.fonts.load('400 30px "Geist"')`, `'500 11px "IBM Plex Mono"'`). **If you change fonts, change those two strings** or the typed line will be measured with the wrong letterforms.

---

## 6. Playbook: common changes

### Change copy or add/remove an item
Edit `content.js` only. Each item may have `focus: [clusterIndexes]`; if missing it inherits the section's `focus`. Molecules and the menu follow automatically.
An item may also have `links: [{ label, href }]`, drawn as a row of mono links (`.item-links`) between the description and the tags. `href` is a full URL, or a plain relative path to a file in this folder such as `papers/name.pdf` (put PDFs in `papers/`). http(s) links and PDFs open in a new tab. Empty `subtitle`, `description` or `tags` simply render nothing, so an item can be a title and a date only. Adding or removing link rows changes item heights, so re-run the section 7 sweep.
After a copy change that alters page length, nothing needs fixing, because routes re-plan. Still run the section 7 checks. Longer pages stretch the routes between landmarks.

### Add a section
1. In `content.js`: add `{ key, title, focus }` to `sections` and an array `S[key]`.
2. Nothing else for rendering (`app.js` builds the section, its menu row, and the stagger index).
3. Landmarks `s{i}` and `s{i}i{j}` are numbered by order. **Existing waypoints that name `s3`, `s2i1`, … now point at different places.** Re-check each route visually; if a route looks wrong, edit its waypoints in `flow.js`. A waypoint naming a landmark that no longer exists falls back to its section start, then `top`. To stay safe, add the new section at the end, before the footer.
4. The last waypoint of each route should still sit near the end, and `endU` is where it docks. Keep these in `0…1`.

### Add a new kind of text element or block
- Add its selector to `TEXT` in `measure()`.
- If it has a divider line, follow rule 7 (selector + CSS).
- Give it `position: relative` if it sits in a new top-level block so it stacks above the canvas.

### Change widths, padding, fonts or breakpoints (any dimension)
- Routes are defined relative to the content column (`u`) and landmarks, so most size changes just work. They re-plan on resize, fonts ready and load.
- The risky ones: (a) shrinking the gaps between text blocks below about `2·clearance·0.78 + 2·clump radius` (~110 px), where routes must detour or squeeze; (b) narrowing the left/right margins so a molecule's string has no room beside the text; (c) changing `main`'s padding so `M.cl`/`M.cw` shift. Check those visually.
- Keep `--bar-h`, `.hero`'s height rules and `.tagline`'s position stable, because the opening and the start positions are laid out above the tagline (`buildIntro` uses the tagline's top and left).
- If you change the breakpoint, see rule 10.
- If you change spacing tokens, remember the hairline thickness/colour are in `flow.js` (`lineWidth`, `lineColor`), and the CSS fallback colour is `#cecec8`.

### Add something fixed or floating (a button, toast, side nav)
It must not sit in the document flow among measured text, and must not need to avoid molecules. Put it above the canvas with a z-index between 1 and 25. It will draw over strands, and that is fine. If it must have holes cut in the hairlines, add a rectangle to `boxes` in step 2 of `draw()`.

### Add a fifth molecule/interest (or remove one)
`K = min(clusters.length, FLOW.routes.length)`. For each cluster you need: an entry in `clusters`, a `routes[k]` (name, `endU`, waypoints), a `rows[k]`, an `intro.enter[k]`, and an `{ k: n }` token in `intro.sentence`. The molecule shapes are seeded in order, so adding at the end does not change existing shapes. Trace the new route by copying a similar one and checking section 7. Every `focus` list in `content.js` refers to these indexes.

### Change the menu
Only `app.js` (behaviour) and the "Menu" block in `styles.css`. It is independent of the canvas. Keep `z-index: 25` (below the bar). The hover model (`pointerenter`/`pointerleave` with a 240 ms close delay) is what keeps it from flickering. Click, touch and keyboard toggle; Escape closes. Do not add `hidden`/`display: none` toggling, because the slide-out transitions need `visibility`.

**Link glide.** Clicking any `a[href^="#"]` (menu rows, the name, "Top"; not the skip link) on a wide screen, without reduced motion, is intercepted in `app.js` and scrolled with a rAF loop (`scrollTo(..., behavior: "instant")` each frame, sine ease in/out). The duration is `distance / GLIDE.pxPerSecond`, clamped to `GLIDE.min`..`GLIDE.max` seconds (currently 600 px/s, 1.4 to 5 s). Because molecules are a pure function of `scrollY`, a slower scroll is the whole reason you can see them move; raise `pxPerSecond` to speed it up. It stops when `wheel`, `touchstart` or `keydown` fires, or when `scrollY` no longer matches what the loop last set (scrollbar drag), and it never fights the reader. It also pushes the hash with `history.pushState`, computes the same offset the native jump uses (`scroll-padding-top`) and focuses the target (`tabindex="-1"`, `preventScroll`). It relies on the opening having been skipped by the `pointerdown` that precedes the click, because the opening pins the scroll at 0. Keep its wide breakpoint (`min-width: 64rem`) equal to the other two.

### Tune the look or motion
Everything is in `flow.js` with comments. Common knobs: `lineColor`/`lineWidth` (hairlines), `edgeWidth`, `nodeRadius`, `blobRadius` (clump size), `stringLength`, `helix`, `clearance`, `maxSpeed`, `ramp`, `rows`. Changing `clearance` changes how tight routes are, so re-run the sweep.

---

## 7. Verification (do this after every change that could touch layout, routes or the canvas)

Do not stop at "no console errors".

### 7.1 Temporary debug hook
Append just before the final `})();` of `molecules.js`, run the checks, then **delete it** before finishing:

```js
window.__flow = { get routes(){return routes}, get rects(){return rects}, get M(){return M}, G, get intro(){return intro}, get state(){return iState},
  place:(S)=>{ for (let k=0;k<K;k++) placeRouted(k,S,1); placeTitles(S); return G; } };
```

### 7.2 Sweep (paste in the page console at a wide viewport, after the opening is skipped or finished)

```js
const f = window.__flow, Smax = Math.floor(f.M.docH - innerHeight);
const rd = (r,x,y) => Math.hypot(Math.max(r.x0-x,0,x-r.x1), Math.max(r.y0-y,0,y-r.y1));
let minGap=1e9, maxJump=0, prev=null, notBelow=0, titleOnText=0;
for (let S=0; S<=Smax; S+=4) {
  const G=f.place(S), cur=G.map(g=>[Array.from(g.x),Array.from(g.y)]);
  G.forEach((g,k)=>{
    for (let i=0;i<16;i++) if (g.a[i]>0.05) for (const r of f.rects) minGap=Math.min(minGap, rd(r,g.x[i],g.y[i])-g.r[i]);
    for (const t of g.tit) { if (!(t.y0>g.cy)) notBelow++;
      if (t.a>0.5) for (const r of f.rects) if (Math.min(t.x1,r.x1)>Math.max(t.x0,r.x0) && Math.min(t.y1,r.y1)>Math.max(t.y0,r.y0)) titleOnText++; }
    if (prev) for (let i=0;i<16;i++) maxJump=Math.max(maxJump, Math.hypot(cur[k][0][i]-prev[k][0][i], cur[k][1][i]-prev[k][1][i]));
  });
  prev=cur;
}
const snap = S => JSON.stringify(f.place(S).map(g=>[Array.from(g.x),Array.from(g.y)]));
const probes=[0,500,1500,2500,Smax], fwd=probes.map(snap), back=probes.slice().reverse().map(snap).reverse();
({ minGap, maxJump, notBelow, titleOnText, deterministic: fwd.every((s,i)=>s===back[i]) })
```

Pass criteria:

| Result | Must be | Baseline (current content, 1470×802) |
|---|---|---|
| `minGap` | `> 0` (never overlapping text) | ≈ 9 px |
| `notBelow` | `0` (titles always under the clump) | 0 |
| `titleOnText` | `0` | 0 |
| `deterministic` | `true` (reverse scroll identical) | true |
| `maxJump` (px per 4 px of scroll) | no new spike. Baseline is smooth, ~26 px (the string unravelling, ~6.6 px per scrolled px). A value above ~60, or a jump that appears at one single step, is a teleport | ≈ 26 |

Baselines shift with content. Compare relative changes: don't regress.
If `maxJump` flags something, re-sweep that region at 1 px steps. A smooth ramp is fine; a one-step spike is a bug.

### 7.3 Handoff test (after changing the opening, start radius, titles or `placeRouted`)
With the debug hook plus a temporary `hold(t)` (set `introT0 = performance.now() - t*1000`, `iState = 1`, call `draw`), snapshot `G` at `intro.end − 0.0005` and again at `intro.end + 0.4`. The max difference of `x, y, r, a` and title `x, y, a` must be **0**.

### 7.4 Holes
Zoom into a crossing (`computer zoom` in the browser tool, or devtools) at several scroll positions and confirm: the hairline stops about 12 px before a strand on both sides, no gap where nothing crosses, no hairline running through a title, and the line is not painted over a dot. The earlier pixel-level check (render lines with edges hidden, compare against brute-force distance) matched with zero mismatches except faint (<1 % alpha) proximity bonds.

### 7.5 Visual pass (always)
Screenshot at these scroll positions and look at each: hero (`0`), just past the hero (~700), first research item, middle of projects, publications, education, bottom (`Smax`). Look for: a strand touching text; a title on top of text or a hairline; a clump with no title; molecules jumping between neighbouring scroll positions; hairlines missing or doubled.

Widths to cover: **1024, 1280, 1470, 1920** (wide) and **390** (narrow). Also one DPR 1 and one DPR 2 screen if possible (line thickness rounds to whole device pixels).
Also: reload while scrolled down (opening must still play from the top); click-skip works; light wheel movement does not skip; reduced-motion shows the settled hero with no opening.

### 7.6 Tooling gotchas
- The browser tool's window resize may not change `innerWidth`. Test widths with same-origin `<iframe style="width:Npx">`. An iframe's `innerWidth` is its CSS width, so use ≥ 1030 for wide.
- `python3 -m http.server` and Chrome cache aggressively: `await fetch('/molecules.js',{cache:'reload'})` (and `flow.js`, `styles.css`, `app.js`) then reload, or add `?v=N`.
- For timing-sensitive tests set `document.documentElement.style.scrollBehavior='auto'`, otherwise `scrollTo` is smooth.
- Do not wipe `document.body.innerHTML` in the real page to host test iframes and then keep using it. The resize observer will call `measure()` and throw (`#main` missing). Reload the page afterwards.
- Chrome extensions can log `e.target.contains is not a function` on synthetic scroll events. That is not from this site.
- Remember to delete `window.__flow` and any `hold` helper.

---

## 8. Things that will break it (don't)

| Don't | Because |
|---|---|
| Add easing/lerp/velocity to molecule positions | Violates rule 1: reverse scroll differs and positions lag the scroll |
| `position: sticky`/`fixed`/`transform` animations on text inside `main`/hero/footer | Measured rectangles no longer match where the text is (rule 6) |
| Read `getBoundingClientRect()` in `draw()` or a scroll handler | Jank, and it feeds layout back into the animation (rule 3) |
| Change the CSS `border-top` width of divider elements | Layout shifts between CSS and canvas lines (rule 7) |
| Add text/dividers without updating `TEXT` / the line selector | Molecules cross the text; hairlines have no holes |
| Insert content after load without a rebuild | Routes planned for the old layout; strands cross new text (rule 9) |
| Put long content in a nested `overflow: auto` box | Its scrolling is not `scrollY`; molecules won't track it |
| Change the breakpoint in only one of CSS/JS | Mixed wide/narrow state: routes planned but CSS borders and layout wrong (rule 10) |
| Move titles to a side/top when something is in the way | The user explicitly wants them under the clump; fade or add room instead (rule 12) |
| Change start radius/yaw/title offset in one of `placeEntry`/`placeRouted` | Visible jump when the opening ends (rule 13) |
| Replace the speed-capped table with `y = scrollY·k` | Teleports on bends; strands don't reach their end (rule 14) |
| Leave non-passive `wheel`/`touchmove` listeners on the page | Degrades native scroll performance. They exist only during the opening |
| Rename `#main`, `#field`, `.tagline`, `.intro`, `#highlights`, `.foot`, `.item`, `.sec-num`, etc. | `molecules.js` finds the page by these names |
| Leave `window.__flow` in | Debug surface; delete it |
| Animate scroll for the reader's own wheel/keys, or make the link glide ignore them | Scroll-jacking (rule 4); the glide must yield to the reader immediately |

---

## 9. Config reference (`flow.js`)

| Key | Meaning |
|---|---|
| `pad` | gap cut in a hairline around a strand (px) |
| `lineColor`, `lineWidth` | hairline colour (`"r,g,b"`) and thickness (px) |
| `edgeWidth`, `nodeRadius` | bond width, dot radius |
| `stringLength`, `helix`, `blobRadius`, `startRadius`, `spin` | string length along the route; helix radius; clump radius; opening clump radius (× shorter window side); rotation per scrolled px |
| `titleRoom`, `titleRoomX` | extra route clearance above / beside text so titles fit |
| `clearance` | route distance from text (px) |
| `maxSpeed` | fastest travel (route px per scrolled px) |
| `settle`, `dockSpan` | scroll distances (window heights) for easing to its row / for the four molecules gathering at the bottom |
| `startBlend`, `endBlend`, `peel`, `ramp` | start unravel length, end coil length, unravel stagger, item coil ramp |
| `rows[k]` | height on screen (fraction of window) each molecule travels at |
| `routes[k]` | `{ name, endU, waypoints: [[u, landmark, f], …] }` |
| `intro.*` | timings, `sentence`, `noise`, `enter` (see section 5) |

---

## 10. Decisions (why it is built this way)

- **Hairlines on the canvas.** Strands must open holes in dividers. CSS cannot do that, and drawing the lines on the same canvas lets holes be computed from the exact frame geometry. The CSS borders stay in layout (transparent) so there is no layout shift.
- **Scroll position as the only input.** The user asked for molecules that follow scroll directly with natural scrolling, no lag and no teleports. A pure function of `scrollY` gives reverse-scroll identity for free.
- **Pre-planned routes, not live steering.** Planning once around the real text (visibility graph + smoothing + speed table) gives smooth, deterministic, text-avoiding paths and cheap per-frame work.
- **Static molecules below 1024 px.** Narrow layouts have no free margin to route through, so molecules sit at the top and above the footer.
- **Opening holds scroll and skips only on intent.** Skipping on any wheel or touch event cancelled it on trackpads, and a restored scroll position skipped it on reload. It now always plays, and a click or key skips it.
- **Titles only under the clump.** Switching sides looked erratic. The planner leaves room instead, and titles fade only on a real collision.

---

## 11. Known limits (not verified or not supported)

- Tested in Chrome only (desktop). Safari/Firefox are untested. The opening uses `ctx.letterSpacing`, and falls back to normal spacing where unsupported.
- No real touch-device test; the narrow layout was checked at 390 px in an iframe.
- `prefers-reduced-motion` skips the opening and stops the spin. The code path was written but not exercised in a browser.
- Windows narrower than 1024 px do not get the opening or routed molecules.
- A full rebuild (route planning) runs on resize, fonts, and load, and is debounced (120 ms) except when forced. Do not call `build()` per frame or from rapid events.

---

## 11b. Deploying (Vercel)

- Live at **https://abhaysivaram.vercel.app** (Vercel project `abhaysivaram`, team `gruntingrhinos-projects`, linked through `.vercel/`, which is git-ignored and never uploaded). It is a plain static site: no build step, output directory is the folder itself.
- **Redeploy:** from this folder run `vercel deploy --prod --yes`. Preview deploys without `--prod` get their own URL and leave the live site alone.
- **Rollback:** `vercel rollback` (or "Promote" an earlier deployment in the Vercel dashboard) restores the previous deployment in seconds. Nothing else needs undoing, because there is no database or server state.
- `.vercelignore` keeps `spec.md`, `.impeccable`, `.env*` and `.vercel` out of the upload, so `/spec.md` is a 404 on the live site. Do not remove `.env*` from it: `vercel link` writes a `.env.local` with a token; delete that file after linking.
- `vercel.json` only adds three response headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`). A Content-Security-Policy is not set: `index.html` has one inline script and loads Google Fonts, so a CSP needs a hash for the script and the two font hosts.
- `<title>`, the description and the Open Graph tags in `index.html` are static on purpose: link previews and search engines do not run `app.js`. Keep them in step with `name` and `tagline` in `content.js`. There is no `og:image` yet.
- Everything in this folder that is not ignored is public, including `papers/*.pdf` and every link in `content.js`.
- After a deploy, check: `/` is 200, the opening plays, a menu link glides to its section, `papers/...pdf` is 200, `/spec.md` is 404, and the console is clean.

---

## 12. Before you say "done"

- [ ] Section 7.2 sweep passes (gap > 0, titles below, no title on text, deterministic, no teleport spike).
- [ ] Visual pass at 1024, 1280, 1470, 1920 and 390, at the scroll positions in 7.5.
- [ ] Opening plays on a fresh load and on a reload while scrolled; skip works; handoff has no jump.
- [ ] Hairlines open exactly around strands and titles; no hairline through a title or dot.
- [ ] Menu opens on hover, closes on leave, works with keyboard (Enter / Esc) and click.
- [ ] Menu link glide: a far jump takes several seconds and lands exactly on the section; a wheel or key press stops it; narrow screens use the native jump.
- [ ] No `window.__flow`, no leftover test files in this folder, no console errors.
- [ ] If you changed a rule above or added a selector, update this file.
