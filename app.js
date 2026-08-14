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

// Own-property check, so keys like "constructor" can't leak Object.prototype values
function i18nHas(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
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

async function setLanguage(lang) {
  if (!lang || lang === I18N.lang) return;

  // Back to English: restore inline text, load nothing
  if (lang === 'en') {
    restoreI18nOriginals();
    I18N.lang = 'en';
    I18N.strings = null;
    rememberLang('en');
    document.documentElement.setAttribute('lang', 'en');
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
  if (saved && saved !== 'en') setLanguage(saved);
});

// Make i18n globally accessible (Bucket 6 toggle calls these from an inline onclick)
window.setLanguage = setLanguage;
window.registerStrings = registerStrings;
window.t = t;
window.I18N = I18N;


// 1-Click Pledge Action — a personal commitment, nothing is counted or stored
let hasSwachhPledged = false;

function takeSwachhPledge() {
  if (hasSwachhPledged) return;
  hasSwachhPledged = true;

  // Confirm the promise & show success notification
  const btn = document.getElementById('btn-swachh-pledge');
  const toast = document.getElementById('swachhSuccessToast');

  if (btn) {
    btn.innerHTML = `<span class="btn-text">✓ Promise Taken!</span>`;
    btn.classList.add('pledged');
    btn.style.pointerEvents = 'none';
  }

  if (toast) {
    toast.style.display = 'block';
  }
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
    feedback.innerHTML = `<strong style="color: #065f46; display: block; margin-bottom: 0.25rem;">✅ Correct!</strong> ${escapeHTML(fact)}`;
  } else {
    btnElement.classList.add('incorrect');

    const qObj = QUIZ_QUESTIONS[currentQuizIndex];
    const correctIdx = qObj.options.findIndex(o => o.isCorrect);
    if (correctIdx !== -1) {
      options[correctIdx].classList.add('correct');
    }

    feedback.className = 'quiz-feedback error';
    feedback.style.display = 'block';
    feedback.innerHTML = `<strong style="color: #991b1b; display: block; margin-bottom: 0.25rem;">💡 Good to know</strong> ${escapeHTML(fact)}`;
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
  let emoji = "";
  let messageText = "";
  let tips = [];

  if (pct >= 0.8) {
    emoji = "🏆";
    title = "AMR Champion!";
    messageText = "Brilliant! You really know your stuff. You're ready to spread the word and protect your community.";
    tips = [
      "Tell a friend: antibiotics don't work on colds or flu.",
      "Return unused medicines to a pharmacy take-back point.",
      "Never share or self-prescribe antibiotics."
    ];
  } else if (pct >= 0.5) {
    emoji = "🛡️";
    title = "AMR Aware";
    messageText = "Nice work — you've got a solid grip on the basics. Just a few gaps to close and you'll be a champion!";
    tips = [
      "Always finish your full antibiotic course as prescribed.",
      "Never flush medicines — use safe disposal instead.",
      "Ask your pharmacist about safe disposal."
    ];
  } else {
    emoji = "🌱";
    title = "AMR Newcomer";
    messageText = "Great start! Every expert begins somewhere. Here are the key things worth remembering.";
    tips = [
      "Antibiotics fight bacteria — not colds, flu, or viruses.",
      "Only use antibiotics when a doctor prescribes them.",
      "Take leftover medicines to nearest health facility, never the bin or toilet."
    ];
  }

  if (medal) medal.innerText = emoji;
  if (msg) {
    msg.innerHTML = `<strong style="font-size: 1.3rem; color: #0f172a; display: block; margin-bottom: 0.5rem;">${title}</strong><span style="font-size: 0.95rem; color: #475569;">${messageText}</span>`;
  }

  if (tipsBox) {
    tipsBox.innerHTML = `
      <div class="quiz-tips-container">
        <p class="tips-heading">💡 Keep these key takeaways in mind:</p>
        <ul class="tips-list">
          ${tips.map(t => `<li><span class="tip-check">✓</span> ${escapeHTML(t)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
}


function restartQuiz() {
  initQuiz();
}

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

function openPosterModal(imgSrc, title, desc, hideDownload) {
  const modal = document.getElementById('posterModal');
  if (!modal) return;

  const img = document.getElementById('posterModalImg');
  const webSrc = webVersionOf(imgSrc);
  // If a WebP is ever missing, show the original rather than a broken image
  img.onerror = webSrc === imgSrc ? null : function () { img.onerror = null; img.src = imgSrc; };
  img.src = webSrc;

  document.getElementById('posterModalTitle').innerText = title;
  document.getElementById('posterModalDesc').innerText = desc;
  const dlBtn = document.getElementById('posterModalDownloadBtn');
  if (dlBtn) {
    const ext = (imgSrc.match(/\.[^./]+$/) || ['.jpg'])[0];
    dlBtn.href = imgSrc;
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
  const carousels = ['carousel-national', 'carousel-stewardship', 'carousel-innovation'];
  carousels.forEach(id => {
    moveCarousel(id, 1);
  });
}, 4500);

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
