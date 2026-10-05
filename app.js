// ─── i18n Runtime (English inline, other languages lazily loaded) ───
// English text lives inline in index.html, so English renders with zero JS,
// zero network requests and zero string-table parsing. The data-i18n*
// attributes only MARK the swap points for the Marathi toggle (Bucket 6):
//   <h1 data-i18n="hero.title">Defeating the Silent Pandemic</h1>
//   <img data-i18n-attr="alt:hero.image.alt" alt="AMR illustration">
//   <p data-i18n-html="hero.note">text with <strong>inline markup</strong></p>
// This is the runtime only — the toggle UI itself is Bucket 6.
const I18N = { lang: 'en', strings: null };

const I18N_LANG_KEY = 'act4amr_lang';
const I18N_SELECTOR = '[data-i18n], [data-i18n-html], [data-i18n-attr]';
const I18N_LOADED = {};                // lang -> string table, once its file has run
const I18N_ORIGINALS = new WeakMap();  // element -> its original English content
const I18N_EN = {};                    // key -> original English text, for t() fallback

// A translation file is a plain script that calls:
//   registerStrings('mr', { 'hero.title': '...' });
function registerStrings(lang, strings) {
  if (lang && strings) I18N_LOADED[lang] = strings;
}

// Own-property check, so keys like "constructor" can't leak Object.prototype
// values. A key also only counts as translated when it holds a NON-EMPTY string:
// that lets strings.mr.js ship half-finished, with untranslated entries sitting
// as '' and the English simply staying put, instead of blanking those elements.
function i18nHas(obj, key) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) return false;
  const value = obj[key];
  return typeof value === 'string' && value.trim() !== '';
}

// data-i18n-attr="alt:hero.image.alt" — comma/semicolon separated for several attrs
function parseI18nAttrPairs(el) {
  const raw = el.getAttribute('data-i18n-attr');
  if (!raw) return [];
  return raw.split(/[;,]/).map(part => {
    const bits = part.split(':');
    return { attr: (bits[0] || '').trim(), key: (bits[1] || '').trim() };
  }).filter(pair => pair.attr && pair.key);
}

// Cache the inline English once, before the first translation overwrites it
function cacheI18nOriginals() {
  document.querySelectorAll(I18N_SELECTOR).forEach(el => {
    if (I18N_ORIGINALS.has(el)) return;

    const original = { text: el.textContent, html: el.innerHTML, attrs: {} };
    parseI18nAttrPairs(el).forEach(pair => {
      original.attrs[pair.attr] = el.getAttribute(pair.attr);
    });
    I18N_ORIGINALS.set(el, original);

    const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-html');
    if (key && !i18nHas(I18N_EN, key)) I18N_EN[key] = original.text;
  });
}

// Replace an element's own text without touching its child elements. Ten
// translated elements wrap an SVG icon or a .pulse-dot, and el.textContent = …
// would delete those children, so only the text nodes are rewritten.
function setI18nText(el, value) {
  const textNodes = Array.from(el.childNodes).filter(node => node.nodeType === 3);
  const filled = textNodes.filter(node => node.nodeValue.trim());

  if (filled.length) {
    filled[0].nodeValue = value;
    filled.slice(1).forEach(node => { node.nodeValue = ''; });
  } else if (textNodes.length) {
    textNodes[0].nodeValue = value;
  } else {
    el.appendChild(document.createTextNode(value));
  }
}

// Swap in the active language; keys with no translation keep their English
function applyI18n() {
  const strings = I18N.strings;
  document.querySelectorAll(I18N_SELECTOR).forEach(el => {
    const textKey = el.getAttribute('data-i18n');
    if (textKey && i18nHas(strings, textKey)) setI18nText(el, strings[textKey]);

    const htmlKey = el.getAttribute('data-i18n-html');
    if (htmlKey && i18nHas(strings, htmlKey)) el.innerHTML = strings[htmlKey];

    parseI18nAttrPairs(el).forEach(pair => {
      if (i18nHas(strings, pair.key)) el.setAttribute(pair.attr, strings[pair.key]);
    });
  });
}

// Put the cached inline English back
function restoreI18nOriginals() {
  document.querySelectorAll(I18N_SELECTOR).forEach(el => {
    const original = I18N_ORIGINALS.get(el);
    if (!original) return;

    // Restore from the cached markup, not textContent — the same child-element
    // problem setI18nText avoids applies in reverse on the way back to English.
    if (el.hasAttribute('data-i18n-html') || el.hasAttribute('data-i18n')) {
      el.innerHTML = original.html;
    }

    Object.keys(original.attrs).forEach(attr => {
      if (original.attrs[attr] === null) el.removeAttribute(attr);
      else el.setAttribute(attr, original.attrs[attr]);
    });
  });
}

// Lazily inject strings.<lang>.js — a script tag, not fetch, so it also works from file://
function loadStringsFile(lang) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `strings.${lang}.js`;
    script.async = true;
    script.setAttribute('data-i18n-lang', lang);
    script.onload = () => resolve(I18N_LOADED[lang] || null);
    script.onerror = () => reject(new Error(`Missing strings.${lang}.js`));
    document.head.appendChild(script);
  });
}

// localStorage can throw in private mode — never let a preference break the page
function rememberLang(lang) {
  try { localStorage.setItem(I18N_LANG_KEY, lang); } catch (e) { /* ignore */ }
}
function readRememberedLang() {
  try { return localStorage.getItem(I18N_LANG_KEY); } catch (e) { return null; }
}

// ─── Image language swap ─────────────────────────────────────────────────────
// Reads data-src-{lang} from any <img> element (e.g. #journey-img, About AMR cards)
// and updates its src attribute. Falls back to data-src-en.
function updateLanguageImages(lang) {
  const targetLang = lang || I18N.lang || 'en';
  document.querySelectorAll('img[data-src-en]').forEach(function (img) {
    const src = img.getAttribute('data-src-' + targetLang) || img.getAttribute('data-src-en');
    if (src && img.getAttribute('src') !== src) {
      img.src = src;
    }
  });
}

function updateJourneyImage(lang) {
  updateLanguageImages(lang);
}

async function setLanguage(lang) {
  if (!lang || lang === I18N.lang) return;

  // Back to English: restore inline text, load nothing
  if (lang === 'en') {
    restoreI18nOriginals();
    I18N.lang = 'en';
    I18N.strings = null;
    rememberLang('en');
    document.documentElement.setAttribute('lang', 'en');
    updateLanguageImages('en');
    return;
  }

  // Nothing marked for translation yet — no-op, and no pointless request
  if (!document.querySelector(I18N_SELECTOR)) return;

  let strings = I18N_LOADED[lang];
  if (!strings) {
    try {
      strings = await loadStringsFile(lang);
    } catch (err) {
      console.warn(`[i18n] ${err.message} — staying in ${I18N.lang}`);
      return;
    }
  }
  if (!strings) return;

  cacheI18nOriginals();
  I18N.strings = strings;
  I18N.lang = lang;
  applyI18n();
  rememberLang(lang);
  document.documentElement.setAttribute('lang', lang);
  updateLanguageImages(lang);
}

// Current translation for a key, falling back to the cached inline English
function t(key) {
  if (i18nHas(I18N.strings, key)) return I18N.strings[key];
  if (i18nHas(I18N_EN, key)) return I18N_EN[key];
  const el = document.querySelector(`[data-i18n="${key}"], [data-i18n-html="${key}"]`);
  return el ? el.textContent : key;
}

// Re-apply a remembered non-English choice. English (the default) does nothing.
document.addEventListener('DOMContentLoaded', () => {
  const saved = readRememberedLang();
  if (saved && saved !== 'en') {
    setLanguage(saved);
  } else {
    updateLanguageImages('en');
  }
});

