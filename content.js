// ============================================================
// EDIT THIS FILE to change what appears on the site.
// `focus` on a section lists which hero-graphic clusters light up
// while that section is on screen (indexes into `clusters`).
// An item may have `links: [{ label, href }]`, shown as a row of links under its description.
// `href` can be a full URL, or a path to a file in this folder (for example "papers/name.pdf").
// ============================================================
window.SITE = {
  name: "Abhay Sivaram",
  figure: "Areas of interest",
  tagline: "Machine learning and the mathematics behind it.",
  bio: "I am a high school sophomore conducting independent research in machine learning, on efficient long-context retrieval and algorithmic fairness. I have programmed since the age of nine and have built full-stack applications and computer-vision tools. I also study quantitative finance and mathematics.",
  links: [
    { label: "Email", href: "mailto:abhay.sivaram@gmail.com" },
    { label: "GitHub", href: "https://github.com/GruntingRhino" },
  ],

  // Hero graphic groups: 0 Machine Learning, 1 Software Engineering, 2 Quantitative Finance, 3 Mathematics
  clusters: ["Machine Learning", "Software Engineering", "Quantitative Finance", "Mathematics"],

  highlights: [
    { value: "3–5×", label: "Lower retrieval cost, HERA" },
    { value: "7×", label: "Smaller retrieval index, HERA" },
    { value: "100% → 4%", label: "Worst-case false-positive rate, fixed in seed inference" },
  ],

  sections: [
    { key: "research", title: "Research", focus: [0, 3] },
    { key: "projects", title: "Projects", focus: [0, 1, 2] },
    { key: "publications", title: "Publications", focus: [0, 3] },
    { key: "education", title: "Education & Activities", focus: [0, 1, 2, 3] },
  ],

  research: [
    {
      focus: [0, 3],
      title: "HERA",
      subtitle: "Memory and retrieval over long contexts on a single consumer GPU",
      date: "Ongoing",
      description:
        "Investigates how a model can store and retrieve information across very long contexts without specialized hardware. On a single consumer GPU, the methods tested reduced retrieval cost by a factor of 3–5 and index size by a factor of 7.",
      tags: ["Long context", "Retrieval", "Efficient inference"],
    },
    {
      focus: [0, 3],
      title: "Proxy-Guided Sampling and Skin-Tone Equity",
      subtitle: "A re-registered audit of my own fairness claims",
      date: "2026",
      description:
        "Re-tested whether rebalancing training data by an image-colour proxy for skin tone improves melanoma detection for darker skin: 7 methods, 10 seeds each, trained on HAM10000 and evaluated externally on Fitzpatrick17k. No method helped, and my earlier positive results did not survive controlled comparison, so I withdrew them. Along the way I showed that combining per-seed p-values with Fisher's method can produce false positives up to 100% of the time, and built a hierarchical bootstrap that stays at or below the nominal 5%.",
      tags: ["Fairness", "Medical imaging", "Statistical inference"],
      links: [
        { label: "Paper (PDF)", href: "papers/proxy-sampling-audit.pdf" },
        { label: "Code", href: "https://github.com/GruntingRhino/Medical-Image-Classifier" },
      ],
    },
  ],

  projects: [
    {
      focus: [1],
      title: "GoodHours",
      subtitle: "Web platform for student service hours · Solo developer",
      date: "In development",
      description:
        "A web platform for recording student service hours and connecting students with organizations. Schools track hours and integrate with their existing student information systems; organizations reach more students. Developed in collaboration with my school.",
      tags: ["Full-stack development", "System integration"],
      links: [{ label: "Website", href: "https://goodhours.app" }],
    },
    {
      focus: [0, 1],
      title: "Athlemetry",
      subtitle: "Video-based performance analysis for athletes",
      date: "In development",
      description:
        "Analyzes video of games and drills and reports where an athlete can improve, using a lightweight computer-vision model that I pre-trained and optimized.",
      tags: ["Computer vision", "Model optimization"],
      links: [
        { label: "Website", href: "https://athlemetry.vercel.app" },
        { label: "Code", href: "https://github.com/GruntingRhino/Athlemetry" },
      ],
    },
    {
      focus: [2, 3],
      title: "Quantitative Finance",
      subtitle: "",
      date: "Ongoing",
      description: "", // left blank for now; a new project will go here
    },
  ],

  publications: [
    {
      focus: [0, 3],
      title:
        "Proxy-Guided Sampling Does Not Improve Skin-Tone Equity in Melanoma Classification: A Re-registered Audit, and Why Combining Training Seeds with Fisher's Method Fails",
      subtitle: "Abhay Sivaram · Independent research",
      date: "Preprint, November 2026",
      description:
        "Shows that the quantile-bin sampling rule I originally proposed leaves the training data unchanged, and that no proxy-based method detectably improves external or darker-skin accuracy. Explains the failure (a dermoscopy-to-photo domain gap, only 38 dark-skin melanomas in the benchmark, and a proxy partly confounded with the diagnosis). Gives a calibrated method for comparing models trained with several random seeds. Replaces an earlier draft whose results I withdrew.",
      tags: ["Algorithmic fairness", "Statistics", "Reproducibility"],
      links: [{ label: "Paper (PDF)", href: "papers/proxy-sampling-audit.pdf" }],
    },
  ],

  education: [
    {
      focus: [0, 1, 2, 3],
      title: "High School",
      subtitle: "Sophomore",
      date: "Current",
      description: "",
    },
    {
      focus: [0, 1, 2, 3],
      title: "Competitive Speech and Debate",
      subtitle: "National tournament competitor",
      date: "",
      description:
        "Has competed at multiple national tournaments and advanced to elimination rounds.",
      links: [{ label: "Case disclosures", href: "https://opencaselist.com/hspf26/Lincoln-Sudbury/KaSi" }],
    },
    {
      focus: [0, 1, 2, 3],
      title: "Speech and Debate Summer Program",
      subtitle: "Harvard University",
      date: "2026",
      description: "",
    },
    {
      focus: [3],
      title: "Higher Mathematics Summer Program",
      subtitle: "Columbia University",
      date: "2026",
      description: "",
    },
  ],
};
