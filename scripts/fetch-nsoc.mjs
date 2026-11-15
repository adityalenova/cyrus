/* ══ fetch-nsoc.mjs — the Nexus Spring of Code project directory ═══════
   nsoc.in renders its project directory in the browser and publishes no API,
   so the 89 rows below were read off the live directory page
   (https://www.nsoc.in/projects) on 2026-10-25: the project title, its
   repository, the technology chips the program shows, the project admin and
   the program's own one-line blurb. Nothing here is invented.

   What this script adds is verification: every repository is re-read from the
   GitHub API, so stars, language, license and open-issue counts are live
   numbers rather than our guess, and any project whose repository has since
   been renamed, made private or deleted is dropped from the file instead of
   shipping a dead link. Run with the gh CLI authenticated:

     npx tsx scripts/fetch-nsoc.mjs        (or: node scripts/fetch-nsoc.mjs)

   Output: public/data/nsoc-projects.json, in the same row shape as
   gsoc-projects.json and otherProjects.json so /projects can read all three. ═ */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const READ_AT = "2026-10-25";
const SOURCE = "https://www.nsoc.in/projects";

/* [title, owner/repo, technology chips, project admin, NSOC's blurb] */
const DIRECTORY = [
["ContribHub","aniket866/ContribHub",["React","Next.js","Node.js","Express.js"],"Aniket Kumar","Helps students to find all open source programs like GSoC, LFX, MLH, NSoC and more."],
["DeepLens","cbithackathon-2025/deep-lens",["React","FastAPI"],"Pradeep G","Ocean intelligence platform for maritime monitoring, vessel anomaly detection and satellite-based pollution analysis with interactive global maps."],
["Quantx_Learning","Abhinavjs903/Quantx_Learning",["React","Next.js","Express.js"],"Abhinav","A student-focused academic portal that brings study material, previous-year papers, notices and essential student tools into one place."],
["WikiNSoC","DYHARDx/WikiNSoC",["Node.js","Next.js"],"Aman","The central documentation repository for Nexus Spring of Code: articles, tutorials, contribution guides and architectural write-ups."],
["Kalamio","kalamiohq/kalamio",["React","Node.js","Express.js","MongoDB","Redis"],"Harish Sehlangia","An open-source publishing platform where anyone can write and share articles and short posts; already live."],
["Notakto-Mobile","notakto/notakto-mobile",["React","Firebase","PostgreSQL","React Native","Expo"],"Ashmit Sherigar","Notakto is a misere form of tic-tac-toe where you want to lose; this is the mobile client for the game."],
["crewai-recipes","Karan-Raj-KR/crewai-recipes",["Node.js"],"Karan Raj K R","Open-source Python library of ready-to-run CrewAI multi-agent templates powered by NVIDIA NIM."],
["Notakto","notakto/notakto-website",["Next.js","React"],"Rakshit Gupta","Notakto - tic-tac-toe variant. No ties, always a winner."],
["Celtrix","celtrix-os/Celtrix",["React","Next.js","MongoDB","MySQL","Supabase"],"Joe Celaster","A modern web-app scaffolder: set up full-stack web applications in seconds with your preferred technologies."],
["HostelHub","Rahilshah2234/hostelhub",["MySQL"],"RAHIL SHARIF SHAH","A web-based hostel management system."],
["WhatBreaks","WhatBreaks/WhatBreaks",["React","PostgreSQL"],"Aaradhy Chinche","Infrastructure impact analysis tool that helps engineering teams understand dependencies and identify what a change could affect."],
["Code A2Z","code-a2z/code-a2z",["React","Node.js","Express.js","NestJS","MongoDB"],"Avdhesh Varshney","An ecosystem built to empower developers: a space where ideas turn into collaborative code."],
["Nexus Ai","kushagra-163/nexus-ai",["React","Node.js","Express.js","MongoDB","Gemini API"],"Kushagra Vilas Vispute","AI career intelligence platform that analyses resumes and helps students and developers plan their next move."],
["Open UIX","purvachopade1665/open-uix",["React","Next.js","Node.js","Express.js","PostgreSQL"],"Purva Sinchan Chopade","Open-source UI component library with reusable components, templates and animations to build sites faster."],
["Cyrus","adityalenova/cyrus-ai",["PostgreSQL","React","Next.js","Node.js","Drizzle"],"aditya","A free developer hub that brings open-source programs, hackathons and AI agent skills into one place; NSoC contributors fix data and mobile layout bugs here."],
["51 Web Project","jaikaran109/51_Web_Projects",["React","Node.js","Express.js","MongoDB","Mongoose"],"Jai Karan Gupta","A collection of 51 beginner-friendly web development projects built with HTML, CSS and JavaScript."],
["Contribo","subhranshudash13-dotcom/Contribo",["React","Next.js","MongoDB","Node.js","Gemini API"],"Subhranshu Sekhar Dash","One-stop platform that helps developers accelerate their open-source careers by discovering organizations, projects and mentors."],
["Cradle","Facelessism/cradle",["React","Node.js"],"Bighna Raj Bhattamishra","A collection of mini projects and experiments."],
["Hiero-bot-py","AnthropicBots/hiero-bot-py",["FastAPI","MySQL"],"Bhuvansh","A FastAPI-based GitHub automation tool used to maintain open-source projects, approved by the GitHub marketplace."],
["Codrawithm","KanishJebaMathewM/Codrawithm",["React","Next.js","Vue.js","FastAPI","MySQL"],"L Madhesh","An open-source visual workspace for drawing diagrams, exploring algorithms and visualising data structures."],
["Truxify","KanishJebaMathewM/Truxify",["Node.js","Express.js","PostgreSQL","FastAPI","Redis"],"Kanish Jeba Mathew M","A broker-free freight marketplace connecting manufacturers directly to truck drivers across India's national highway network."],
["Bibble","anshika-guleria/bibble",["Next.js","Prisma"],"Anshika Guleria","A cozy online table for learning: bring whatever you are curious about and learn with other people."],
["Next-Gen Skillforge","divyanshakya966/Next-Gen-Skillforge",["Next.js","React"],"Divyansh Shakya","AI career dashboard that reads public profile links and resumes, extracts skill signals and generates role-fit insights."],
["NotesMesh","tejask011/NotesMesh-",["React","Node.js","Express.js","MySQL","Gemini API"],"Tejas Kulkarni","Local-first knowledge workspace combining Markdown notes, linked knowledge graphs and interactive visual canvases."],
["SafeScan AI","suhani1711/safe-scan-ai-secure",["React"],"Suhani Chauhan","Security tool that detects phishing links, scam messages, suspicious emails and malicious QR codes."],
["AgentWatch","Shinraya-Tech-Labs/AgentWatch",["React"],"shaurya sanyal","A pre-execution guardrail for AI agents that audits reasoning and tool parameters before they run."],
["Vocab Deck","PIYUSH-NEXTGEN/Vocab-Deck",["FastAPI","Node.js","React"],"Piyush Baraskar","Vocabulary practice app with four interactive study modes, a React frontend and a FastAPI backend."],
["Launchly","simplyvardaan/Launchly",["Next.js","PostgreSQL","Supabase","Firebase","React"],"Vardaan Saxena","Open-source toolkit that helps makers and indie developers bring ideas to life and launch products faster."],
["Rexial","TheCodeHeist-Coder/Rexial",["React","Next.js","Node.js","Express.js","FastAPI"],"Raj Kumar","Real-time quiz platform: host a live quiz, share a code, watch the leaderboard move as people answer."],
["VoiceForge","Itzzavdheshh/VoiceForge",["React","Node.js","PostgreSQL","Hugging Face","Ollama"],"Avdhesh Kumar Dadhich","Browser-based assistive video tool: type during calls and output cloned speech with a lip-synced face preview."],
["PRISM","HeapifyGlobalCommunityy/Heapify_Deck_Evaluator",["React","FastAPI","PostgreSQL","Gemini API"],"Rohan Chand M","AI-assisted judging platform that evaluates hackathon and pitch decks against event-specific rubrics."],
["Image Processing Service","KhushiB03/Image---Processing---Service",["React","Express.js","Node.js","MongoDB"],"Khushi Bhardwaj","Full-stack image service with authentication, uploads and transformations built on Cloudinary and Sharp."],
["Inyon","Abhash-Chakraborty/inyon",["Tauri","React","Node.js"],"Abhash Chakraborty","Watch, answer and steer Claude Code, Codex, Gemini CLI, OpenCode and Copilot running in tmux on your own machines."],
["Cloud Loop","Ayushh-Sharmaa/Cloud-Loop",["PostgreSQL","Supabase","FastAPI"],"Ayush sharma","Technology community and opportunity-discovery platform for internships, jobs, hackathons and open-source programs."],
["Faultplane","devloperdevesh/FaultPlane",["React","Next.js","FastAPI"],"Devesh Chauhan","Bare-metal Go systems runtime for execution-state checkpoints and non-invasive network routing in multi-tenant clusters."],
["VidMentor","mitali-gautam05/VidMentor",["FastAPI"],"MITALI GAUTAM","Chrome extension that answers questions about a YouTube video, grounded only in that video's transcript."],
["RaktSetu","saisiddi/raktsetu",["React","Next.js","Node.js","NestJS","Supabase"],"Kalmadi Saisiddi","Privacy-first blood donor and recipient platform: nearby blood banks, donation camps and verified urgent requests."],
["Notes-app-compose","utkarsh006/Notes-app-compose",["Flutter"],"UTKARSH SAXENA","A simple, intuitive notes application for creating, managing and organising notes on mobile."],
["Deepfake Voice Analysis","vanshi18s/End-to-End-Deepfake-Voice-Analysis-and-Fraud-Prevention-Framework",["FastAPI","Next.js","MongoDB","Gemini API"],"Vanshi Sethi","Full-stack AI framework to detect synthetic audio and prevent voice-cloning fraud."],
["Open Agents","DivyashreeR008/Open-Agents",["React","Next.js","FastAPI","Supabase","OpenAI API"],"Divya Shree R","Intelligent AI agents that collaborate, automate tasks and streamline workflows."],
["glassD","vallabhatech/glassD",["Next.js","React"],"Harivallabha Sai Surishetty","Open-source galaxy: explore software ecosystems through an interactive 3D graph."],
["AI-dev-assistant","imDarshanGK/AI-dev-assistant",["Node.js"],"Darshan G K","AI code analysis with bug detection, explanations and suggestions."],
["ArcadeVerse","DebasmitaBose0/ArcadeVerse",["React"],"Debasmita Bose","Beginner-friendly, high-performance web arcade station built for the NSoC Winter Edition."],
["svant","Haripriyagupta/Svant",["FastAPI"],"Haripriya Gupta","Local-first project intelligence tool to search, understand and navigate codebases, docs and configuration."],
["Dalal Street AI","InderjotSingh17/Dalal-Street-AI",["Django","FastAPI","PostgreSQL","Gemini API"],"Inderjot Singh","AI stock-market learning platform that teaches investing through realistic simulation and feedback."],
["RELIEF","SohamMondal88/RELIEF",["React","Gemini API","Firebase","PostgreSQL","FastAPI"],"SOHAM MONDAL","Practical, accessible and reliable open-source solutions for real-world challenges."],
["QuestHabit","kumudasrip/QuestHabit",["React"],"Kumuda Sri Padmanabhuni","Frontend-only gamified habit tracker: earn XP, build streaks and unlock achievements."],
["Intellmeet","aashnaachaudhary10/Intellmeet",["React","Node.js","FastAPI","PostgreSQL","Prisma"],"Aashana Chaudhary","Real-time collaboration platform with video, messaging, live transcription and AI meeting summaries."],
["QuickPDF","JhaSourav07/QuickPDF",["React","Next.js"],"Sourav Jha","Privacy-first, zero-backend web app for merging and splitting PDFs directly in the browser."],
["VirtualUI","shrutisgh/VirtualUi",["React","Next.js","Node.js","Express.js","FastAPI"],"Shruti Singh","Describe a UI component and get code snippets or live previews powered by AI."],
["Vector social media","Shivayan09/Vector-social-media",["React","Node.js","Express.js","Next.js","Redis"],"Shivayan Chakravarty","A context-first social media platform."],
["Speakable website","Alokgupta07-tech/SpeakAble-Website",["Express.js","FastAPI","Supabase","React","Node.js"],"Alok Kumar","AI sign-language-to-speech platform that turns hand gestures into real-time text and speech using a camera."],
["Wharf","FrostByte-49/Wharf",["React","Node.js","Express.js","PostgreSQL","Redis"],"Pranav Khalate","AI documentation platform that connects to GitHub to analyse, document and maintain complex codebases."],
["AI Money Mentor","omroy07/AI-Money-Mentor",["React","MongoDB","MySQL","FastAPI","Gemini API"],"Om Roy","Personalized financial planning, tax optimization and investment insights in real time."],
["task-manager-website","qwerty274/taskmanager-nsoc2",["MongoDB","Node.js","Express.js"],"Manprabhnoor Kaur","Task manager and productivity dashboard built with HTML, CSS, JavaScript and Chart.js."],
["OpenPrep AI","nishit546/OpenPrep-AI",["React","Express.js","PostgreSQL","Node.js","Gemini API"],"Nishit","AI exam-prep workspace that analyses notes and past papers, schedules study plans and uses spaced repetition."],
["LinkID","vishnukothakapu/linkid",["React","Next.js","PostgreSQL","Prisma"],"Vishnu Kothakapu","One professional identity for all of a developer's online profiles."],
["OpenSc0ut","TanCodeX/OpenSc0ut",["React","Next.js","Node.js","Gemini API"],"Tanmay Patwary","GitHub repository discovery platform with advanced search and location-based filtering."],
["Odyssey","aaliya1719/Odyssey",["React","Next.js","Supabase","Gemini API"],"Aaliya Shaikh","Turns scattered thoughts, goals and tasks into clear, actionable missions."],
["Winter Research Desk","CoderOggy78/winter-research-desk",["Node.js","Gemini API","OpenAI API"],"Vishwanath Barve","Workspace that helps Indian undergraduates systematically prepare for research internships."],
["Storinary","anurag3407/storinary",["React","Next.js","Express.js","Node.js","PostgreSQL"],"Anurag Mishra","Free alternative to Cloudinary providing a CDN and media hosting at a much lower cost."],
["CampussCompass","arpit2006/CampussCompass",["Node.js","Express.js","PostgreSQL"],"Arpit Shirbhate","Helps students plan their academic and career journey with personalized learning roadmaps."],
["Sorobanpay","chrisland58/sorobanpay",["Gemini API","Node.js","React"],"Chinechrem Christian Nnakenyi","Non-custodial subscription and recurring payments protocol built on Stellar Soroban."],
["Root-Claim","Abhi666-max/Root-Claim",["Next.js","FastAPI","Supabase","OpenAI API"],"Abhijeet Tukaram Kangane","AI ecosystem built for the Ministry of Ayush to protect traditional knowledge against bio-piracy."],
["Prismio","prismio-lang/prismio",["Next.js"],"Saksham Jaiswal","A systems programming language built with LLVM that pairs native performance with expressive syntax."],
["LostLink-AI","Tech4Aditya/LostLink-AI",["Next.js","Gemini API","OpenAI API","PostgreSQL","MySQL"],"Aditya","Lost and found matching platform built around multimodal retrieval and privacy-first ownership verification."],
["Advanced Discord Bot","AdvancedDiscordBot/Advanced-Discord-Bot",["Node.js","Express.js","MongoDB","Mongoose","Gemini API"],"Golla Bharath","Self-hosted, plugin-first Discord bot platform: a framework that becomes whatever your server needs."],
["TrendAuroa2","ByProductify/TrendAuroa2",["Next.js","React","Express.js","Supabase","Gemini API"],"Aastha Malviya","AI assistant on the Gemini API that delivers weekly tech-trend updates for AI, Cloud and Firebase."],
["PatchPilot","ionfwsrijan/PatchPilot",["React","Vue.js","FastAPI","MySQL","Prisma"],"Srijan Jaiswal","Fully local automated code security triage with Semgrep and OSV-Scanner on a ZIP or GitHub URL."],
["Pathfinder AI","harshdwivediiiii/pathfinder-ai",["React","Next.js","Supabase","Prisma","Drizzle"],"Harshvardhan Dwivedi","AI-native career platform for students and developers navigating the job market."],
["Website vulnerability scanner","AvantikaI/web-vulnerability-scanner",["FastAPI","Gemini API","React Native","React","Next.js"],"Avantika Chauhan","Browser-based scanner for XSS, SQL injection and broken links with risk analysis and PDF reports."],
["Rhythma","ishita2740/Rhythma",["Firebase","Gemini API","OpenAI API","FastAPI","React"],"Ishita Manish Rathi","Multilingual AI women's health companion for menstrual cycles, symptoms, mood and sleep."],
["CAREERFORGE","Pratyush-Panda-2006/CAREERFORGE",["React","Node.js","Supabase"],"Pratyush Panda","Bridges technical learning and production software engineering through isolated single-repository projects."],
["DevTrack","VarshithReddy2006/DevTrack",["React","Node.js","Express.js","MongoDB","Redis"],"Shavva Varshith Reddy","Developer productivity and career readiness: DSA tracking, projects, resume intelligence and gamification."],
["NyayLens","Jagriti-student/NyayLens",["FastAPI","React","Gemini API"],"Jagriti","AI legal document assistant that finds obligations and timelines, compares documents and builds checklists."],
["OpenStudio","cu-sanjay/OpenStudio",["React","MongoDB","Next.js","Hugging Face"],"Sanjay Choudhary","Curated collection of beginner-friendly HTML, CSS and JavaScript projects built by the community."],
["Contribution Atelier","nandinigoyaldev/Open-Source-Contribution-Atelier",["React","Django","Hugging Face","PostgreSQL"],"Nandini goyal","Open-source learning platform that takes beginners from zero to their first real contribution."],
["OpenSourceMate","Muskankr/OpenSourceMate",["React","Next.js","FastAPI"],"Muskan Kumari","Analyses GitHub profiles, identifies skills and surfaces relevant open-source opportunities."],
["Type Rush","SandeepVashishtha/TypeRush",["Next.js","React","Express.js","Node.js"],"Sandeep Vashishtha","Arcade typing-racing game built on the Next.js App Router and HTML5 Canvas."],
["Civic Help Setu","GoldRay19/Civic-Help-Setu",["React","Firebase","Gemini API","FastAPI"],"Esha Jha","Civic-tech platform that makes government and public-service information easier to understand."],
["Trustlayer-AI","sabeenaviklar/TrustLayer-AI",["Mongoose","React","Express.js","Hugging Face","FastAPI"],"Sabeena Viklar","AI safety platform that validates whether generated answers are grounded in reference documents."],
["Tenet AI","TENET-DEV-AI/TENET-AI",["PostgreSQL","FastAPI","Vue.js","Redis"],"Savio Dsouza","AI-driven cybersecurity system that ingests events, scores risk with ML models and blocks threats."],
["Mental_Health_Chatbot","mahi0097/Mental_Health_Chatbot",["React","Next.js","Node.js","Express.js","MySQL"],"Mahi Sharma","MindFul, an AI mental-health support chatbot that provides empathetic conversational assistance."],
["Tracelens","sanjaysaini383/observability-platform",["React","Next.js","Node.js","Express.js","Redis"],"Sanjay Kumar Saini","Observability platform on OpenTelemetry, Kafka and ClickHouse with distributed tracing."],
["Campulsy","saitejx/Campulsy",["React"],"Sai Teja","Students discover, share and access internships, hackathons and opportunities in one place."],
["PulseMark","Khushi1310-nayak/PulseMark",["Next.js","Prisma","Redis","PostgreSQL","Supabase"],"Manisa Nayak","Smart market watchlist and event-driven temporal change engine for active traders."],
["ggnmem","gagansokhal-coder/Terminal_helper",["Hugging Face"],"Gagandeep","Local-first terminal history engine in Rust that indexes and semantically searches shell commands."],
["LexiRAG","pmandalegend1/LexiRAG",["Gemini API","OpenAI API","LangChain","MySQL","FastAPI"],"Parijat Mandal","Search tool that finds specific clauses and case laws buried inside large legal PDFs."],
["DL-Simplified","abhisheks008/DL-Simplified",["OpenAI API","React"],"Abhishek Sharma","Open-source hub that helps developers master deep learning from scratch."],
];