// ─── Language toggle ─────────────────────────────────────────────────────────
function syncLangToggle() {
  const buttons = document.querySelectorAll('.lang-btn');
  buttons.forEach(function (btn) {
    const on = btn.getAttribute('data-lang') === I18N.lang;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// setLanguage resolves whether or not the strings file loaded, and rejects
// nothing — so the toggle is re-synced either way and can never be left showing
// a language the page is not actually in.
function switchLang(lang) {
  Promise.resolve(setLanguage(lang)).then(syncLangToggle, syncLangToggle);
}

document.addEventListener('DOMContentLoaded', syncLangToggle);

// Make i18n globally accessible (the toggle calls these from an inline onclick)
window.switchLang = switchLang;
window.setLanguage = setLanguage;
window.registerStrings = registerStrings;
window.t = t;
window.I18N = I18N;


// ─── Pledge counter ──────────────────────────────────────────────────────────
// PASTE YOUR DEPLOYED ENDPOINT URL HERE. See tools/pledge-counter.gs for the
// backend and the two-minute deploy steps.
//
// Leave it as '' and the counter simply does not appear — the pledge still
// works exactly as before. That is the deliberate default: an unreachable or
// unconfigured backend must never produce a number, because a wrong or stale
// figure under government and partner branding is worse than no figure.
//
// The request fires ONLY when somebody pledges, never on page load, so the page
// still makes zero third-party requests for an ordinary visitor. Nothing
// personal is sent — the call carries no name, no identifier and no analytics.
const PLEDGE_COUNTER_URL = 'https://script.google.com/macros/s/AKfycbxMAkBgfhD47rOBERGpEYhVeqY3Q4byo401V_8KTyK_tMNqgTv7br5Ov5rCS_noIeM7KA/exec';

// Ask the backend to record this pledge and return the new total.
// Resolves to a number, or null if the counter is off or unreachable.
function recordPledge() {
  if (!PLEDGE_COUNTER_URL) return Promise.resolve(null);
  if (typeof fetch !== 'function') return Promise.resolve(null);

  // Never let a slow endpoint hold the confirmation hostage.
  const timeout = new Promise(function (resolve) {
    window.setTimeout(function () { resolve(null); }, 6000);
  });

  const request = fetch(PLEDGE_COUNTER_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script handles poorly
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'pledge' })
  })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      const n = data && Number(data.count);
      return Number.isFinite(n) && n >= 0 ? n : null;
    })
    .catch(function () { return null; });   // offline, blocked, CORS — all the same here

  return Promise.race([request, timeout]);
}

// Count up to the real total. Never invents intermediate precision: it walks
// toward the true number and lands exactly on it.
function showPledgeCount(total) {
  const wrap = document.getElementById('pledgeCount');
  const value = document.getElementById('pledgeCountValue');
  if (!wrap || !value || total === null) return;

  wrap.hidden = false;

  const final = total.toLocaleString('en-IN');

  // The true figure is painted immediately and is forced again by a timer below.
  // The count-up is decoration layered on top of an already-correct display —
  // never the thing responsible for producing it. Testing showed both failure
  // modes this guards against: an unclamped frame timestamp undershooting to
  // 12,445, and a stalled rAF leaving the display parked at 12,447, for a true
  // 12,487. A counter that reads low is still a wrong number.
  value.textContent = final;
  if (pledgeReducedMotion()) return;

  const DURATION = 900;
  const start = performance.now();
  const from = Math.max(0, total - Math.min(total, 40));
  let settled = false;

  function settle() {
    if (settled) return;
    settled = true;
    value.textContent = final;
  }

  function step(now) {
    if (settled) return;
    const p = Math.min(1, Math.max(0, (now - start) / DURATION));
    const eased = 1 - Math.pow(1 - p, 3);
    value.textContent = Math.round(from + (total - from) * eased).toLocaleString('en-IN');
    if (p < 1) window.requestAnimationFrame(step);
    else settle();
  }

  window.requestAnimationFrame(step);
  // Hard backstop: however the animation behaves or fails to behave, the real
  // number is on screen by the time this fires.
  window.setTimeout(settle, DURATION + 150);
}

// 1-Click Pledge Action — a personal commitment
let hasSwachhPledged = false;

function pledgeReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function takeSwachhPledge() {
  if (hasSwachhPledged) return;
  hasSwachhPledged = true;

  const btn = document.getElementById('btn-swachh-pledge');
  const done = document.getElementById('pledgeDone');
  const items = document.querySelectorAll('#pledgeCommitments .pledge-commitment');

  // The four promises tick in sequence. With no counter and nothing recorded,
  // this sequence IS the confirmation — it is the whole payoff of the tap.
  const step = pledgeReducedMotion() ? 0 : 220;
  items.forEach(function (item, i) {
    if (!step) { item.classList.add('is-kept'); return; }
    window.setTimeout(function () { item.classList.add('is-kept'); }, i * step);
  });

  if (btn) {
    btn.classList.add('pledged');
    btn.disabled = true;
    const label = btn.querySelector('.btn-text');
    // Retarget the i18n key and rewrite only the text, so the Marathi hook and
    // the arrow SVG both survive. Assigning innerHTML here would destroy both.
    if (label) {
      label.setAttribute('data-i18n', 'pledge.cta.done');
      label.textContent = 'Promise made';
    }
  }

  // Fire the counter request immediately, in parallel with the tick sequence,
  // so the network round trip hides behind the animation instead of following it.
  const counted = recordPledge();

  window.setTimeout(function () {
    if (!done) return;
    // Just unhide it. The CSS entrance is a keyframe that runs on its own, so
    // nothing here depends on requestAnimationFrame firing — if it did not, the
    // panel would sit invisible and the pledge would appear to do nothing.
    done.hidden = false;
    // null means the counter is off or unreachable: show nothing rather than a
    // number that might be wrong.
    counted.then(showPledgeCount);
  }, step * items.length + 120);
}

// Make functions globally accessible
window.takeSwachhPledge = takeSwachhPledge;


// Quiz Questions (8 Educational Questions)
const QUIZ_QUESTIONS = [
  {
    q: "What does AMR — antimicrobial resistance — actually mean?",
    options: [
      { text: "Your body becomes resistant to medicines", isCorrect: false },
      { text: "Germs change so antibiotics stop working against them", isCorrect: true },
      { text: "You become allergic to antibiotics", isCorrect: false },
      { text: "Antibiotics expire and lose strength", isCorrect: false }
    ],
    fact: "It's the germs — not you — that change. When bacteria survive antibiotics, those tougher germs spread and the medicine stops working."
  },
  {
    q: "You have a common cold or the flu. Will antibiotics help you recover?",
    options: [
      { text: "Yes, they speed up recovery", isCorrect: false },
      { text: "Yes, but only the strong ones", isCorrect: false },
      { text: "No — colds and flu are caused by viruses", isCorrect: true },
      { text: "Only if you take them for 3 days", isCorrect: false }
    ],
    fact: "Antibiotics fight bacteria, not viruses. Taking them for a cold or flu won't help and only fuels resistance."
  },
  {
    q: "Your doctor gave you a 5-day antibiotic course. You feel better on day 3. What should you do?",
    options: [
      { text: "Stop — you're already better", isCorrect: false },
      { text: "Save the rest for next time you're sick", isCorrect: false },
      { text: "Finish the full course as prescribed", isCorrect: true },
      { text: "Take a double dose to finish faster", isCorrect: false }
    ],
    fact: "Stopping early lets the stronger germs survive and come back tougher. Always finish exactly as your doctor prescribed."
  },
  {
    q: "You have leftover antibiotics at home. Where do they belong?",
    options: [
      { text: "Flush them down the toilet", isCorrect: false },
      { text: "Throw them loose in the household bin", isCorrect: false },
      { text: "Take them to a pharmacy or medicine take-back point", isCorrect: true },
      { text: "Keep them for emergencies", isCorrect: false }
    ],
    fact: "Safe take-back keeps medicines out of water and soil. Ask your pharmacist where you can return unused antibiotics."
  },
  {
    q: "Why is flushing medicines down the toilet or drain harmful?",
    options: [
      { text: "It clogs the pipes", isCorrect: false },
      { text: "Drugs reach rivers and soil, breeding resistant germs", isCorrect: true },
      { text: "It's actually a safe way to dispose of them", isCorrect: false },
      { text: "It wastes water", isCorrect: false }
    ],
    fact: "Flushed antibiotics enter water and soil, where they push germs to become resistant — affecting everyone downstream."
  },
  {
    q: "Your cousin has the same symptoms you had. Should you share your leftover antibiotics?",
    options: [
      { text: "Yes, it saves a doctor's visit", isCorrect: false },
      { text: "Yes, if it's the same illness", isCorrect: false },
      { text: "No — never share or self-prescribe antibiotics", isCorrect: true },
      { text: "Only half the dose to be safe", isCorrect: false }
    ],
    fact: "Same symptoms don't mean the same cause. Sharing antibiotics can be useless or harmful — always see a doctor."
  },
  {
    q: "You're unsure how to dispose of old medicines safely. Who's the best person to ask?",
    options: [
      { text: "A neighbour who takes the same pills", isCorrect: false },
      { text: "Your local pharmacist or healthcare worker", isCorrect: true },
      { text: "Social media groups", isCorrect: false },
      { text: "No one — just guess", isCorrect: false }
    ],
    fact: "Pharmacists and health workers are trained on safe disposal and take-back. They're your go-to source."
  },
  {
    q: "What's one simple everyday action that helps fight AMR?",
    options: [
      { text: "Take antibiotics whenever you feel slightly unwell", isCorrect: false },
      { text: "Demand antibiotics from every doctor visit", isCorrect: false },
      { text: "Only use antibiotics when a doctor prescribes them", isCorrect: true },
      { text: "Stockpile antibiotics at home", isCorrect: false }
    ],
    fact: "Using antibiotics only when truly needed — and only as prescribed — is the single biggest thing you can do."
  }
];


