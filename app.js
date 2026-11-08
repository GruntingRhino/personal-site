(function () {
  const S = window.SITE;
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, props = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") n.className = v; else n.setAttribute(k, v);
    });
    [].concat(children).forEach((c) => n.append(c instanceof Node ? c : document.createTextNode(c)));
    return n;
  };
  // allowed: web and mail links, in-page anchors, root paths, and plain relative file paths such as papers/name.pdf (no scheme, so nothing like javascript:)
  const safe = (href) => (/^(https?:|mailto:|\/|#)|^[\w%.\/-]+$/i.test(href) ? href : "#");
  const newTab = (a, href) => { if (/^https?:|\.pdf$/i.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } return a; };
  const pad = (n) => String(n).padStart(2, "0");

  /* ============ Content (runs first; independent of animation) ============ */
  document.title = S.name;
  $("name").textContent = S.name;
  $("foot-name").textContent = S.name;
  $("kicker").textContent = S.kicker || "";
  $("fig").textContent = "Fig. 01 — " + (S.figure || "Areas of work");
  $("tagline").textContent = S.tagline;
  $("bio").textContent = S.bio;
  $("year").textContent = new Date().getFullYear();

  S.links.forEach((l) => {
    const a = el("a", { href: safe(l.href) }, l.label);
    if (/^https?:/i.test(l.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    $("links").append(el("li", {}, a));
  });
  S.highlights.forEach((h) =>
    $("highlights").append(el("div", {}, [el("dd", {}, h.value), el("dt", {}, h.label)])));

  function renderItem(it) {
    const body = el("div", { class: "body" }, [
      el("h3", {}, it.link
        ? el("a", { href: safe(it.link), target: "_blank", rel: "noopener noreferrer" }, it.title)
        : it.title),
    ]);
    if (it.subtitle) body.append(el("p", { class: "sub" }, it.subtitle));
    if (it.description) body.append(el("p", {}, it.description));
    if (it.links && it.links.length)
      body.append(el("ul", { class: "links item-links mono", "aria-label": "Links" }, it.links.map((l) =>
        el("li", {}, newTab(el("a", { href: safe(l.href), "aria-label": l.label + ": " + it.title }, l.label), l.href)))));
    if (it.tags && it.tags.length)
      body.append(el("ul", { class: "tags mono", "aria-label": "Tags" }, it.tags.map((t) => el("li", {}, t))));
    return el("li", { class: "item" }, [el("span", { class: "date mono" }, it.date || ""), body]);
  }

  const main = $("main");
  S.sections.forEach((sec, i) => {
    const items = S[sec.key] || [];
    const hid = "sec-" + sec.key;
    main.append(el("section", { id: sec.key, "aria-labelledby": hid, class: "reveal" }, [
      el("div", { class: "sec-head" }, [
        el("span", { class: "sec-num mono" }, pad(i + 1)),
        el("h2", { id: hid }, sec.title),
      ]),
      items.length
        ? el("ul", { class: "items" }, items.map(renderItem))
        : el("p", { class: "empty mono", role: "status" }, "Forthcoming"),
    ]));
    $("menu-list").append(el("li", { style: "--i:" + i }, el("a", { href: "#" + sec.key },
      [el("span", { class: "n" }, pad(i + 1)), sec.title])));
  });

  /* ============ Header + menu ============ */
  // The menu opens when the pointer is over the button and stays while it is over the menu.
  // Touch and keyboard use the button as a toggle. Escape, a click elsewhere or choosing a section closes it.
  const bar = $("bar"), btn = $("menu-btn"), menu = $("menu");
  let isOpen = false, closeTimer = 0;
  const setMenu = (open, focusFirst, byHover) => {
    clearTimeout(closeTimer);
    if (open === isOpen) return;
    isOpen = open;
    menu.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    $("menu-label").textContent = open && !byHover ? "Close" : "Menu"; // hovering keeps the label; "Close" only when opened by tap or key
    bar.classList.toggle("open", open);
    if (open && focusFirst) menu.querySelector("a").focus();
  };
  const closeSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(() => setMenu(false), 240); };
  const mouse = (e) => e.pointerType === "mouse" || e.pointerType === "pen";
  btn.addEventListener("pointerenter", (e) => { if (mouse(e)) setMenu(true, false, true); });
  btn.addEventListener("pointerleave", (e) => { if (mouse(e)) closeSoon(); });
  menu.addEventListener("pointerenter", (e) => { if (mouse(e)) clearTimeout(closeTimer); });
  menu.addEventListener("pointerleave", (e) => { if (mouse(e)) closeSoon(); });
  btn.addEventListener("click", (e) => {
    if (mouse(e) && isOpen) return; // already open from hovering: a click should not shut it
    setMenu(!isOpen, e.detail === 0); // keyboard: move focus into the list
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  menu.addEventListener("focusout", (e) => { if (isOpen && e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== btn) setMenu(false); });
  document.addEventListener("pointerdown", (e) => { if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false); });
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen) return;
    const inside = menu.contains(document.activeElement);
    setMenu(false);
    if (inside) btn.focus();
  });
  const onScroll = () => bar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ============ In-page links: a slow, eased glide on wide screens ============ */
  // The molecules are a pure function of scrollY, so a slower scroll is what lets you watch them travel between sections.
  // Menu items, the name and "Top" all use it. Narrow screens and reduced motion keep the browser's own jump.
  const WIDE = matchMedia("(min-width: 64rem)"); // keep equal to the wide breakpoint in molecules.js and styles.css
  const GLIDE = { pxPerSecond: 600, min: 1.4, max: 5 }; // average speed, and the shortest and longest a glide may take (seconds)
  let glideFrame = 0, glideAt = 0;
  const stopGlide = () => { cancelAnimationFrame(glideFrame); glideFrame = 0; };
  function glide(to) {
    stopGlide();
    const from = scrollY, dist = to - from;
    if (Math.abs(dist) < 2) return;
    const dur = Math.min(GLIDE.max, Math.max(GLIDE.min, Math.abs(dist) / GLIDE.pxPerSecond)) * 1000, t0 = performance.now();
    glideAt = from;
    const step = (now) => {
      if (Math.abs(scrollY - glideAt) > 3) { glideFrame = 0; return; } // the reader took over (wheel, keys, scrollbar)
      const u = Math.min(1, (now - t0) / dur);
      glideAt = from + dist * (0.5 - Math.cos(Math.PI * u) / 2); // sine ease in and out: the peak speed is only 1.6x the average
      scrollTo({ top: glideAt, left: 0, behavior: "instant" });
      glideFrame = u < 1 ? requestAnimationFrame(step) : 0;
    };
    glideFrame = requestAnimationFrame(step);
  }
  ["wheel", "touchstart", "keydown"].forEach((t) => addEventListener(t, stopGlide, { passive: true }));
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains("skip") || reduce || !WIDE.matches) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1)), target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0; // same offset the native jump uses
    const max = document.documentElement.scrollHeight - innerHeight;
    glide(Math.min(max, Math.max(0, target.getBoundingClientRect().top + scrollY - offset)));
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true }); // keyboard users land in the section, as with a native jump
  });

  /* ============ Scroll reveal ============ */
  const sections = [...document.querySelectorAll("main section")];
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.05 });
    sections.forEach((s) => io.observe(s));
  } else sections.forEach((s) => s.classList.add("in"));
})();