/* one GitHub call per repository: real stars, language, license, open issues */
function gh(repo) {
  try {
    return JSON.parse(execFileSync("gh", ["api", `repos/${repo}`], { encoding: "utf8", maxBuffer: 8 << 20 }));
  } catch { return null; }
}

const projects = [];
const orgs = {};
let missing = 0;
DIRECTORY.forEach(([title, repo, techs, admin, blurb], i) => {
  const r = gh(repo);
  if (!r || !r.full_name) { missing++; console.error(`dropped (no such repository): ${repo}`); return; }
  const owner = r.owner?.login ?? repo.split("/")[0];
  const tt = [...new Set([...techs, ...(r.topics ?? []).slice(0, 4)])].slice(0, 8);
  projects.push({
    y: 2026,
    u: `nsoc-${i + 1}`,
    t: r.description ? title : title,
    o: owner,
    s: "NSoC Winter Edition 2026",
    tt,
    tp: techs,
    b: (r.description || blurb).trim(),
    m: admin,
    url: r.html_url,
    program: "NSOC",
    stars: r.stargazers_count ?? 0,
    lang: r.language ?? "Other",
    license: r.license?.spdx_id ?? "Unknown",
  });
  orgs[owner] = { url: r.homepage || `https://github.com/${owner}`, category: r.type ?? "", n: (orgs[owner]?.n ?? 0) + 1 };
  process.stdout.write(`.`);
});

const out = {
  program: "NSOC",
  label: "Nexus Spring of Code",
  source: SOURCE,
  readAt: READ_AT,
  note: "Project titles, repositories, technology chips, project admins and blurbs were read from the live NSoC directory on the date above; stars, language and license came from the GitHub API on the same run. Repositories that no longer resolve are not in this file.",
  projects: projects.length,
  orgs,
  list: projects,
};

writeFileSync("public/data/program-projects/nsoc.json", JSON.stringify(out));
console.log(`\nprogram-projects/nsoc.json: ${projects.length} projects from ${DIRECTORY.length} directory rows (${missing} unresolvable)`);