let currentQuizIndex = 0;
let quizScore = 0;
let optionSelected = false;

// DOM Load Setup
document.addEventListener("DOMContentLoaded", () => {
  initQuiz();
});



// Quiz Functions
function initQuiz() {
  currentQuizIndex = 0;
  quizScore = 0;
  optionSelected = false;

  document.getElementById('quizResults').style.display = 'none';
  document.getElementById('quiz-question-box').style.display = 'block';

  loadQuizQuestion();
}

function loadQuizQuestion() {
  optionSelected = false;
  document.getElementById('quizNavBtn').style.display = 'none';
  document.getElementById('quizFeedback').style.display = 'none';

  const qObj = QUIZ_QUESTIONS[currentQuizIndex];
  const progressPercent = ((currentQuizIndex + 1) / QUIZ_QUESTIONS.length) * 100;
  document.getElementById('quizProgress').style.width = `${progressPercent}%`;

  const curNum = document.getElementById('currentQuestionNum');
  if (curNum) curNum.innerText = currentQuizIndex + 1;
  const totNum = document.getElementById('totalQuestionsNum');
  if (totNum) totNum.innerText = QUIZ_QUESTIONS.length;

  const scoreElem = document.getElementById('quizScore');
  if (scoreElem) scoreElem.innerText = quizScore;
  const totMax = document.getElementById('totalQuizMax');
  if (totMax) totMax.innerText = QUIZ_QUESTIONS.length;

  document.getElementById('questionText').innerText = qObj.q;

  const optionsBox = document.getElementById('optionsBox');
  optionsBox.innerHTML = '';

  qObj.options.forEach((opt, idx) => {
    const optBtn = document.createElement('button');
    optBtn.className = 'quiz-option';
    optBtn.innerHTML = `
      <span class="option-indicator">${String.fromCharCode(65 + idx)}</span>
      <span>${escapeHTML(opt.text)}</span>
    `;
    optBtn.onclick = () => selectOption(optBtn, opt.isCorrect, qObj.fact);
    optionsBox.appendChild(optBtn);
  });
}

function selectOption(btnElement, isCorrect, fact) {
  if (optionSelected) return;
  optionSelected = true;

  const options = document.querySelectorAll('.quiz-option');
  const feedback = document.getElementById('quizFeedback');

  if (isCorrect) {
    btnElement.classList.add('correct');
    quizScore += 1;
    document.getElementById('quizScore').innerText = quizScore;

    feedback.className = 'quiz-feedback success';
    feedback.style.display = 'block';
    feedback.innerHTML = `<strong style="color: #065f46; display: block; margin-bottom: 0.25rem;">Correct!</strong> ${escapeHTML(fact)}`;
  } else {
    btnElement.classList.add('incorrect');

    const qObj = QUIZ_QUESTIONS[currentQuizIndex];
    const correctIdx = qObj.options.findIndex(o => o.isCorrect);
    if (correctIdx !== -1) {
      options[correctIdx].classList.add('correct');
    }

    feedback.className = 'quiz-feedback error';
    feedback.style.display = 'block';
    feedback.innerHTML = `<strong style="color: #991b1b; display: block; margin-bottom: 0.25rem;">Good to know</strong> ${escapeHTML(fact)}`;
  }

  document.getElementById('quizNavBtn').style.display = 'inline-flex';
}

function nextQuestion() {
  currentQuizIndex += 1;
  if (currentQuizIndex < QUIZ_QUESTIONS.length) {
    loadQuizQuestion();
  } else {
    showQuizResults();
  }
}

