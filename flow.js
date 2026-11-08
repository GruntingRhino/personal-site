// ============================================================
// FLOW — the editable score for the molecules and the page lines.
//
// Everything on screen is a pure function of the scroll position: nothing here is a
// timer. Edit this file to change routes, rows, sizes or the gap cut into page lines.
//
// ROUTES
//   Each molecule follows one route down the page. A waypoint is  [u, landmark, f]
//     u         horizontal position across the text column: 0 = left edge of the text,
//               1 = right edge. Values below 0 are the left margin; below about -0.12 the
//               strand is off-screen (it "leaves" and later "returns").
//     landmark  a fixed point on the page: top, intro, stats, s0 (section 1 top),
//               s0i1 (2nd item of section 1), s1 … s3, foot, end
//     f         0..1, how far down from that landmark to the next one
//   These were traced from the hand-drawn screenshot. At load they are re-planned around the
//   real text boxes (and again on resize), so they keep `clearance` px away from any text and
//   every turn is rounded.
//
// ROWS
//   `rows[cluster]` is the height on screen (fraction of the window) at which that molecule
//   travels while you scroll. Cluster order: 0 Machine Learning, 1 Software Engineering, 2 Quantitative Finance,
//   3 Mathematics.
//
// ENDS
//   `endU` is where each molecule rests above the footer once you reach the bottom (0 = left
//   edge of the text column, 1 = right edge).
//
// WHEN A MOLECULE COILS
//   A strand coils into a small molecule while it is level with an item it belongs to
//   (the `focus` lists in content.js), and at the very start and end of the page. In between
//   it stretches into a string.
// ============================================================
window.FLOW = {
  // page lines
  pad: 12,              // empty space kept around a strand where it passes through a page line (px)
  lineColor: "206,206,200",   // the hairlines between sections and items
  lineWidth: 1.5,             // their thickness (px)

  // look
  edgeWidth: 1.5,
  nodeRadius: 2.6,
  stringLength: 340,    // length of a stretched molecule along its route (px)
  helix: 7,             // radius of the twist in a stretched molecule (px)
  blobRadius: 28,       // size of a coiled molecule beside text (px)
  startRadius: 0.11,    // size of the opening molecules (x the shorter window side)
  spin: 0.0022,         // rotation per scrolled pixel (radians)

  // routes and motion
  titleRoom: 24,        // extra room routes keep above every text block (px), so the title under a clump never lands on text
  titleRoomX: 12,       // and extra room to its left and right (px)
  clearance: 50,        // how far routes keep from any text (px); smoothing may cut corners down to 78% of this
  maxSpeed: 2.4,        // fastest a molecule travels along its route (route px per scrolled px)
  settle: 0.7,          // window heights of scrolling over which a molecule moves from its opening row to its own row
  dockSpan: 1.0,        // window heights before the page bottom over which the four molecules gather
  startBlend: 420,      // route px over which the opening molecule unravels into a string
  endBlend: 320,        // route px over which a string coils into its final molecule
  peel: 0.8,            // how staggered the unravelling is (0 = all at once)
  ramp: [120, 260],     // min / max px over which a string coils as it reaches an item it belongs to

  // the opening: a next-token-prediction line types out the four interests, the interests separate and become
  // the titles, and each molecule streams in from a side as a string and clumps up beneath its title
  intro: {
    // timings are in seconds; the whole opening runs about 5 s. Scale them all together to speed it up or slow it down.
    start: 0.14,         // before the first token
    first: 0.14, punct: 0.06, step: 0.32, interest: 0.42, hold: 0.1,   // time spent on each kind of token
    fadeIn: 0.25, fadeOut: 0.35,                                       // the line fading in at the start, and out as the interests leave it
    separate: 0.5, separateStagger: 0.07,                              // the interests travelling down to become titles
    enterDelay: 0.15, enterStagger: 0.1, enterDur: 1.25,               // strings arriving and clumping
    // each token lists its likely next tokens (first = the one chosen); an interest token takes its text from `clusters` (lower-cased inside the sentence)
    sentence: [
      { t: "I" },
      { t: "work", c: [["work", 0.38], ["build", 0.21], ["research", 0.14], ["study", 0.09]] },
      { t: "across", c: [["across", 0.41], ["in", 0.22], ["at", 0.12], ["around", 0.08]] },
      { k: 0, c: [["", 0.46], ["statistics", 0.17], ["the", 0.12], ["data", 0.08]] },
      { t: ",", p: 1 },
      { k: 1, c: [["", 0.41], ["systems", 0.16], ["robotics", 0.12], ["design", 0.1]] },
      { t: ",", p: 1 },
      { k: 2, c: [["", 0.38], ["statistics", 0.15], ["physics", 0.1], ["biology", 0.06]] },
      { t: "and", c: [["and", 0.52], ["with", 0.14], ["plus", 0.1], ["&", 0.06]] },
      { k: 3, c: [["", 0.47], ["physics", 0.2], ["statistics", 0.12], ["economics", 0.07]] },
      { t: ".", p: 1 },
    ],
    noise: ["tion", "rep", "er", "ent", "dis", "ing", "pre", "con", "sub", "ex", "un"],   // word fragments that flicker in the candidate list
    // per molecule: which side its string enters from (-1 left, 1 right) and the height it travels at (fraction of the window; omit to arrive level)
    enter: [{ side: -1, y: 0.17 }, { side: 1 }, { side: -1 }, { side: 1, y: 0.17 }],
  },

  rows: [0.30, 0.58, 0.72, 0.44],

  // routes, indexed by cluster: 0 Machine Learning (red), 1 Software Engineering (green), 2 Quantitative Finance (blue), 3 Mathematics (purple)
  routes: [
    {
      name: "Machine Learning",
      endU: 0.35, // where this molecule rests at the bottom of the page (across the text column)
      waypoints: [
        [0.301, "top", 0.379], [0.302, "top", 0.45], [0.336, "top", 0.515], [0.457, "top", 0.612],
        [0.613, "top", 0.8], [0.628, "top", 0.868], [0.623, "top", 0.918], [0.593, "top", 0.983],
        [0.528, "intro", 0.044], [0.348, "intro", 0.049], [0.273, "intro", 0.161], [0.128, "intro", 0.224],
        [0.085, "intro", 0.32], [0.079, "intro", 0.501], [0.126, "intro", 0.98], [0.261, "s0", 0.076],
        [0.281, "s0", 0.251], [0.279, "s0i1", 0.106], [0.229, "s0i1", 0.376], [0.063, "s1", 0.004],
        [-0.132, "s1", 0.391], [-0.144, "s1i1", 0.045], [0.105, "s1i1", 0.429], [0.188, "s1i1", 0.864],
        [0.223, "s1i2", 0.151], [0.251, "s1i2", 0.44], [0.247, "s2", 0.075], [0.296, "s2", 0.62],
        [0.298, "s2", 0.95], [0.241, "s3", 0.739],
      ],
    },
    {
      name: "Software Engineering",
      endU: 0.49, // where this molecule rests at the bottom of the page (across the text column)
      waypoints: [
        [0.659, "top", 0.386], [0.682, "top", 0.568], [0.571, "top", 0.73], [0.508, "top", 0.954],
        [0.47, "top", 0.992], [0.37, "intro", 0.006], [0.33, "intro", 0.065], [0.257, "intro", 0.448],
        [0.219, "intro", 0.852], [0.235, "s1", 0.054], [0.168, "s1", 0.229], [0.186, "s1", 0.366],
        [0.174, "s1", 0.423], [0.101, "s1", 0.585], [0.053, "s1", 0.766], [-0.008, "s1", 0.872],
        [-0.028, "s1i1", 0.116], [-0.026, "s1i1", 0.783], [-0.045, "s1i1", 0.914], [-0.045, "s1i2", 0.104],
        [-0.198, "s1i2", 0.481], [-0.211, "s2", 0.058], [-0.192, "s2", 0.193], [-0.081, "s2", 0.472],
        [-0.022, "s2", 0.574], [0.17, "s2", 0.756], [0.202, "s2", 0.887], [0.204, "s3", 0.207],
        [0.229, "s3", 0.514], [0.245, "s3i1", 0.029],
      ],
    },
    {
      name: "Quantitative Finance",
      endU: 0.21, // where this molecule rests at the bottom of the page (across the text column)
      waypoints: [
        [0.038, "top", 0.359], [0.02, "top", 0.471], [-0.097, "top", 0.621], [-0.132, "top", 0.709],
        [-0.136, "top", 0.809], [-0.049, "top", 0.983], [-0.016, "intro", 0.155], [-0.01, "intro", 0.352],
        [-0.225, "s0", 0.132], [-0.239, "s0", 0.875], [-0.047, "s0i1", 0.241], [0.024, "s0i1", 0.423],
        [0.168, "s1", 0.292], [0.154, "s1", 0.629], [0.02, "s1", 0.953], [-0.008, "s1i1", 0.379],
        [-0.012, "s1i1", 0.854], [0.028, "s1i2", 0.313], [0.166, "s1i2", 0.749], [0.213, "s2", 0.083],
        [0.192, "s2", 0.244], [0.202, "s2", 0.426], [0.071, "s3", 0.084], [0.061, "s3", 0.995],
      ],
    },
    {
      name: "Mathematics",
      endU: 0.07, // where this molecule rests at the bottom of the page (across the text column)
      waypoints: [
        [0.452, "top", 0.326], [0.508, "top", 0.386], [0.587, "top", 0.539], [0.735, "top", 0.636],
        [0.832, "top", 0.765], [0.895, "top", 0.942], [0.953, "intro", 0.432], [0.929, "intro", 0.613],
        [0.862, "intro", 0.799], [0.749, "intro", 0.916], [0.642, "intro", 0.964], [0.403, "intro", 0.964],
        [0.322, "stats", 0.015], [0.13, "stats", 0.528], [0.002, "s0", 0.195], [-0.034, "s0", 0.494],
        [-0.036, "s0", 0.819], [0.121, "s0i1", 0.564], [0.192, "s0i1", 0.799], [0.188, "s0i1", 0.922],
        [0.134, "s1", 0.073], [-0.04, "s1", 0.21], [-0.121, "s1", 0.423], [-0.166, "s1", 0.616],
        [-0.15, "s1i1", 0.187], [-0.123, "s1i1", 0.379], [0.275, "s1i2", 0.05], [0.318, "s1i2", 0.232],
        [0.322, "s1i2", 0.474], [0.308, "s1i2", 0.655], [0.251, "s1i2", 0.837], [0.2, "s2", 0.21],
        [0.215, "s2", 0.502], [0.202, "s2", 0.603], [0.16, "s2", 0.747], [-0.02, "s3", 0.422],
        [-0.028, "s3", 0.862],
      ],
    },
  ],
};
