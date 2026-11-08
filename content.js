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
    { value: "27%", label: "Reduction in gender accuracy disparity" },
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
      title: "Bias Reduction with Proxy-Based Sampling",
      subtitle: "Fairness when protected attributes are unobserved",
      date: "Ongoing",
      description:
        "Studies proxy-based sampling for reducing subgroup bias when protected attributes are not observed. On melanoma detection (ResNet-50 pretrained on ISIC and fine-tuned on PAD-UFES-20), balanced accuracy improved by 5.6 percentage points overall and by 4.7 points for the darker subgroup (grouped by image brightness, a proxy for skin tone). On the UCI Adult income dataset, the gender accuracy disparity fell by 27%. Both are measured against standard training (ERM); class-stratified sampling and proxy reweighting were also compared.",
      tags: ["Fairness", "Medical imaging", "Statistical learning"],
      links: [
        { label: "Paper (PDF)", href: "papers/proxy-stratified-sampling.pdf" },
        { label: "Code", href: "https://github.com/GruntingRhino/Medical-Image-Classifier" }, // the repo named in the paper
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
        "A Provable Framework for Measuring and Mitigating Subgroup Representation Bias with Proxy Attributes",
      subtitle: "Abhay Sivaram · Independent research",
      date: "In preparation",
      description:
        "Introduces P-Stratified Sampling, a method that uses an observable proxy variable to rebalance training data when protected-attribute labels are unavailable, with a finite-sample bound on worst-case subgroup accuracy disparity. Evaluated on melanoma detection (ISIC, PAD-UFES-20), income prediction (UCI Adult), and text classification (20 Newsgroups), against standard training, class-stratified sampling, and proxy reweighting.",
      tags: ["Algorithmic fairness", "Learning theory"],
      links: [{ label: "Paper (PDF)", href: "papers/proxy-stratified-sampling.pdf" }],
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