function showQuizResults() {
  document.getElementById('quiz-question-box').style.display = 'none';
  const resultsDiv = document.getElementById('quizResults');
  resultsDiv.style.display = 'flex';
  resultsDiv.style.flexDirection = 'column';
  resultsDiv.style.alignItems = 'center';

  document.getElementById('scoreCircle').innerHTML = `${quizScore}/${QUIZ_QUESTIONS.length}<span>Score</span>`;

  const msg = document.getElementById('quizResultsMessage');
  const medal = document.getElementById('quizMedal');
  const tipsBox = document.getElementById('quizTipsBox');

  const pct = quizScore / QUIZ_QUESTIONS.length;
  let title = "";
  let badgeSvg = "";
  let messageText = "";
  let tips = [];

  if (pct >= 0.8) {
    badgeSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`;
    title = "AMR Champion!";
    messageText = "Brilliant! You really know your stuff. You're ready to spread the word and protect your community.";
    tips = [
      "Tell a friend: antibiotics don't work on colds or flu.",
      "Return unused medicines to a pharmacy take-back point.",
      "Never share or self-prescribe antibiotics."
    ];
  } else if (pct >= 0.5) {
    badgeSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#006857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    title = "AMR Aware";
    messageText = "Nice work — you've got a solid grip on the basics. Just a few gaps to close and you'll be a champion!";
    tips = [
      "Always finish your full antibiotic course as prescribed.",
      "Never flush medicines — use safe disposal instead.",
      "Ask your pharmacist about safe disposal."
    ];
  } else {
    badgeSvg = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#26a98b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
    title = "AMR Newcomer";
    messageText = "Great start! Every expert begins somewhere. Here are the key things worth remembering.";
    tips = [
      "Antibiotics fight bacteria — not colds, flu, or viruses.",
      "Only use antibiotics when a doctor prescribes them.",
      "Take leftover medicines to nearest health facility, never the bin or toilet."
    ];
  }

  if (medal) medal.innerHTML = badgeSvg;
  if (msg) {
    msg.innerHTML = `<strong style="font-size: 1.3rem; color: #0f172a; display: block; margin-bottom: 0.5rem;">${title}</strong><span style="font-size: 0.95rem; color: #475569;">${messageText}</span>`;
  }

  if (tipsBox) {
    tipsBox.innerHTML = `
      <div class="quiz-tips-container">
        <p class="tips-heading">Keep these key takeaways in mind:</p>
        <ul class="tips-list">
          ${tips.map(t => `<li><span class="tip-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> ${escapeHTML(t)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Record completion and show live count
  recordQuizCompletion().then(showQuizCompletionCount);
}


function restartQuiz() {
  // Reset completion counter display when quiz is retaken
  const countWrap = document.getElementById('quizCompletionCount');
  if (countWrap) countWrap.hidden = true;
  initQuiz();
}

// ─── Quiz completion counter ──────────────────────────────────────────────────
// Increments a localStorage counter immediately so the count always displays
// even without a server. Also posts to the Google Apps Script endpoint; if it
// returns { quiz_count: N } that authoritative figure overrides the local one.
var QUIZ_COMPLETIONS_KEY = 'dfh_quiz_completions';

function recordQuizCompletion() {
  // Always increment locally first
  var localCount = 1;
  try {
    localCount = parseInt(localStorage.getItem(QUIZ_COMPLETIONS_KEY) || '0', 10) + 1;
    localStorage.setItem(QUIZ_COMPLETIONS_KEY, String(localCount));
  } catch (e) { /* localStorage blocked: count from 1 */ }

  // Try server too; use local count as the fallback in every failure path
  if (!PLEDGE_COUNTER_URL || typeof fetch !== 'function') {
    return Promise.resolve(localCount);
  }

  var timeout = new Promise(function (resolve) {
    window.setTimeout(function () { resolve(localCount); }, 6000);
  });

  var request = fetch(PLEDGE_COUNTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'quiz_complete' })
  })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      var n = data && Number(data.quiz_count);
      return (Number.isFinite(n) && n >= 0) ? n : localCount;
    })
    .catch(function () { return localCount; });

  return Promise.race([request, timeout]);
}

function showQuizCompletionCount(total) {
  var wrap  = document.getElementById('quizCompletionCount');
  var value = document.getElementById('quizCompletionValue');
  // Guard: only hide if total is explicitly null/undefined (not 0)
  if (!wrap || !value || total == null) return;

  wrap.hidden = false;
  var final = Number(total).toLocaleString('en-IN');

  // If count is 1 or very small, skip the count-up animation
  if (total <= 1) { value.textContent = final; return; }

  var current = Math.max(0, total - Math.min(total, 60));
  function step() {
    current = Math.min(total, current + (Math.ceil((total - current) / 8) || 1));
    value.textContent = current.toLocaleString('en-IN');
    if (current < total) requestAnimationFrame(step);
    else value.textContent = final;
  }
  requestAnimationFrame(step);
}

// ─── Certificate Generation ───────────────────────────────────────────────────
// Cached data-URL written by drawCertCanvas; read by downloadCertificate / shareCertificate.
let _certDataUrl = null;

function openCertModal() {
  const modal = document.getElementById('certModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  // Return to form step each time the modal reopens
  document.getElementById('certFormStep').hidden = false;
  document.getElementById('certPreviewStep').hidden = true;
  window.setTimeout(function () {
    const inp = document.getElementById('certName');
    if (inp) inp.focus();
  }, 80);
}

function closeCertModal() {
  const modal = document.getElementById('certModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function backToCertForm() {
  document.getElementById('certFormStep').hidden = false;
  document.getElementById('certPreviewStep').hidden = true;
}

// Called by the Generate Certificate button
function buildCertificate() {
  const name = (document.getElementById('certName').value || '').trim();
  const city = (document.getElementById('certCity').value || '').trim();
  const errEl = document.getElementById('certFormError');

  if (!name || !city) {
    if (errEl) errEl.hidden = false;
    return;
  }
  if (errEl) errEl.hidden = true;

  // Flip to preview step
  document.getElementById('certFormStep').hidden = true;
  document.getElementById('certPreviewStep').hidden = false;

  // Scroll the modal dialog back to top so the user sees the preview header first
  var dialog = document.querySelector('.cert-modal-dialog');
  if (dialog) dialog.scrollTop = 0;

  // Show/hide share button based on Web Share API support
  var shareBtn = document.getElementById('certShareBtn');
  if (shareBtn) shareBtn.style.display = (typeof navigator.share === 'function') ? '' : 'none';

  // Show a quick "Generating…" placeholder on the canvas while the logo loads
  var canvas = document.getElementById('certCanvas');
  if (canvas) {
    canvas.width = 600; canvas.height = 424;
    var pCtx = canvas.getContext('2d');
    pCtx.fillStyle = '#f4faf8';
    pCtx.fillRect(0, 0, 600, 424);
    pCtx.fillStyle = '#006857';
    pCtx.font = 'bold 20px Arial, sans-serif';
    pCtx.textAlign = 'center';
    pCtx.fillText('Generating your certificate…', 300, 212);
  }

  // Load the campaign logo then draw the full certificate
  var logo = new Image();
  logo.onload  = function () { drawCertCanvas(name, city, logo); };
  logo.onerror = function () { drawCertCanvas(name, city, null); };
  logo.src = 'Main.png';
}


// ── Canvas renderer ────────────────────────────────────────────────────────────
function drawCertCanvas(name, city, logo) {
  var canvas = document.getElementById('certCanvas');
  if (!canvas) return;

  var W = 1200, H = 848;
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  // ── Palette ──
  var GREEN      = '#006857';
  var DARK_GREEN = '#00403a';
  var GOLD       = '#c9a227';
  var LIGHT_BG   = '#f4faf8';
  var TEXT_DARK  = '#1a2e24';
  var TEXT_MID   = '#3d5a4f';
  var TEXT_LIGHT = '#6b8a7e';

  // ── Background ──
  ctx.fillStyle = LIGHT_BG;
  ctx.fillRect(0, 0, W, H);

  // ── Outer green border ──
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);

  // ── Inner gold border ──
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  // ── Corner squares ──
  var cs = 12;
  ctx.fillStyle = GOLD;
  [[22,22],[W-22-cs,22],[22,H-22-cs],[W-22-cs,H-22-cs]].forEach(function(c){
    ctx.fillRect(c[0], c[1], cs, cs);
  });

  // ── Header gradient ──
  var headerH = 190;
  var grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, DARK_GREEN);
  grad.addColorStop(1, GREEN);
  ctx.fillStyle = grad;
  ctx.fillRect(7, 7, W - 14, headerH);

  // Campaign org line
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText('D I S P O S E F O R H E A L T H', W / 2, 50);
  ctx.letterSpacing = '';

  // Main title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Certificate of Pledge', W / 2, 118);

  // Gold rule under title
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W/2-200, 134); ctx.lineTo(W/2+200, 134); ctx.stroke();

  // Subtitle
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillText('Antimicrobial Resistance Awareness Campaign · Maharashtra', W / 2, 165);

  // ── Body: certifies that ──
  ctx.fillStyle = TEXT_MID;
  ctx.font = 'italic 23px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('This certifies that', W / 2, 245);

  // ── Name (auto-scale to fit) ──
  var fontSize = 68;
  ctx.font = 'bold ' + fontSize + 'px "Palatino Linotype", Palatino, Georgia, serif';
  while (ctx.measureText(name).width > W - 180 && fontSize > 30) {
    fontSize -= 2;
    ctx.font = 'bold ' + fontSize + 'px "Palatino Linotype", Palatino, Georgia, serif';
  }
  ctx.fillStyle = GREEN;
  ctx.textAlign = 'center';
  ctx.fillText(name, W / 2, 324);

  // Gold underline under name
  var nw = ctx.measureText(name).width;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W/2 - nw/2, 336); ctx.lineTo(W/2 + nw/2, 336); ctx.stroke();

  // ── City · Date ──
  var dateStr = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  ctx.fillStyle = TEXT_MID;
  ctx.font = '22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('from ' + city + '   \u00B7   ' + dateStr, W / 2, 376);

  // ── Has pledged to ──
  ctx.fillStyle = TEXT_DARK;
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillText('has solemnly pledged to:', W / 2, 418);

  // Light horizontal rule
  ctx.strokeStyle = 'rgba(0,104,87,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 433); ctx.lineTo(W-60, 433); ctx.stroke();

  // ── Commitment items ──
  var commitments = [
    'Take antibiotics only when prescribed by a qualified doctor',
    'Complete every antibiotic course, even when feeling better',
    'Never share medicines with any other person',
    'Return leftover antibiotics to the nearest health facility or disposal site'
  ];
  var lineH = 52, startY = 464, blockX = 130;

  commitments.forEach(function (text, i) {
    var y = startY + i * lineH;

    // Filled circle bullet
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.arc(blockX, y - 5, 14, 0, Math.PI * 2);
    ctx.fill();

    // Checkmark inside circle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(blockX - 5.5, y - 5);
    ctx.lineTo(blockX - 1.5, y);
    ctx.lineTo(blockX + 6, y - 9);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // Commitment text
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '18px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, blockX + 28, y + 1);
  });

  // ── Bottom separator ──
  ctx.strokeStyle = 'rgba(0,104,87,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 680); ctx.lineTo(W-60, 680); ctx.stroke();

  // ── Logo (Main.png) ──
  if (logo && logo.naturalWidth) {
    var maxLH = 72, maxLW = 220;
    var ratio = Math.min(maxLW / logo.naturalWidth, maxLH / logo.naturalHeight);
    var lW = logo.naturalWidth * ratio;
    var lH = logo.naturalHeight * ratio;
    ctx.drawImage(logo, 80, 694, lW, lH);
  }

  // Campaign attribution
  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = '13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DISPOSEFORHEALTH · Safe Antibiotic Disposal Campaign · Maharashtra', W / 2, 704);
  ctx.fillText('Supported by NHM, PATH, CHRI & GSK', W / 2, 723);

  // ── Seal (right side) ──
  var sx = W - 130, sy = 735;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(sx, sy, 76, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy, 64, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AMR', sx, sy - 14);
  ctx.fillText('PLEDGE', sx, sy + 3);
  ctx.fillText('TAKER', sx, sy + 20);

  // ── Cache data URL (wrapped in try-catch: canvas.toDataURL may throw if the
  //    canvas is "tainted" by a cross-origin image in stricter browser contexts) ──
  try {
    _certDataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[cert] toDataURL failed (tainted canvas?). Redrawing without logo.', e);
    // Redraw without the logo so the canvas is clean, then retry
    drawCertCanvas(name, city, null);
  }
}

function downloadCertificate() {
  var canvas = document.getElementById('certCanvas');
  if (!canvas) return;

  // Try to get a data URL from the canvas directly each time (more reliable than the
  // cached value; also refreshes if the canvas was redrawn without a logo)
  var dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    // Canvas tainted — redraw without logo then retry
    var nm = (document.getElementById('certName').value || '').trim();
    var ct = (document.getElementById('certCity').value || '').trim();
    drawCertCanvas(nm, ct, null);
    try { dataUrl = canvas.toDataURL('image/png'); } catch (e2) {
      console.warn('[cert] download failed — canvas still tainted', e2);
      return;
    }
  }

  var nameVal = ((document.getElementById('certName').value || 'certificate').trim()).replace(/\s+/g, '_');
  var a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'AMR_Pledge_Certificate_' + nameVal + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function shareCertificate() {
  if (typeof navigator.share !== 'function') return;
  var canvas = document.getElementById('certCanvas');
  if (!canvas) return;
  var nameVal = (document.getElementById('certName').value || '').trim();

  var shareText = nameVal
    ? nameVal + ' has pledged to fight Antimicrobial Resistance! #DisposeForHealth #AMRAwareness'
    : 'I have pledged to fight Antimicrobial Resistance! #DisposeForHealth #AMRAwareness';

  // Use canvas.toBlob() — avoids the data-URL intermediary and works in more contexts
  canvas.toBlob(function (blob) {
    if (!blob) {
      // Fallback: share URL only
      navigator.share({ title: 'My AMR Pledge Certificate', text: shareText, url: window.location.href })
        .catch(function (err) { if (err.name !== 'AbortError') console.warn('[cert] share failed', err); });
      return;
    }
    var file = new File([blob], 'AMR_Pledge_Certificate.png', { type: 'image/png' });
    var shareData = { title: 'My AMR Pledge Certificate', text: shareText };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      shareData.files = [file];
    } else {
      shareData.url = window.location.href;
    }
    navigator.share(shareData)
      .catch(function (err) { if (err.name !== 'AbortError') console.warn('[cert] share failed', err); });
  }, 'image/png');
}

// Export to window (all called from inline onclick attributes)
window.openCertModal       = openCertModal;
window.closeCertModal      = closeCertModal;
window.buildCertificate    = buildCertificate;
window.backToCertForm      = backToCertForm;
window.downloadCertificate = downloadCertificate;
window.shareCertificate    = shareCertificate;

// ─── Disposal Bins Map ───────────────────────────────────────────────────────
//
// 📍 TO UPDATE / ADD YOUR PROPER BIN LOCATIONS:
// You can replace or extend the coordinates in BIN_LOCATIONS below.
// Each entry requires: id, name, address, lat, lng, hours, open, type.
// ─────────────────────────────────────────────────────────────────────────────

var BIN_LOCATIONS = [
  {
    id: 1,
    name: 'Primary Health Centre, Umbraj',
    address: 'Umbraj, Karad, Satara District',
    type: 'Primary Health Centre',
    lat: 17.40131571,
    lng: 74.09911338, // Corrected from 28.09911338 typo in sheet to 74.09911338 (exact Umbraj PHC, Satara)
    hours: '24 / 7',
    open: true
  },
  {
    id: 2,
    name: 'Sub Center Charegon',
    address: 'Charegaon, Karad, Satara District',
    type: 'Health Sub-Centre',
    lat: 17.37350313,
    lng: 74.07137492,
    hours: 'Mon–Sat  9 AM–5 PM',
    open: true
  },
  {
    id: 3,
    name: 'Sub Center Vahagaon',
    address: 'Vahagaon, Karad, Satara District',
    type: 'Health Sub-Centre',
    lat: 17.33350192,
    lng: 74.1484364,
    hours: 'Mon–Sat  9 AM–5 PM',
    open: true
  },
  {
    id: 4,
    name: 'Primary Health Centre, Indoli',
    address: 'Indoli, Karad, Satara District',
    type: 'Primary Health Centre',
    lat: 17.4388846,
    lng: 74.0779735,
    hours: '24 / 7',
    open: true
  },
  {
    id: 5,
    name: 'Primary Health Centre, Sakharwadi',
    address: 'Sakharwadi, Phaltan, Satara District',
    type: 'Primary Health Centre',
    lat: 18.05508028,
    lng: 74.34017207,
    hours: '24 / 7',
    open: true
  },
  {
    id: 6,
    name: 'Primary Healthcare Center Limb',
    address: 'Limb, Satara District',
    type: 'Primary Health Centre',
    lat: 17.789294,
    lng: 74.013379,
    hours: '24 / 7',
    open: true
  },
  {
    id: 7,
    name: 'Maalgaon Sab Centre - Limb PHC',
    address: 'Maalgaon, Satara District',
    type: 'Health Sub-Centre',
    lat: 17.814277,
    lng: 74.040257,
    hours: 'Mon–Sat  9 AM–5 PM',
    open: true
  },
  {
    id: 8,
    name: 'Kshetramahuli PHC',
    address: 'Kshetramahuli, Satara District',
    type: 'Primary Health Centre',
    lat: 17.6937957,
    lng: 74.07497305,
    hours: '24 / 7',
    open: true
  },
  {
    id: 9,
    name: 'Khed Subcentre, Kshetramahuli PHC',
    address: 'Khed, Satara District',
    type: 'Health Sub-Centre',
    lat: 17.702862,
    lng: 74.036412,
    hours: 'Mon–Sat  9 AM–5 PM',
    open: true
  },
  {
    id: 10,
    name: 'Genaba Tukaram Mhaske, UPHC',
    address: 'Pimpri-Chinchwad, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.60740599,
    lng: 73.86589781,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 11,
    name: 'Kai. Sadashiv Kawade, UPHC',
    address: 'Ghorpadi, Pune Cantonment Area, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.5188839,
    lng: 73.90633868,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 12,
    name: 'Kai. Bapusaheb Kawade, UPHC',
    address: 'Kalyani Nagar / Yerawada, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.54006309,
    lng: 73.89862541,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 13,
    name: 'Laxmi Township Phase III',
    address: 'Laxmi Township, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.57886019,
    lng: 73.87411668,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 14,
    name: 'Laxmi Township Phase I',
    address: 'Laxmi Township, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.57766674,
    lng: 73.87361229,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 15,
    name: 'Kai. Baburao Genba Shewale, UPHC',
    address: 'Aundh, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.56296296,
    lng: 73.83270059,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 16,
    name: 'Mahesh Paradise CHS',
    address: 'Baner / Balewadi, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.56733782,
    lng: 73.80446784,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 17,
    name: 'Kumar Prerana CHS',
    address: 'Baner, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.56612983,
    lng: 73.80257968,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 18,
    name: 'Gold Coast CHS',
    address: 'Baner / Pashan, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.55184947,
    lng: 73.80121422,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 19,
    name: 'Elite Garden CHS',
    address: 'Baner, Pune',
    type: 'Residential Drop-off Point',
    lat: 18.5656172,
    lng: 73.80614498,
    hours: 'Open 24/7 for Residents & Public',
    open: true
  },
  {
    id: 20,
    name: 'Kai Dashrath Baliram Bhangire UPHC',
    address: 'Mohammadwadi, Hadapsar, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.46750975,
    lng: 73.92011332,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 21,
    name: 'Thor Yugpurush Raja Shivchhatrapati UPHC',
    address: 'Upper Indira Nagar, Bibwewadi, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.46307818,
    lng: 73.86786235,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  },
  {
    id: 22,
    name: 'Shree Sadguru Shankar Maharaj UPHC',
    address: 'Dhankawadi, Pune',
    type: 'Urban Primary Health Centre',
    lat: 18.46935465,
    lng: 73.86292403,
    hours: 'Mon–Sat  8 AM–8 PM',
    open: true
  }
];

var _binsMap        = null;   // Leaflet map instance
var _binsMarkers    = {};     // id → Leaflet marker
var _userMarker     = null;   // Leaflet marker for user position
var _userLocation   = null;   // { lat, lng }
var _nearestBin     = null;   // bin object with shortest distance
var _sortedBins     = [];

// ── Great-circle distance using Haversine formula (km) ─────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km == null || isNaN(km)) return '';
  if (km < 1) {
    return Math.round(km * 1000) + ' m';
  }
  return km.toFixed(1) + ' km';
}

// ── Map Initialization ────────────────────────────────────────────────────────
function initBinsMap() {
  var mapEl = document.getElementById('binsMap');
  if (!mapEl) return;

  if (typeof L === 'undefined') {
    // Retry if Leaflet script is still fetching
    if (!window._binsInitRetries) window._binsInitRetries = 0;
    if (window._binsInitRetries < 25) {
      window._binsInitRetries++;
      window.setTimeout(initBinsMap, 100);
    }
    return;
  }

  if (_binsMap) {
    _binsMap.invalidateSize();
    return;
  }

  // Create Leaflet map centered across Pune & Satara region
  _binsMap = L.map('binsMap', {
    center: [18.0, 73.95],
    zoom: 9,
    zoomControl: true,
    scrollWheelZoom: false
  });

  // ESRI World Street Map tiles — 100% Free, NO API key required, NO watermark, reliable CDN
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Map &copy; <a href="https://www.esri.com/" target="_blank">Esri</a> & contributors'
  }).addTo(_binsMap);

  // Render all 22 bin markers
  renderBinMarkers(BIN_LOCATIONS);

  // Fit bounds to show all 22 disposal locations nicely framed
  var allPoints = BIN_LOCATIONS.map(function (loc) { return [loc.lat, loc.lng]; });
  _binsMap.fitBounds(allPoints, { padding: [35, 35] });

  // Invalidate map size once container is fully sized
  window.setTimeout(function () {
    if (_binsMap) _binsMap.invalidateSize();
  }, 250);

  window.addEventListener('resize', function () {
    if (_binsMap) _binsMap.invalidateSize();
  });

  // Automatically attempt user location (passive/non-blocking)
  if (navigator.geolocation) {
    requestUserLocation(false);
  }
}

// ── User location markers ─────────────────────────────────────────────────────
function makeUserLocationIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="user-loc-marker">' +
            '<div class="user-loc-pulse"></div>' +
            '<div class="user-loc-dot"></div>' +
          '</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function updateUserMarker(lat, lng) {
  if (!_binsMap) return;

  if (_userMarker) {
    _userMarker.setLatLng([lat, lng]);
  } else {
    _userMarker = L.marker([lat, lng], {
      icon: makeUserLocationIcon(),
      title: 'Your Location',
      zIndexOffset: 1000
    }).addTo(_binsMap);

    _userMarker.bindPopup('<div class="bin-popup"><div class="bin-popup-name">📍 You are here</div><div class="bin-popup-address">Your detected GPS location</div></div>');
  }
}

// ── Bin markers & popups ──────────────────────────────────────────────────────
function makeBinIcon(isNearest) {
  var fill   = isNearest ? '#f59e0b' : '#006857';
  var stroke = isNearest ? '#b45309' : '#00473b';

  var html = '<div class="bin-marker-pin' + (isNearest ? ' is-nearest' : '') + '">' +
    '<svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M16 1C8.82 1 3 6.82 3 14c0 8.84 13 27 13 27S29 22.84 29 14C29 6.82 23.18 1 16 1z"' +
        ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>' +
      '<circle cx="16" cy="14" r="7.5" fill="white"/>' +
      // Medical bin / drop box cross symbol
      '<path d="M13 11h6M14 11V10h4v1M13 12h6l-.8 6h-4.4L13 12z"' +
        ' stroke="' + fill + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
  '</div>';

  return L.divIcon({
    className: '',
    html: html,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  });
}

function makeBinPopupHTML(loc, isNearest) {
  var originParam = _userLocation ? '&origin=' + _userLocation.lat + ',' + _userLocation.lng : '';
  var mapsUrl = 'https://www.google.com/maps/dir/?api=1' + originParam + '&destination=' + loc.lat + ',' + loc.lng;

  var distHtml = '';
  if (loc.distanceKm != null) {
    distHtml = '<div class="bin-popup-distance">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>' +
      '<span>' + formatDistance(loc.distanceKm) + ' away</span>' +
    '</div>';
  }

  var nearestBadge = isNearest
    ? '<div class="bin-popup-nearest-badge">⭐ Nearest Disposal Bin</div>'
    : '';

  return '<div class="bin-popup">' +
    nearestBadge +
    '<div class="bin-popup-name">' + escapeHTML(loc.name) + '</div>' +
    '<div class="bin-popup-type">' + escapeHTML(loc.type) + '</div>' +
    distHtml +
    '<div class="bin-popup-address">' + escapeHTML(loc.address) + '</div>' +
    '<div class="bin-popup-footer">' +
      '<span class="bin-popup-status bin-popup-status--' + (loc.open ? 'open' : 'closed') + '">' +
        (loc.open ? 'Open' : 'Closed') +
      '</span>' +
      '<a class="bin-popup-link" href="' + mapsUrl + '" target="_blank" rel="noopener noreferrer">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
        'Directions' +
      '</a>' +
    '</div>' +
  '</div>';
}

function renderBinMarkers(locations, nearestId) {
  if (!_binsMap) return;

  // Clear existing markers
  Object.keys(_binsMarkers).forEach(function (id) {
    if (_binsMarkers[id] && _binsMap.hasLayer(_binsMarkers[id])) {
      _binsMap.removeLayer(_binsMarkers[id]);
    }
  });
  _binsMarkers = {};

  locations.forEach(function (loc) {
    var isNearest = (loc.id === nearestId);
    var marker = L.marker([loc.lat, loc.lng], {
      icon: makeBinIcon(isNearest),
      title: loc.name,
      zIndexOffset: isNearest ? 500 : 100
    }).addTo(_binsMap);

    marker.bindPopup(makeBinPopupHTML(loc, isNearest), {
      maxWidth: 280,
      className: 'bin-popup-wrap'
    });

    _binsMarkers[loc.id] = marker;
  });
}

// ── Geolocation & Distance Sorting ───────────────────────────────────────────
function requestUserLocation(manualTrigger) {
  var locateBtn   = document.getElementById('btnLocateUser');
  var statusWrap  = document.getElementById('binsLocStatus');
  var statusText  = document.getElementById('binsStatusText');

  if (!navigator.geolocation) {
    if (statusWrap) statusWrap.className = 'bins-status status-denied';
    if (statusText) statusText.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  if (locateBtn) locateBtn.classList.add('is-loading');
  if (statusWrap) statusWrap.className = 'bins-status status-loading';
  if (statusText) statusText.textContent = 'Detecting your location…';

  navigator.geolocation.getCurrentPosition(
    function (position) {
      if (locateBtn) locateBtn.classList.remove('is-loading');
      handleUserPosition(position.coords.latitude, position.coords.longitude);
    },
    function (error) {
      if (locateBtn) locateBtn.classList.remove('is-loading');
      console.warn('Geolocation notice:', error.message);
      if (statusWrap) statusWrap.className = 'bins-status status-denied';
      if (statusText) {
        if (error.code === 1) {
          statusText.textContent = 'Location access denied. Showing all disposal bins across Maharashtra.';
        } else {
          statusText.textContent = 'Could not detect exact location. Showing all bins.';
        }
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 120000
    }
  );
}

function handleUserPosition(lat, lng) {
  _userLocation = { lat: lat, lng: lng };

  // Calculate distance to all bins
  BIN_LOCATIONS.forEach(function (loc) {
    loc.distanceKm = getDistanceKm(lat, lng, loc.lat, loc.lng);
  });

  // Sort from nearest to farthest
  _sortedBins = BIN_LOCATIONS.slice().sort(function (a, b) {
    return a.distanceKm - b.distanceKm;
  });

  _nearestBin = _sortedBins[0];

  // Update Status Toolbar
  var statusWrap = document.getElementById('binsLocStatus');
  var statusText = document.getElementById('binsStatusText');
  var nearestBtn = document.getElementById('btnNearestBin');

  if (statusWrap) statusWrap.className = 'bins-status status-active';
  if (statusText && _nearestBin) {
    statusText.innerHTML = 'Nearest bin: <strong>' + escapeHTML(_nearestBin.name) + '</strong> (' + formatDistance(_nearestBin.distanceKm) + ' away)';
  }

  if (nearestBtn) {
    nearestBtn.style.display = 'inline-flex';
  }

  // Draw user beacon and update bins with distance data
  updateUserMarker(lat, lng);
  renderBinMarkers(_sortedBins, _nearestBin.id);

  // Center & frame map nicely around user & closest bins
  if (_binsMap) {
    var boundsPoints = [[lat, lng], [_nearestBin.lat, _nearestBin.lng]];
    if (_sortedBins[1]) boundsPoints.push([_sortedBins[1].lat, _sortedBins[1].lng]);

    _binsMap.fitBounds(boundsPoints, {
      padding: [60, 60],
      maxZoom: 14
    });

    // Auto-open nearest bin popup after smooth zoom
    window.setTimeout(function () {
      if (_binsMarkers[_nearestBin.id]) {
        _binsMarkers[_nearestBin.id].openPopup();
      }
    }, 600);
  }
}

// ── Jump to Nearest Bin ───────────────────────────────────────────────────────
function focusNearestBin() {
  if (!_nearestBin || !_binsMap) return;

  _binsMap.setView([_nearestBin.lat, _nearestBin.lng], 14, { animate: true });
  var marker = _binsMarkers[_nearestBin.id];
  if (marker) {
    marker.openPopup();
  }
}

// Export functions to window for onclick handlers
window.requestUserLocation = requestUserLocation;
window.focusNearestBin     = focusNearestBin;
window.initBinsMap         = initBinsMap;

// Initialise map after DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('binsMap')) {
    window.setTimeout(initBinsMap, 100);
  }
});

// Utility function to escape HTML
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Poster Modal & Direct Download Handlers
// assets/events/foo/1.jpg -> assets/web/events/foo/1.webp
// The originals are 6000x4000 camera files up to 16 MB; the modal renders them a
// few hundred px wide, so the lightbox shows the WebP and only the Download
// button reaches for the full-resolution original.
function webVersionOf(src) {
  if (typeof src !== 'string' || !src.startsWith('assets/') || src.startsWith('assets/web/')) return src;
  return 'assets/web/' + src.slice('assets/'.length).replace(/\.[^./]+$/, '.webp');
}

// Called as openPosterModal(this, 'assets/…', hideDownload). The caption comes
// from the trigger's data-modal-title / data-modal-desc attributes rather than
// from arguments, because a string sitting inside an onclick cannot be reached
// by the i18n runtime and so could never be translated.
function openPosterModal(trigger, imgSrc, hideDownload) {
  const modal = document.getElementById('posterModal');
  if (!modal) return;

  const el = trigger && trigger.getAttribute ? trigger : null;
  const title = (el && el.getAttribute('data-modal-title')) || '';
  const desc = (el && el.getAttribute('data-modal-desc')) || '';

  // Use active image src if trigger is or contains an img (respects Marathi toggle)
  const activeImg = el && (el.tagName === 'IMG' ? el : el.querySelector('img'));
  const effectiveSrc = (activeImg && activeImg.getAttribute('src')) ? activeImg.getAttribute('src') : imgSrc;

  const img = document.getElementById('posterModalImg');
  const webSrc = webVersionOf(effectiveSrc);
  // If a WebP is ever missing, show the original rather than a broken image
  img.onerror = webSrc === effectiveSrc ? null : function () { img.onerror = null; img.src = effectiveSrc; };
  img.src = webSrc;

  document.getElementById('posterModalTitle').innerText = title;
  document.getElementById('posterModalDesc').innerText = desc;
  const dlBtn = document.getElementById('posterModalDownloadBtn');
  if (dlBtn) {
    const ext = (effectiveSrc.match(/\.[^./]+$/) || ['.jpg'])[0];
    dlBtn.href = effectiveSrc;
    dlBtn.setAttribute('download', title.replace(/[^a-zA-Z0-9]/g, '_') + ext);
    dlBtn.style.display = hideDownload ? 'none' : 'flex';
  }
  modal.classList.add('active');
}

function closePosterModal() {
  const modal = document.getElementById('posterModal');
  if (modal) modal.classList.remove('active');
}

function triggerDirectDownload(fileUrl, fileName) {
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName || 'AMR_Poster.jpg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Carousel Navigation and Auto-Slide Handler
function moveCarousel(carouselId, direction) {
  const container = document.getElementById(carouselId);
  if (!container) return;

  const imgs = container.querySelectorAll('.carousel-img');
  if (imgs.length <= 1) return;

  let currentIndex = 0;
  imgs.forEach((img, idx) => {
    if (img.classList.contains('active')) {
      currentIndex = idx;
    }
  });

  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = imgs.length - 1;
  if (newIndex >= imgs.length) newIndex = 0;

  setCarouselSlide(carouselId, newIndex);
}

function setCarouselSlide(carouselId, slideIndex) {
  const container = document.getElementById(carouselId);
  if (!container) return;

  const imgs = container.querySelectorAll('.carousel-img');
  const dots = container.querySelectorAll('.dot');

  imgs.forEach((img, idx) => {
    img.classList.toggle('active', idx === slideIndex);
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === slideIndex);
  });
}

// Auto-advance multi-image event carousels every 4.5 seconds
setInterval(() => {
  // Multi-image carousels only. carousel-state-consult is driven by its own controls.
  const carousels = ['carousel-national', 'carousel-kap', 'carousel-stewardship', 'carousel-innovation', 'carousel-pune'];
  carousels.forEach(id => {
    moveCarousel(id, 1);
  });
}, 4500);

// ─── Quotes & Testimonials Carousel ───
let testimonialInterval = null;

function moveTestimonial(direction) {
  const track = document.getElementById('testimonialsTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.testimonial-slide');
  if (slides.length <= 1) return;

  let currentIndex = 0;
  slides.forEach((slide, idx) => {
    if (slide.classList.contains('active')) currentIndex = idx;
  });

  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = slides.length - 1;
  if (nextIndex >= slides.length) nextIndex = 0;

  setTestimonialSlide(nextIndex);
}

function setTestimonialSlide(slideIndex) {
  const track = document.getElementById('testimonialsTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.testimonial-slide');
  const dots = document.querySelectorAll('#testimonialDots .dot');

  slides.forEach((slide, idx) => {
    slide.classList.toggle('active', idx === slideIndex);
  });
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === slideIndex);
    dot.setAttribute('aria-current', idx === slideIndex ? 'true' : 'false');
  });
}

function startTestimonialTimer() {
  stopTestimonialTimer();
  const track = document.getElementById('testimonialsTrack');
  if (!track) return;
  const slides = track.querySelectorAll('.testimonial-slide');
  if (slides.length <= 1) return;
  testimonialInterval = setInterval(() => {
    moveTestimonial(1);
  }, 7000);
}

function stopTestimonialTimer() {
  if (testimonialInterval) {
    clearInterval(testimonialInterval);
    testimonialInterval = null;
  }
}

window.moveTestimonial = moveTestimonial;
window.setTestimonialSlide = setTestimonialSlide;

(function initTestimonialsCarousel() {
  const init = () => {
    const slider = document.getElementById('testimonialsSlider');
    if (!slider) return;

    slider.addEventListener('mouseenter', stopTestimonialTimer);
    slider.addEventListener('mouseleave', startTestimonialTimer);
    slider.addEventListener('focusin', stopTestimonialTimer);
    slider.addEventListener('focusout', startTestimonialTimer);

    let touchStartX = 0;
    slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopTestimonialTimer();
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 40) {
        moveTestimonial(diff > 0 ? 1 : -1);
      }
      startTestimonialTimer();
    }, { passive: true });

    startTestimonialTimer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ─── Sticky Header Scroll Shadow Effect ───
(function () {
  const header = document.querySelector('header');
  if (!header) return;

  let ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  });
})();

// ─── Scroll-Reveal Engine ───
// ONE shared IntersectionObserver drives every .reveal element. Each element
// fires exactly once and is then unobserved — nothing re-animates on scroll
// back and no observer is left running.
//
// A container marked [data-reveal-children] staggers its DIRECT children:
//   <div class="reveal" data-reveal-children> ... </div>
// Children get transition-delay in 60ms steps, capped at 6 steps (360ms), so a
// long list never keeps the reader waiting.
//
// This file only ever toggles the .visible class and writes transition-delay.
// The animated properties themselves (opacity/transform) belong to style.css.
//
// SAFETY: content must never end up permanently hidden. If the user prefers
// reduced motion, or IntersectionObserver is missing/broken (old Android
// WebView, Opera Mini), every .reveal is marked visible immediately and no
// observer is created at all.
(function () {
  const REVEAL_CLASS = 'reveal';
  const REVEAL_SELECTOR = '.reveal';
  const VISIBLE_CLASS = 'visible';
  const CHILDREN_ATTR = 'data-reveal-children';
  const STAGGER_STEP_MS = 60;    // gap between siblings
  const STAGGER_MAX_STEPS = 6;   // cap: 6 x 60ms = 360ms
  const DELAY_CLEANUP_MS = 900;  // strip the inline delay once the reveal is done

  const OBSERVER_OPTIONS = {
    // Low threshold so a section taller than the viewport still fires, and a
    // negative bottom margin so the element is properly in view before it
    // animates — nothing is ever caught mid-fade at the screen edge.
    threshold: 0.01,
    rootMargin: '0px 0px -10% 0px'
  };

  const tracked = new WeakSet(); // elements already handed to the observer
  let observer = null;

  const motionQuery = (function () {
    if (!window.matchMedia) return null;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch (err) {
      return null;
    }
  })();

  function prefersReducedMotion() {
    return !!(motionQuery && motionQuery.matches);
  }

  // Stagger the direct children of a [data-reveal-children] container.
  // stepMs of 0 means "no stagger" (reduced motion / fallback path).
  function staggerChildren(container, stepMs) {
    if (!container.hasAttribute(CHILDREN_ATTR)) return;

    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const delay = stepMs ? Math.min(i, STAGGER_MAX_STEPS) * stepMs : 0;

      if (delay > 0) {
        child.style.transitionDelay = delay + 'ms';
        // The inline delay would otherwise also hold up hover/press
        // transitions on this child forever, so drop it once the reveal ends.
        window.setTimeout(function () {
          child.style.transitionDelay = '';
        }, delay + DELAY_CLEANUP_MS);
      } else {
        child.style.transitionDelay = '';
      }

      // A child that is itself a .reveal rides the parent's stagger rather
      // than waiting for its own intersection.
      if (child.classList.contains(REVEAL_CLASS)) {
        if (observer) observer.unobserve(child);
        tracked.add(child);
        child.classList.add(VISIBLE_CLASS);
      }
    }
  }

  function revealElement(el, stepMs) {
    // Already revealed: don't re-stagger it. The stepMs === 0 path is allowed
    // through so the reduced-motion / fallback sweep can still strip delays.
    if (stepMs && el.classList.contains(VISIBLE_CLASS)) return;
    staggerChildren(el, stepMs);
    el.classList.add(VISIBLE_CLASS);
  }

  // Everything visible, right now, with no animation and no delays.
  function revealAll() {
    const reveals = document.querySelectorAll(REVEAL_SELECTOR);
    for (let i = 0; i < reveals.length; i++) {
      revealElement(reveals[i], 0);
    }
  }

  function onIntersect(entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      if (observer) observer.unobserve(entry.target); // fire once, then let go
      revealElement(entry.target, STAGGER_STEP_MS);
    });
  }

  // Safe to call again after new .reveal markup is added — already-tracked and
  // already-visible elements are skipped.
  function initScrollReveal() {
    const reveals = document.querySelectorAll(REVEAL_SELECTOR);
    if (!reveals.length) return;

    // HARD REQUIREMENT: reduced motion means no animation and no observer.
    if (prefersReducedMotion()) {
      revealAll();
      return;
    }

    if (typeof window.IntersectionObserver !== 'function') {
      revealAll();
      return;
    }

    if (!observer) {
      try {
        observer = new window.IntersectionObserver(onIntersect, OBSERVER_OPTIONS);
      } catch (err) {
        observer = null;
        revealAll();
        return;
      }
    }

    for (let i = 0; i < reveals.length; i++) {
      const el = reveals[i];
      if (tracked.has(el) || el.classList.contains(VISIBLE_CLASS)) continue;
      tracked.add(el);
      observer.observe(el);
    }
  }

  function start() {
    try {
      initScrollReveal();
    } catch (err) {
      revealAll(); // never leave the page half-blank
    }
  }

  // If the preference flips to "reduce" mid-session, stop observing and show
  // the rest of the page straight away.
  function onMotionPreferenceChange(event) {
    if (!event.matches) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    revealAll();
  }

  if (motionQuery) {
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', onMotionPreferenceChange);
    } else if (motionQuery.addListener) {
      motionQuery.addListener(onMotionPreferenceChange); // older WebViews
    }
  }

  // Exposed so later sections injected into the page can be picked up.
  window.initScrollReveal = start;

  start();
  // Belt and braces: if this file is ever moved out of the end of <body>,
  // re-scan once the DOM is complete. Idempotent.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  }
})();
