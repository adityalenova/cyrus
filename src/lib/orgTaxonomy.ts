/* ══ orgTaxonomy.ts - the two ways people sort an organization ═══════════
   The directory used to offer a "level" (beginner / intermediate / advanced)
   and a "focus area". Neither is how anyone actually picks a place to
   contribute: the useful questions are what field is this organization in,
   and what does it make things with. So both filters below replace those.

   Both are derived, never hand-typed per organization:

   - sector comes from the program's own category string (GSoC writes
     "Science and medicine", ESoC writes "Radio Astronomy & Signal
     Processing", LFX writes "Hyperledger"), folded into a fixed list of
     buckets so the filter has a handful of options instead of 95.
   - technology comes from the technologies and topics a program attaches to
     each participant, plus the primary languages we read off GitHub. Those
     lists are raw contributor text - "#js", "c/c++", "artificial
     intelligence", "node.js" all mean one thing each - so they are folded
     through an alias table before they reach a dropdown.

   Nothing here invents a fact about an organization: if a row carries no
   category and no technologies, it lands in "Other" with no tech chips.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── sectors ─────────────────────────────────────────────────────────── */

export const SECTORS = [
  "AI & Machine Learning",
  "Web & Frontend",
  "Apps & End-User Software",
  "Cloud & Infrastructure",
  "Databases & Data",
  "Developer Tools",
  "Programming Languages",
  "Operating Systems",
  "Science & Medicine",
  "Space & Geospatial",
  "Security & Privacy",
  "Networking & Communications",
  "Media, Arts & Design",
  "Blockchain & Web3",
  "Robotics & Hardware",
  "Education & Community",
  "Other",
] as const;
export type Sector = (typeof SECTORS)[number];

/* Each bucket is a keyword list, matched everywhere in the text and counted.
   The bucket with the most hits wins - one stray mention of "web" in a
   repository blurb should not outvote an organization that says "robotics"
   about itself four times. Ties go to the earlier rule, so the specific
   buckets sit above the broad ones ("space law" should not fall into "Web"
   just because the organization also ships a website).
   Where a loose match would swallow an unrelated word the keyword is anchored
   to a word boundary: "space" inside "workspace", "observ" inside
   "observability", "art" inside "department" and "cli" inside "client" each
   did real damage to this list once. */
