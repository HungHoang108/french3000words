/**
 * French 3000 application controller.
 * Responsibilities: state, study sessions, page rendering, browser persistence, and event handlers.
 */
import { loadImportedWords, mountFrequencyImport } from "./frequency-import.js";

let words;
try {
  const response = await fetch(new URL("./vocabulary.json", import.meta.url));
  if (!response.ok) throw new Error(`Vocabulary request failed with status ${response.status}`);
  const vocabulary = await response.json();
  const fields = ["fr", "en", "pos", "level", "cat", "example", "example_fr"];
  if (!Array.isArray(vocabulary) || vocabulary.some((word) => !word || fields.some((field) => typeof word[field] !== "string"))) {
    throw new Error("Vocabulary JSON must be an array of complete word entries");
  }
  words = vocabulary.map((word, i) => ({ ...word, id: i + 1, status: "new" }));
} catch (error) {
  console.error("Could not load starter vocabulary.", error);
  document.getElementById("main").textContent =
    "The vocabulary could not be loaded. Run this app from a local web server and check js/vocabulary.json.";
  throw error;
}
// --- Persistence and application state ---
const STORE = "french3000-preview-v1";
let state = load();
let page = "dashboard",
  session = null,
  toastTimer = null;
function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || "{}");
    return {
      progress: x.progress || {},
      sessions: x.sessions || [],
      settings: { autoAudio: true, speedAudio: false, limit: 3, daily: 15, ...x.settings },
      activity: x.activity || {},
      streak: x.streak || 0,
      lastStudy: x.lastStudy || "",
    };
  } catch (e) {
    return {
      progress: {},
      sessions: [],
      settings: { autoAudio: true, speedAudio: false, limit: 3, daily: 15 },
      activity: {},
      streak: 0,
      lastStudy: "",
    };
  }
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch (e) {
    showToast("Could not save to browser storage. Export a backup.");
  }
  updateTop();
}
function updateTop() {
  document.getElementById("streakTop").textContent = state.streak || 0;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function statFor(w) {
  return state.progress[w.id] || { status: "new", attempts: 0, correct: 0, wrong: 0, streak: 0, interval: 0, due: 0, seen: 0 };
}
function counts() {
  let learned = 0,
    mastered = 0,
    due = 0,
    attempts = 0,
    correct = 0;
  words.forEach((w) => {
    const p = statFor(w);
    if (p.status !== "new") learned++;
    if (p.status === "mastered") mastered++;
    if (p.status !== "new" && p.due <= Date.now()) due++;
    attempts += p.attempts || 0;
    correct += p.correct || 0;
  });
  return { learned, mastered, due, attempts, correct, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
}
function markStudy() {
  const d = new Date().toISOString().slice(0, 10);
  state.activity[d] = (state.activity[d] || 0) + 1;
  if (state.lastStudy !== d) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak = state.lastStudy === y ? (state.streak || 0) + 1 : 1;
    state.lastStudy = d;
  }
  save();
}
function showToast(s) {
  let t = document.querySelector(".toast");
  if (t) t.remove();
  t = document.createElement("div");
  t.className = "toast";
  t.textContent = s;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2300);
}
function speak(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Speech synthesis is not available in this browser.");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 0.88;
  const vs = speechSynthesis.getVoices();
  const v = vs.find((v) => v.lang.toLowerCase().startsWith("fr-fr")) || vs.find((v) => v.lang.toLowerCase().startsWith("fr"));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function go(p) {
  stopSession();
  page = p;
  render();
}
document.getElementById("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-page]");
  if (!b) return;
  go(b.dataset.page);
});
function setActive() {
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
}
function render() {
  setActive();
  updateTop();
  const m = document.getElementById("main");
  if (page === "dashboard") m.innerHTML = dashboard();
  else if (["learn", "review", "speed"].includes(page)) {
    m.innerHTML = studyIntro(page);
  } else if (page === "library") m.innerHTML = library();
  else if (page === "difficult") m.innerHTML = difficultWordsPage();
  else if (page === "history") m.innerHTML = historyPage();
  else if (page === "settings") m.innerHTML = settingsPage();
  bindPage();
  mountFrequencyImport(words, { onImport: render, showToast });
}
function dashboard() {
  const c = counts(),
    recent = state.sessions.slice(0, 5),
    daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const k = d.toISOString().slice(0, 10);
      return { day: d.toLocaleDateString("en", { weekday: "short" }), n: state.activity[k] || 0, today: i === 6 };
    });
  const max = Math.max(1, ...daily.map((d) => d.n));
  return `<div class="hero"><div><div class="eyebrow">YOUR FRENCH JOURNEY</div><h1 class="page-title">Bonjour, learner.</h1><p class="subhead">A little practice today. A more fluent you tomorrow.</p></div><div class="date-label">${new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</div></div>
<div class="stats"><div class="stat"><div class="stat-top">Words learned <span class="stat-icon">✳</span></div><div class="stat-num">${c.learned}<span style="font-size:14px;color:#8b9188;font-weight:500"> / ${words.length}</span></div><div class="stat-foot">${Math.round((c.learned / words.length) * 100)}% of this starter set</div></div><div class="stat"><div class="stat-top">Mastered <span class="stat-icon">✦</span></div><div class="stat-num">${c.mastered}</div><div class="stat-foot">Strong recall, repeated over time</div></div><div class="stat"><div class="stat-top">Due to review <span class="stat-icon">↻</span></div><div class="stat-num">${c.due}</div><div class="stat-foot">Keep your memory fresh</div></div><div class="stat"><div class="stat-top">Accuracy <span class="stat-icon">◎</span></div><div class="stat-num">${c.accuracy}%</div><div class="stat-foot">${c.attempts} answers recorded</div></div></div>
<div class="section-head"><h2>Choose your session</h2><button class="text-link" data-go="library">Explore vocabulary ↗</button></div><div class="study-grid"><div class="feature-card primary"><div class="feature-kicker">01 / Build your base</div><h3>Learn something new.</h3><p>Meet useful French words with meanings, examples, and pronunciation.</p><button class="btn btn-light" data-go="learn">Start learning <span>→</span></button><div class="decor"></div></div><div class="feature-card secondary"><div class="feature-kicker">02 / Quick recall</div><h3>Three seconds. One answer.</h3><p>Train your recognition with a quick-fire round. No overthinking.</p><button class="btn btn-dark" data-go="speed">Start speed review <span>ϟ</span></button><div class="decor"></div></div></div>
<div class="bottom-grid"><div class="panel"><div class="section-head"><h3>Vocabulary path</h3><span class="small-tag">Starter set</span></div><div class="muted">Work through useful words, from foundations to conversation.</div><div class="level-list">${[
    "A1",
    "A2",
    "B1",
  ]
    .map((lv, i) => {
      const n = words.filter((w) => w.level === lv).length,
        done = words.filter((w) => w.level === lv && statFor(w).status === "mastered").length;
      return `<div class="level-row"><div class="level-pill">${lv}</div><div><div class="level-name">${["Foundations", "Everyday confidence", "More nuanced French"][i]}</div><div class="level-meta">${done} of ${n} mastered</div><div class="progress-track"><div class="progress-fill" style="width:${n ? (done / n) * 100 : 0}%"></div></div></div><div class="level-percent">${n ? Math.round((done / n) * 100) : 0}%</div></div>`;
    })
    .join(
      "",
    )}</div></div><div class="panel activity"><div class="section-head"><h3>Your activity</h3><span class="small-tag">Last 7 days</span></div><div class="muted">Each session is a step forward.</div><div class="week">${daily.map((d) => `<div class="day"><div class="bar-wrap"><div class="bar ${d.today ? "today" : ""}" style="height:${Math.max(5, (d.n / max) * 78)}px;opacity:${d.n ? 1 : 0.55}"></div></div><div>${d.n}</div><div class="day-label">${d.day}</div></div>`).join("")}</div><div class="muted" style="margin-top:20px">${recent.length ? `Last session: ${new Date(recent[0].date).toLocaleDateString()} · ${recent[0].accuracy}% accuracy` : "Your first session is waiting for you."}</div></div></div>`;
}
function studyIntro(mode) {
  const cfg = {
    learn: {
      eyebrow: "BUILD YOUR VOCABULARY",
      title: "Learn new words.",
      desc: "Small batches, clear meanings, and examples that help the words stick.",
      button: "Begin learning",
      note: "New words are introduced in sets of 10.",
    },
    review: {
      eyebrow: "STRENGTHEN YOUR MEMORY",
      title: "Review what you know.",
      desc: "Practice words that are due, plus words that need a little more attention.",
      button: "Start review",
      note: `${counts().due} words are currently due for review.`,
    },
    speed: {
      eyebrow: "QUICK-FIRE PRACTICE",
      title: "Trust your first instinct.",
      desc: "Choose the right meaning before the timer runs out. Three seconds max per word.",
      button: "Start speed round",
      note: "20 questions · 3 seconds each · no long explanations.",
    },
  }[mode];
  return `<div class="study-shell"><div class="eyebrow">${cfg.eyebrow}</div><h1 class="page-title">${cfg.title}</h1><p class="subhead">${cfg.desc}</p><div class="question-card" style="text-align:left;padding:28px"><div class="word-label">YOUR SESSION</div><h2 style="font-family:var(--site-font-heading);font-size:28px;font-weight:500;margin:12px 0">${mode === "learn" ? "Discover the next useful words" : mode === "review" ? "Bring your French back to mind" : "A little pressure, a lot of progress"}</h2><p style="font-size:13px;line-height:1.7;color:var(--muted);margin-bottom:20px">${cfg.note}</p><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><label style="font-size:12px;color:var(--muted)">Questions <select id="sessionLength" class="field" style="margin-left:6px"><option value="10">10</option><option value="20" ${mode === "speed" ? "selected" : ""}>20</option><option value="50">50</option></select></label><button class="btn btn-dark" id="startSession">${cfg.button} →</button></div></div><p style="font-size:11px;color:var(--muted);margin-top:15px">Your progress is saved automatically in this browser.</p></div>`;
}
function toggleMaster(w) {
  if (!w) return;
  const p = statFor(w);
  p.status = p.status === "mastered" ? "learning" : "mastered";
  if (p.status === "mastered") {
    p.masteredAt = Date.now();
    p.interval = Math.max(p.interval || 0, 30);
    p.due = Date.now() + 30 * 86400000;
  } else {
    delete p.masteredAt;
    p.due = Date.now();
  }
  state.progress[w.id] = p;
  save();
  const masterButton = document.getElementById("masterWord");
  if (masterButton) masterButton.textContent = p.status === "mastered" ? "★ Mark as not mastered" : "☆ Mark as mastered";
  if (session && (session.mode === "learn" || session.mode === "speed") && p.status === "mastered") {
    session.queue = session.queue.filter((item, i) => i <= session.index || item.id !== w.id);
    if (session.index >= session.queue.length) {
      session.index = session.queue.length - 1;
    }
  }
  showToast(
    p.status === "mastered"
      ? "Word marked mastered. Skipped in future Learn and Speed Review sessions."
      : "Word returned to learning.",
  );
}
function toggleDifficult(w) {
  if (!w) return;
  const p = statFor(w);
  p.difficult = !p.difficult;
  state.progress[w.id] = p;
  save();
  const difficultButton = document.getElementById("difficultWord");
  if (difficultButton) {
    difficultButton.textContent = p.difficult ? "⚑ Remove from difficult" : "⚑ Mark as difficult";
  }
  showToast(p.difficult ? "Word added to Difficult Words." : "Word removed from Difficult Words.");
}
function feminineAdjective(word) {
  if (/e$/i.test(word)) return word;
  if (/eux$/i.test(word)) return word.replace(/eux$/i, "euse");
  if (/if$/i.test(word)) return word.replace(/if$/i, "ive");
  if (/er$/i.test(word)) return word.replace(/er$/i, "ère");
  if (/ien$/i.test(word)) return word.replace(/ien$/i, "ienne");
  if (/on$/i.test(word)) return word + "ne";
  if (/el$/i.test(word)) return word + "le";
  return word + "e";
}
function teachingCard(w) {
  let tip = "",
    meaning = w.en.split(",")[0];
  if (w.pos === "noun") {
    const article = (w.fr.match(/^(le|la|l’|l'|les)\s*/i) || [])[1] || "";
    tip =
      article === "le"
        ? "Masculine noun: learn it together with “le”."
        : article === "la"
          ? "Feminine noun: learn it together with “la”."
          : article.toLowerCase().startsWith("l")
            ? "Elision: “le” or “la” becomes “l’” before a vowel or silent h."
            : "Learn every noun with its article; gender affects articles and related adjectives.";
  } else if (w.pos === "adjective") {
    const masc = w.fr.split(" ")[0],
      fem = feminineAdjective(masc);
    tip =
      "Adjectives usually agree with the noun: masculine singular “" +
      masc +
      "”, feminine singular “" +
      fem +
      "”. This is a regular-form estimate; some adjectives are irregular.";
  } else if (w.pos === "verb") {
    tip =
      "For the near future, use the conjugated verb “aller” + an infinitive: “je vais” + verb. Pronominal verbs need the matching pronoun.";
  } else if (w.pos === "preposition") {
    tip = "Prepositions connect ideas and often need to be learned in a phrase, because the best translation depends on context.";
  } else {
    tip = "Learn this word inside a natural phrase. Word order and meaning can change with context.";
  }
  return (
    '<div class="teaching"><div class="teaching-title">Example in context</div><div class="teaching-fr"><span class="teaching-language">French</span>' +
    esc(w.example_fr) +
    '</div><div class="teaching-en"><span class="teaching-language">English</span>' +
    esc(w.example) +
    '</div><div class="teaching-meaning">Meaning to remember: ' +
    esc(meaning) +
    '</div><div class="grammar-tip"><strong>Grammar tip</strong><br>' +
    esc(tip) +
    "</div></div>"
  );
}
function makeQueue(mode, n) {
  let pool = words.filter((w) => {
    const p = statFor(w);
    if (mode === "difficult") return p.difficult === true;
    if (p.status === "mastered") return mode === "review" && p.due <= Date.now();
    if (mode === "learn") return p.status === "new" || p.status === "learning";
    if (mode === "review") return p.status !== "new" && p.due <= Date.now();
    if (mode === "speed") return p.status !== "mastered";
    return true;
  });
  if (mode === "review" && pool.length === 0) pool = words.filter((w) => statFor(w).status !== "new");
  if (mode === "learn") {
    const learning = pool
      .filter((w) => statFor(w).status === "learning")
      .sort((a, b) => (statFor(a).streak || 0) - (statFor(b).streak || 0));
    const fresh = pool.filter((w) => statFor(w).status === "new").sort((a, b) => a.id - b.id);
    const mixed = [];
    while (mixed.length < n && (learning.length || fresh.length)) {
      if (learning.length) mixed.push(learning.shift());
      if (fresh.length && mixed.length < n) mixed.push(fresh.shift());
    }
    return mixed;
  }
  pool.sort((a, b) => {
    const pa = statFor(a),
      pb = statFor(b);
    if (mode === "review") return (pa.due || 0) - (pb.due || 0) || (pa.streak || 0) - (pb.streak || 0);
    if (mode === "speed") return (pa.streak || 0) - (pb.streak || 0) || Math.random() - 0.5;
    return a.id - b.id;
  });
  return pool.slice(0, n);
}
// --- Study session flow ---
function beginSession(mode, n) {
  const q = makeQueue(mode, n);
  if (!q.length) {
    showToast("No words available for this session yet.");
    return;
  }
  session = {
    mode,
    queue: q,
    index: 0,
    correct: 0,
    wrong: 0,
    timeout: 0,
    answered: false,
    started: Date.now(),
    timer: null,
    feedbackTimer: null,
  };
  renderQuestion();
}
function stopSession() {
  if (session) {
    clearTimeout(session.timer);
    clearTimeout(session.feedbackTimer);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    session = null;
  }
}
function renderQuestion() {
  if (!session) return;
  clearTimeout(session.timer);
  clearTimeout(session.feedbackTimer);
  const s = session,
    w = s.queue[s.index];
  if (!w) {
    finishSession();
    return;
  }
  s.answered = false;
  const p = statFor(w),
    choices = makeChoices(w);
  s.choices = choices;
  const main = document.getElementById("main");
  main.innerHTML = `<div class="study-shell${s.mode === "learn" ? " study-shell--teaching" : ""}"><div class="study-top"><button class="back-btn" id="exitSession">← Exit session</button><span class="session-meta">${s.index + 1} of ${s.queue.length}</span><span class="small-tag">${s.mode === "speed" ? "ϟ SPEED" : s.mode === "learn" ? "LEARN" : s.mode === "difficult" ? "DIFFICULT WORDS" : "REVIEW"}</span></div><div class="session-progress"><div style="width:${(s.index / s.queue.length) * 100}%"></div></div><div class="question-card${s.mode === "learn" ? " has-teaching" : ""}"><div class="question-main"><div class="word-label">FRENCH VOCABULARY</div><div class="word">${esc(w.fr)}</div><div class="word-sub">${w.pos === "noun" ? "Noun · learn the article" : w.level + " · " + w.pos}</div><button class="speaker" id="speakWord" aria-label="Play French pronunciation">🔊</button><div class="question">Choose the correct English meaning</div><div class="timer-wrap ${s.mode === "speed" ? "show" : ""}" id="timerWrap"><div class="timer-bar" id="timerBar"></div></div><div class="answers">${choices.map((a, i) => `<button class="answer" data-answer="${i}"><span class="key">${i + 1}</span><span>${esc(a.en)}</span></button>`).join("")}</div>${s.mode !== "learn" ? '<div class="feedback" id="feedback" aria-live="polite"></div>' : ""}<div class="master-control"><button class="btn btn-outline" id="masterWord">${p.status === "mastered" ? "★ Mark as not mastered" : "☆ Mark as mastered"}</button><button class="btn btn-outline" id="difficultWord">${p.difficult ? "⚑ Remove from difficult" : "⚑ Mark as difficult"}</button><span>Mastered words are skipped in Learn and Speed Review.</span></div><div class="speed-label ${s.mode === "speed" ? "show" : ""}">${s.mode === "speed" ? "Answer in " + state.settings.limit + " seconds" : ""}</div></div>${s.mode === "learn" ? '<div class="feedback" id="feedback" aria-live="polite"></div>' : ""}</div><div class="session-footer"><span>${s.mode === "learn" ? "Take your time and learn the word." : s.mode === "review" ? "Recall helps your memory grow." : s.mode === "difficult" ? "Focused practice for words you find challenging." : "Go with your first instinct."}</span><span>${s.correct} correct · ${s.wrong + s.timeout} missed</span></div></div>`;
  document.getElementById("exitSession").onclick = () => {
    stopSession();
    render();
  };
  document.getElementById("speakWord").onclick = () => speak(w.fr);
  document.getElementById("masterWord").onclick = () => toggleMaster(w);
  document.getElementById("difficultWord").onclick = () => toggleDifficult(w);
  document.querySelectorAll("[data-answer]").forEach((b) => (b.onclick = () => answer(Number(b.dataset.answer))));
  if (state.settings.autoAudio && (s.mode !== "speed" || state.settings.speedAudio)) speak(w.fr);
  if (s.mode === "speed") startTimer();
}
function makeChoices(w) {
  const same = words.filter((x) => x.id !== w.id && x.en !== w.en);
  const pool = same.filter((x) => x.level === w.level);
  const distractors = [];
  while (distractors.length < 3) {
    const source = pool.length ? pool : same;
    const pick = source[Math.floor(Math.random() * source.length)];
    if (pick && !distractors.some((x) => x.en === pick.en)) distractors.push(pick);
  }
  return [w, ...distractors].sort(() => Math.random() - 0.5);
}
function startTimer() {
  const s = session;
  const bar = document.getElementById("timerBar");
  if (!bar) return;
  const duration = state.settings.limit * 1000,
    start = performance.now();
  function tick(now) {
    if (!session || session !== s || s.answered) return;
    const remain = Math.max(0, 1 - (now - start) / duration);
    bar.style.transform = `scaleX(${remain})`;
    if (remain <= 0) {
      answer(-1, true);
      return;
    }
    s.timer = requestAnimationFrame(tick);
  }
  s.timer = requestAnimationFrame(tick);
}
function answer(index, timeout = false) {
  const s = session;
  if (!s || s.answered) return;
  s.answered = true;
  clearTimeout(s.timer);
  if (s.mode === "speed" && typeof s.timer === "number") cancelAnimationFrame(s.timer);
  const w = s.queue[s.index],
    p = statFor(w),
    good = !timeout && s.choices[index]?.id === w.id;
  p.attempts = (p.attempts || 0) + 1;
  p.seen = (p.seen || 0) + 1;
  if (good) {
    p.correct = (p.correct || 0) + 1;
    p.streak = (p.streak || 0) + 1;
    s.correct++;
    if (p.status !== "mastered") {
      p.status = "learning";
      p.interval = p.streak === 1 ? 1 : p.streak === 2 ? 3 : 5;
    }
    p.due = Date.now() + (p.interval || 1) * 86400000;
  } else {
    p.wrong = (p.wrong || 0) + 1;
    p.streak = 0;
    if (p.status !== "mastered") p.status = "learning";
    p.interval = 0;
    p.due = Date.now() + 10 * 60 * 1000;
    if (timeout) s.timeout++;
    else s.wrong++;
  }
  state.progress[w.id] = p;
  markStudy();
  const buttons = [...document.querySelectorAll("[data-answer]")];
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (s.choices[i].id === w.id) b.classList.add("correct");
    else if (i === index && !good) b.classList.add("wrong");
  });
  const fb = document.getElementById("feedback");
  fb.classList.add("show");
  if (s.mode === "learn") document.querySelector(".question-card").classList.add("is-answered");
  const teaching = s.mode === "learn" ? teachingCard(w) : "";
  fb.innerHTML =
    (timeout
      ? `Time's up. The answer is <strong>${esc(w.en)}</strong>.`
      : good
        ? `Correct! <strong>${esc(w.fr)}</strong> means <strong>${esc(w.en)}</strong>.`
        : `Not quite. <strong>${esc(w.fr)}</strong> means <strong>${esc(w.en)}</strong>.`) + teaching;
  const foot = document.querySelector(".session-footer span:last-child");
  if (foot) foot.textContent = `${s.correct} correct · ${s.wrong + s.timeout} missed`;
  if (s.mode === "speed") {
    s.feedbackTimer = setTimeout(() => {
      if (session === s) {
        s.index++;
        renderQuestion();
      }
    }, 480);
  } else {
    const next = document.createElement("button");
    next.className = "btn btn-dark";
    next.style.marginTop = "14px";
    next.textContent = s.index === s.queue.length - 1 ? "Finish session" : "Next word →";
    fb.appendChild(document.createElement("br"));
    fb.appendChild(next);
    next.onclick = () => {
      s.index++;
      renderQuestion();
    };
  }
  save();
}
function finishSession() {
  const s = session;
  state.sessions.unshift({
    date: new Date().toISOString(),
    mode: s.mode,
    total: s.queue.length,
    correct: s.correct,
    wrong: s.wrong,
    timeout: s.timeout,
    accuracy: Math.round((s.correct / s.queue.length) * 100),
    duration: Math.round((Date.now() - s.started) / 1000),
  });
  state.sessions = state.sessions.slice(0, 100);
  save();
  session = null;
  const m = document.getElementById("main");
  m.innerHTML = `<div class="study-shell"><div class="question-card complete"><div class="complete-mark">✓</div><div class="eyebrow">SESSION COMPLETE</div><h2>Très bien.</h2><p class="subhead">Every word you practice is a step toward fluency.</p><div class="result-grid"><div class="result-stat"><b>${s.correct}</b><span>Correct</span></div><div class="result-stat"><b>${s.wrong}</b><span>Incorrect</span></div><div class="result-stat"><b>${s.timeout}</b><span>Timed out</span></div></div><p style="font-size:13px;color:var(--muted)">${Math.round((s.correct / s.queue.length) * 100)}% accuracy · ${s.queue.length} questions · ${Math.max(1, Math.round((Date.now() - s.started) / 60000))} min</p><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:22px"><button class="btn btn-dark" id="again">Practice again →</button><button class="btn btn-outline" id="home">Dashboard</button></div></div></div>`;
  document.getElementById("again").onclick = () => {
    page = s.mode;
    render();
  };
  document.getElementById("home").onclick = () => {
    page = "dashboard";
    render();
  };
}
function library() {
  return `<div class="eyebrow">YOUR PERSONAL DICTIONARY</div><h1 class="page-title">Word library.</h1><p class="subhead">Explore vocabulary, search meanings, and mark words mastered or difficult when you feel ready.</p><div class="notice">This preview still contains a starter dataset, not the complete 3,000-word collection. Mastered words are excluded from Learn and Speed Review.</div><div class="toolbar"><input id="searchWords" class="field search" placeholder="Search French or English…"><select id="filterLevel" class="field"><option value="all">All levels</option><option>A1</option><option>A2</option><option>B1</option></select><select id="filterStatus" class="field"><option value="all">All statuses</option><option value="new">New</option><option value="learning">Learning</option><option value="mastered">Mastered</option></select></div><div class="table-wrap"><table class="word-table"><thead><tr><th>French</th><th>English</th><th>Level</th><th>Status</th><th>Mastery</th><th>Difficulty</th><th>Audio</th></tr></thead><tbody id="wordRows"></tbody></table></div><div class="muted" id="wordCount" style="margin-top:12px;font-size:11px"></div>`;
}
function difficultWordsPage() {
  const difficultCount = words.filter((word) => statFor(word).difficult).length;
  return `<div class="eyebrow">FOCUSED PRACTICE</div><h1 class="page-title">Difficult words.</h1><p class="subhead">Keep the words you find challenging together, then practice them as a focused session.</p><div class="section-head"><h2>${difficultCount} ${difficultCount === 1 ? "word" : "words"} to work on</h2><button class="btn btn-dark" id="practiceDifficult" ${difficultCount ? "" : "disabled"}>Practice difficult words →</button></div><div class="table-wrap"><table class="word-table"><thead><tr><th>French</th><th>English</th><th>Level</th><th>Actions</th></tr></thead><tbody id="difficultRows"></tbody></table></div><div class="muted" style="margin-top:12px;font-size:11px">Use “Mark as difficult” while studying or from the Word Library to add words here.</div>`;
}
function drawRows() {
  const q = (document.getElementById("searchWords")?.value || "").toLowerCase().trim(),
    lv = document.getElementById("filterLevel")?.value || "all",
    st = document.getElementById("filterStatus")?.value || "all";
  const list = words.filter(
    (w) =>
      (!q || w.fr.toLowerCase().includes(q) || w.en.toLowerCase().includes(q)) &&
      (lv === "all" || w.level === lv) &&
      (st === "all" || statFor(w).status === st),
  );
  document.getElementById("wordRows").innerHTML =
    list
      .slice(0, 120)
      .map(
        (w) =>
          `<tr><td><div class="fr-cell">${esc(w.fr)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(w.pos)}</div></td><td class="en-cell">${esc(w.en)}</td><td><span class="small-tag">${w.level}</span></td><td style="color:var(--muted)">${statFor(w).status}${statFor(w).difficult ? " · difficult" : ""}</td><td><button class="text-link" data-master="${w.id}">${statFor(w).status === "mastered" ? "★ Unmaster" : "☆ Mark mastered"}</button></td><td><button class="text-link" data-difficult="${w.id}">${statFor(w).difficult ? "⚑ Remove" : "⚑ Mark difficult"}</button></td><td><button class="text-link" data-speak="${w.id}">🔊 Play</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="7" class="empty">No words match your search.</td></tr>';
  document.getElementById("wordCount").textContent =
    `Showing ${Math.min(list.length, 120)} of ${list.length} matching words · ${words.length} words in this starter set`;
  document
    .querySelectorAll("[data-speak]")
    .forEach((b) => (b.onclick = () => speak(words.find((w) => w.id === Number(b.dataset.speak)).fr)));
  document.querySelectorAll("[data-master]").forEach(
    (b) =>
      (b.onclick = () => {
        toggleMaster(words.find((w) => w.id === Number(b.dataset.master)));
        drawRows();
      }),
  );
  document.querySelectorAll("[data-difficult]").forEach(
    (b) =>
      (b.onclick = () => {
        toggleDifficult(words.find((w) => w.id === Number(b.dataset.difficult)));
        drawRows();
      }),
  );
}
function drawDifficultRows() {
  const list = words.filter((word) => statFor(word).difficult);
  document.getElementById("difficultRows").innerHTML =
    list
      .map(
        (word) =>
          `<tr><td><div class="fr-cell">${esc(word.fr)}</div><div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(word.pos)}</div></td><td class="en-cell">${esc(word.en)}</td><td><span class="small-tag">${word.level}</span></td><td><button class="text-link" data-speak-difficult="${word.id}">🔊 Play</button> <button class="text-link" data-remove-difficult="${word.id}">Remove</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="4" class="empty">No difficult words yet. Mark words while studying or in the Word Library.</td></tr>';
  document.querySelectorAll("[data-speak-difficult]").forEach(
    (button) =>
      (button.onclick = () => speak(words.find((word) => word.id === Number(button.dataset.speakDifficult)).fr)),
  );
  document.querySelectorAll("[data-remove-difficult]").forEach(
    (button) =>
      (button.onclick = () => {
        toggleDifficult(words.find((word) => word.id === Number(button.dataset.removeDifficult)));
        render();
      }),
  );
}
function historyPage() {
  return `<div class="eyebrow">YOUR LEARNING RECORD</div><h1 class="page-title">History & progress.</h1><p class="subhead">A record of your practice, kept right here in this browser.</p><div class="stats"><div class="stat"><div class="stat-top">Sessions <span>◷</span></div><div class="stat-num">${state.sessions.length}</div></div><div class="stat"><div class="stat-top">Questions answered <span>✳</span></div><div class="stat-num">${counts().attempts}</div></div><div class="stat"><div class="stat-top">Overall accuracy <span>◎</span></div><div class="stat-num">${counts().accuracy}%</div></div><div class="stat"><div class="stat-top">Current streak <span>✦</span></div><div class="stat-num">${state.streak}</div></div></div><div class="panel"><h3>Recent sessions</h3><div class="muted">Your latest study activity appears here.</div><div style="margin-top:15px">${
    state.sessions.length
      ? state.sessions
          .slice(0, 30)
          .map(
            (s) =>
              `<div class="history-row"><span><strong>${s.mode === "speed" ? "Speed review" : s.mode === "learn" ? "Learn new words" : s.mode === "difficult" ? "Difficult words" : "Standard review"}</strong><br><span style="font-size:10px;color:var(--muted)">${new Date(s.date).toLocaleString()} · ${s.duration}s</span></span><span>${s.total} questions</span><span>${s.accuracy}%</span><span>${s.correct} correct</span></div>`,
          )
          .join("")
      : '<div class="empty">No sessions yet. Your first practice will show up here.</div>'
  }</div></div>`;
}
function settingsPage() {
  return `<div class="eyebrow">MAKE IT YOURS</div><h1 class="page-title">Settings.</h1><p class="subhead">Tune your sessions to fit your learning rhythm.</p><div class="panel"><div class="settings-list"><div class="setting-row"><div><strong>Automatic pronunciation</strong><p>Speak each French word when a card appears.</p></div><input type="checkbox" class="switch" id="autoAudio" ${state.settings.autoAudio ? "checked" : ""}></div><div class="setting-row"><div><strong>Audio during speed review</strong><p>Audio can take longer than the three-second answer window.</p></div><input type="checkbox" class="switch" id="speedAudio" ${state.settings.speedAudio ? "checked" : ""}></div><div class="setting-row"><div><strong>Speed review timer</strong><p>Maximum time to answer each question.</p></div><select class="field" id="speedLimit"><option value="1" ${state.settings.limit === 1 ? "selected" : ""}>1 second</option><option value="2" ${state.settings.limit === 2 ? "selected" : ""}>2 seconds</option><option value="3" ${state.settings.limit === 3 ? "selected" : ""}>3 seconds</option></select></div><div class="setting-row"><div><strong>Daily new-word target</strong><p>Choose a manageable goal to build consistency.</p></div><select class="field" id="dailyTarget"><option value="5" ${state.settings.daily === 5 ? "selected" : ""}>5 words</option><option value="10" ${state.settings.daily === 10 ? "selected" : ""}>10 words</option><option value="15" ${state.settings.daily === 15 ? "selected" : ""}>15 words</option><option value="20" ${state.settings.daily === 20 ? "selected" : ""}>20 words</option><option value="30" ${state.settings.daily === 30 ? "selected" : ""}>30 words</option></select></div></div></div><div class="panel" style="margin-top:16px"><h3>Backup & data</h3><p class="muted">Progress is stored in this browser only. Export a backup to move it to another device.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn btn-dark" id="exportData">Export progress JSON ↓</button><label class="btn btn-outline" for="importFile">Import backup ↑</label><input type="file" id="importFile" accept="application/json,.json" class="hidden"><button class="btn btn-outline" id="resetData" style="color:#a34238">Reset progress</button></div><p style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:18px">No account or backend is used. Clearing browser data may erase your progress, so keep a backup. Audio quality depends on the French voice available on your device.</p></div>`;
}
// --- Event wiring and settings ---
function bindPage() {
  document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  if (["learn", "review", "speed"].includes(page)) {
    const b = document.getElementById("startSession");
    if (b) b.onclick = () => beginSession(page, Number(document.getElementById("sessionLength").value));
  }
  if (page === "difficult") {
    document.getElementById("practiceDifficult").onclick = () => beginSession("difficult", words.length);
    drawDifficultRows();
  }
  if (page === "library") {
    ["searchWords", "filterLevel", "filterStatus"].forEach((id) =>
      document.getElementById(id).addEventListener(id === "searchWords" ? "input" : "change", drawRows),
    );
    drawRows();
  }
  if (page === "settings") {
    document.getElementById("autoAudio").onchange = (e) => {
      state.settings.autoAudio = e.target.checked;
      save();
    };
    document.getElementById("speedAudio").onchange = (e) => {
      state.settings.speedAudio = e.target.checked;
      save();
    };
    document.getElementById("speedLimit").onchange = (e) => {
      state.settings.limit = Number(e.target.value);
      save();
    };
    document.getElementById("dailyTarget").onchange = (e) => {
      state.settings.daily = Number(e.target.value);
      save();
    };
    document.getElementById("exportData").onclick = exportData;
    document.getElementById("importFile").onchange = importData;
    document.getElementById("resetData").onclick = () => {
      if (
        confirm("Reset all learning progress and history in this browser? This cannot be undone unless you exported a backup.")
      ) {
        state = {
          progress: {},
          sessions: [],
          settings: { autoAudio: true, speedAudio: false, limit: 3, daily: 15 },
          activity: {},
          streak: 0,
          lastStudy: "",
        };
        save();
        render();
        showToast("Progress reset. Fresh start!");
      }
    };
  }
}
function exportData() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          progress: state.progress,
          sessions: state.sessions,
          settings: state.settings,
          activity: state.activity,
          streak: state.streak,
          lastStudy: state.lastStudy,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "french3000-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Progress backup exported.");
}
function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      if (!x || x.version !== 1 || typeof x.progress !== "object" || !Array.isArray(x.sessions))
        throw new Error("Invalid backup");
      if (!confirm("Import this backup and replace current progress?")) return;
      state = {
        progress: x.progress,
        sessions: x.sessions,
        settings: { autoAudio: true, speedAudio: false, limit: 3, daily: 15, ...x.settings },
        activity: x.activity || {},
        streak: x.streak || 0,
        lastStudy: x.lastStudy || "",
      };
      save();
      render();
      showToast("Backup imported successfully.");
    } catch (err) {
      showToast("Could not import this file. Check that it is a French 3000 backup.");
    }
    e.target.value = "";
  };
  r.readAsText(f);
}
document.addEventListener("keydown", (e) => {
  if (!session || session.answered) return;
  if (["1", "2", "3", "4"].includes(e.key)) {
    const b = document.querySelector(`[data-answer="${Number(e.key) - 1}"]`);
    if (b) b.click();
  }
});
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};
loadImportedWords(words, showToast);
render();