const SECTOR_RULES: [string, Sector][] = [
  ["astronom|\\bastro\\b|astrophy|astronaut|satellite|\\bspace\\b|rocket|launch vehicle|planetary|exoplanet|heliophysics|geospatial|remote sensing|\\bgis\\b|telemetry|radio astronom|observatory|spectroscop|meteorolog|climate|cosmolog|\\bgnss\\b|\\bdem\\b|\\bosm\\b|openstreetmap", "Space & Geospatial"],
  ["artificial intelligence|\\bai\\b|machine learning|\\bml\\b|deep learning|neural|natural language|\\bnlp\\b|computer vision|\\bllm\\b|\\bllms\\b|genai|generative ai|\\bgpt\\b|speech recognition|reinforcement learning|data?\\s*scienti|inference|embedding", "AI & Machine Learning"],
  ["bioinformat|genomic|\\bbio\\b|medicine|medical|health|neuro|physic|chemistr|mathemat|scientif|research|statistic|x-ray|tomography|multiphysics|ocean|biodiversity|epidem|clinical|molecul|astronomical|engineering simulation|finite element|\\bphysics\\b|simulation", "Science & Medicine"],
  ["security|privacy|anonym|cryptograph|penetration|malware|vulnerab|forensic|zero-knowledge|authentic|threat|hardening|tamper|\\bpii\\b|surveillance", "Security & Privacy"],
  ["blockchain|web3|hyperledger|distributed ledger|\\bdlt\\b|smart contract|bitcoin|ethereum|cryptocurrenc|decentralized trust|\\bdapp\\b", "Blockchain & Web3"],
  ["robot|hardware|embedded|arduino|raspberry pi|beaglebone|\\bfpga\\b|silicon|\\basic\\b|drone|aerospace|automotive|\\bsensor|internet of things|\\biot\\b|\\buav\\b|flight control|3d print|oscilloscope|\\bcnc\\b|\\bmcu\\b|microcontrol", "Robotics & Hardware"],
  ["operating system|\\bos\\b|kernel|debian|freebsd|openbsd|netbsd|\\bdragonfly\\b|\\bbsd\\b|device driver|firmware|systemd|init system|window manager|desktop environment|bootloader|package for a?\\s*distribution|\\blfs\\b|from scratch|\\bunix\\b|\\blinux\\b", "Operating Systems"],
  ["compiler|toolchain|debugger|profiler|developer tool|development tool|devtool|\\bcli\\b|command[ -]line|package manager|build system|code quality|linter|static analysis|\\bsdk\\b|api gateway|\\bframework\\b|test framework|continuous integration|version control|\\bgit\\b|source control|code review|\\bide\\b|editor|templating|\\bapi\\b|documentation generator|testing|automation", "Developer Tools"],
  ["programming language|language implementation|language runtime|virtual machine|bytecode|interpreter|lexer|parser generator|\\bantlr\\b|compiler construction|language specification|language tooling", "Programming Languages"],
  ["database|data warehouse|analytics|data pipeline|business intelligence|\\betl\\b|data engineering|graph database|search engine|indexing|big data|datalake|\\bdata\\b|knowledge graph|\\barrow\\b|\\bbeam\\b|\\bspark\\b|\\bkafka\\b|\\bairflow\\b|data visuali|\\bsql\\b|data format|spreadsheet|\\bjson\\b|\\bxml\\b", "Databases & Data"],
  ["cloud|infrastructure|serverless|devops|monitoring|observability|container|kubernetes|docker|orchestrat|microservice|deploy|hosting|virtuali|platform engineering|edge computing|message queue|site reliability|\\bsre\\b|\\bpaaS\\b|provisioning", "Cloud & Infrastructure"],
  ["network|telecom|protocol|router|switch|\\b5g\\b|beacon|\\bdns\\b|internet infrastructure|communication|email|messaging|\\bchat\\b|voice|video conferenc|\\bvoip\\b|\\brtc\\b|\\bsip\\b|\\bproxy\\b|load balanc|\\bhttp\\b|streaming|\\bmqtt\\b|\\bvpn\\b|mesh", "Networking & Communications"],
  ["mobile|android|\\bios app\\b|\\biphone\\b|flutter|react native|kotlin|\\bswift\\b|\\bpwa\\b|desktop app|end[- ]?user|productivity|file manager|media player|emulat|library management|note[ -]?taking|\\bebook\\b|browser extension|\\bclient app\\b|user interface|cross-platform", "Apps & End-User Software"],
  ["\\bweb\\b|website|\\bweb app\\b|web application|browser|frontend|front[- ]end|\\bhtml\\b|\\bcss\\b|javascript|\\breact\\b|\\bvue\\b|angular|svelte|\\bcms\\b|content management|e-commerce|\\bseo\\b|static site|web component|node\\.js|single[- ]page app|\\bhttp server\\b|web framework|webAssembly", "Web & Frontend"],
  ["media|music|audio|\\bimage\\b|photo|\\bgame\\b|gaming|graphic|design|visual|animation|vector|\\b3d\\b|creative|typography|rendering|drawing|painting|video editing|\\bfont\\b|\\bart\\b|\\bcart\\b|\\bcc0\\b|paint|\\bsvg\\b|\\bgame engine\\b|\\bmuseum\\b|cultural", "Media, Arts & Design"],
  ["educat|teach|learning platform|\\bschool\\b|univers|curricul|mentor|community|non[- ]?profit|foundation|diversity|outreach|accessib|localiz|government|civic|journalism|open knowledge|licensing|open source\\s+(project|community)|\\bwikis\\b|\\bwiki\\b|\\bdoc\\b", "Education & Community"],
];

const COMPILED: [RegExp, Sector][] = SECTOR_RULES.map(([source, sector]) => [new RegExp(source, "gi"), sector]);

/** Fold any free-text category into one of our buckets.
    Pass the row's own summary first: it counts double, so the organization's
    description outranks the blurbs of its busiest repositories. */
export function sectorOf(...texts: (string | null | undefined)[]): Sector {
  const parts = texts.filter(Boolean).map(String);
  const joined = parts.join(" ");
  if (!joined.trim()) return "Other";
  const self = parts.slice(0, 2).join(" ");
  let best: Sector = "Other";
  let bestScore = 0;
  for (const [re, sector] of COMPILED) {
    const score = (self.match(re)?.length ?? 0) * 2 + (joined.match(re)?.length ?? 0);
    if (score > bestScore) { bestScore = score; best = sector; }
  }
  return best;
}

/* ── technologies ────────────────────────────────────────────────────── */

/* Raw contributor text collapses onto one spelling per idea. Keys are what a
   program wrote, values are what we show. */
const TECH_ALIAS: Record<string, string> = {
  js: "javascript", "#js": "javascript", "es6": "javascript",
  ts: "typescript", py: "python", golang: "go",
  "node": "node.js", "node.js": "node.js", nodejs: "node.js", "node js": "node.js",
  "react.js": "react", reactjs: "react",
  "angular.js": "angular", angularjs: "angular",
  "vue.js": "vue", vuejs: "vue",
  "next.js": "next.js", nextjs: "next.js",
  "c++11": "c++", "c++14": "c++", "c++17": "c++", "c++20": "c++", "c++23": "c++",
  "c99": "c", "c language": "c", "c programming": "c",
  "artificial intelligence": "ai", "artificial-intelligence": "ai", "ai/ml": "ai",
  "machine learning": "machine learning",
  "k8s": "kubernetes", "postgres": "postgresql", "pg": "postgresql",
  "web assembly": "webassembly", wasm: "webassembly",
  "apache airflow": "airflow", "apache spark": "spark", "apache kafka": "kafka",
  "apache beam": "beam", "apache arrow": "arrow", "apache cassandra": "cassandra",
  "apache storm": "storm", "apache flink": "flink",
  "objectivec": "objective-c", "obj-c": "objective-c",
  "f-sharp": "f#", "dot net": ".net", dotnet: ".net",
  "user experience design": "ux", "user interface": "ui",
  "natural language processing": "nlp", "high performance computing": "hpc",
  "web application": "web", "web applications": "web", "website": "web", "web development": "web",
  "restful api": "rest", "representational state transfer": "rest",
  "internet of things": "iot", "machine to machine": "m2m",
  "go lang": "go", "golang ": "go",
  "relational database": "sql", "rdbms": "sql",
  "rest api": "rest", "restful": "rest", "web services": "rest",
  "microsoft azure": "azure", "amazon web services": "aws",
  "continuous integration": "ci", "ci/cd": "ci-cd", "cicd": "ci-cd",
  "open graphics consortium standards": "ogc", "ogc standards": "ogc",
};

/* Words contributors type into a technology field that are not a technology.
   Dropping them keeps the dropdown honest. */
const TECH_STOP = new Set([
  "app", "apps", "api", "apis", "backend", "frontend", "full stack", "fullstack",
  "advanced data structures", "algorithms", "communication", "research skills",
  "technical writting", "technical writing", "scouting", "mapping", "testing",
  "documentation", "web and dapp security frameworks", "others", "other",
  "project", "work", "team", "new", "using", "with", "and", "the", "a",
  "education", "educational", "healthcare", "science", "scientific", "math",
  "open source", "opensource", "community", "programming languages", "programming language",
  "software engineering", "computer science", "year", "years", "students", "learning",
]);

/** One raw string -> zero or more canonical technologies. */
export function normalizeTechs(raw: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const value of raw) {
    let t = String(value ?? "").trim().toLowerCase();
    if (!t) continue;
    /* "#scala_lang" and "#jvm" are GitHub topic spellings */
    t = t.replace(/^#+/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    /* "c/c++" and "android/ios" are two technologies in one cell */
    const parts = t.includes("/") && t.length <= 24 ? t.split("/") : [t];
    for (let p of parts) {
      p = p.replace(/^[\s.\-]+|[\s.\-]+$/g, "").trim();
      if (!p || p.length < 2) continue;
      const canon = TECH_ALIAS[p] ?? p;
      if (TECH_STOP.has(canon) || TECH_STOP.has(p)) continue;
      out.add(canon);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/** Rank a program's technologies by how many organizations list them. */
export function techRank(rows: { techs?: string[] }[]): [string, number][] {
  const c = new Map<string, number>();
  for (const r of rows) for (const t of r.techs ?? []) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** GitHub language names ("Jupyter Notebook") to the same vocabulary. */
export function langToTech(lang: string): string {
  const l = lang.trim().toLowerCase();
  return TECH_ALIAS[l] ?? (l === "jupyter notebook" ? "jupyter" : l);
}
