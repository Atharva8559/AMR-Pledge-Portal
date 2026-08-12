// Local storage database structure
let pledgesCount = parseInt(localStorage.getItem('amr_pledges_count'));
let iecDownloads = parseInt(localStorage.getItem('amr_iec_downloads'));
let quizPassed = localStorage.getItem('amr_quiz_passed') === 'true';

// Region statistics tracking
let regionPledges = JSON.parse(localStorage.getItem('amr_region_pledges'));
if (!regionPledges) {
  regionPledges = {
    North: 31427,
    South: 38570,
    East: 24285,
    West: 28570,
    Central: 20000
  };
  localStorage.setItem('amr_region_pledges', JSON.stringify(regionPledges));
}

if (!pledgesCount || isNaN(pledgesCount)) {
  pledgesCount = 142852;
  localStorage.setItem('amr_pledges_count', pledgesCount);
}
if (!iecDownloads || isNaN(iecDownloads)) {
  iecDownloads = 15482;
  localStorage.setItem('amr_iec_downloads', iecDownloads);
}

// Render Swachh India Inspired Boxed Digit Odometer Counter
function renderSwachhDigitBoxes(count) {
  const container = document.getElementById('digitBoxesRow');
  if (!container) return;

  const num = parseInt(count) || 142852;
  const str = num.toString();
  container.innerHTML = '';

  for (let i = 0; i < str.length; i++) {
    const box = document.createElement('div');
    box.className = 'digit-box';
    box.innerText = str[i];
    container.appendChild(box);
  }
}

// Swachh India Inspired 1-Click Pledge Action
let hasSwachhPledged = false;

function takeSwachhPledge() {
  if (hasSwachhPledged) return;
  hasSwachhPledged = true;

  pledgesCount = (parseInt(localStorage.getItem('amr_pledges_count')) || pledgesCount || 142852) + 1;
  localStorage.setItem('amr_pledges_count', pledgesCount);

  // Re-render digit boxes with pop animation
  renderSwachhDigitBoxes(pledgesCount);

  // Update other counters on page
  const totalElem = document.getElementById('total-pledges-val');
  if (totalElem) totalElem.innerText = pledgesCount.toLocaleString();

  const todayElem = document.getElementById('today-pledges-counter');
  if (todayElem) todayElem.innerText = (4852 + (pledgesCount % 100)).toLocaleString();

  // Disable button & show success notification
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

  // Trigger pop animation on digit boxes
  const boxes = document.querySelectorAll('.digit-box');
  boxes.forEach(b => {
    b.classList.add('pop-anim');
    setTimeout(() => b.classList.remove('pop-anim'), 600);
  });
}

// Make functions globally accessible
window.takeSwachhPledge = takeSwachhPledge;
window.renderSwachhDigitBoxes = renderSwachhDigitBoxes;



// Filter configuration variables
let selectedRegion = 'All';

// Seasons Timeline Data (Swachh India Inspired)
const SEASONS_DATA = {
  1: [
    { date: "September 25, 2024", img: "assets/amr_season1_launch.png", desc: "Launch of ACT4AMR national campaign with Campaign Ambassadors and leading medical experts." },
    { date: "October 1, 2024", img: "assets/amr_season1_bus.png", desc: "ACT4AMR Express flagged off to travel across 10 states over 90 days to spread awareness on safe antibiotic usage." },

    { date: "October 15, 2024", img: "assets/amr_season1_drawing.png", desc: "Celebrated Global Hand-Hygiene Day with a nationwide student painting and science poster competition." },
    { date: "December 14, 2024", img: "assets/amr_season1_telethon.png", desc: "India's biggest 12-Hour AMR Telethon broadcast organized, raising pledge commitments and clinical outreach funds." }
  ],
  2: [
    { date: "March 10, 2025", img: "assets/amr_season1_launch.png", desc: "Clinical Stewardship Alliance established across 150+ hospital networks for standardized prescription monitoring." },
    { date: "June 5, 2025", img: "assets/amr_season1_bus.png", desc: "Mobile Diagnostic & Prescribing Awareness Units deployed in regional communities across 8 states." },
    { date: "September 20, 2025", img: "assets/amr_season1_drawing.png", desc: "Youth Science Ambassador program launched in 500+ high schools nationwide." },
    { date: "November 18, 2025", img: "assets/amr_season1_telethon.png", desc: "World Antimicrobial Resistance Awareness Week summit featuring over 10,000 medical pledges." }
  ],
  3: [
    { date: "January 15, 2026", img: "assets/amr_season1_launch.png", desc: "Real-time Regional Distribution Registry & Interactive Dashboard public release." },
    { date: "April 22, 2026", img: "assets/amr_season1_bus.png", desc: "Over 140,000 active citizens registered under responsible medicine pledges." },
    { date: "August 5, 2026", img: "assets/amr_season1_drawing.png", desc: "National Public Health Alliance expansion reaching 230+ partner outpatient clinics." },
    { date: "October 24, 2026", img: "assets/amr_season1_telethon.png", desc: "Season 3 Telethon & Policy Summit bringing together 50,000 new pledge commitments." }
  ]
};

// Generate default data for Seasons 4 through 11
for (let i = 4; i <= 11; i++) {
  SEASONS_DATA[i] = [
    { date: `Phase 1, Season ${i}`, img: "assets/amr_season1_launch.png", desc: `Season ${i} national stewardship launch & regional outpatient network expansion.` },
    { date: `Phase 2, Season ${i}`, img: "assets/amr_season1_bus.png", desc: `Statewide AMR Express mobile health awareness campaign targeting community clinics.` },
    { date: `Phase 3, Season ${i}`, img: "assets/amr_season1_drawing.png", desc: `School & Youth Ambassador hand-hygiene and antibiotic safety challenge.` },
    { date: `Phase 4, Season ${i}`, img: "assets/amr_season1_telethon.png", desc: `Season ${i} Telethon broadcast & clinical prescribing policy summit.` }
  ];
}

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
  initCounters();
  initQuiz();
  renderSwachhDigitBoxes(pledgesCount);
});


// Increment counters page load
function initCounters() {
  const totElem = document.getElementById('total-pledges-val');
  if (totElem) totElem.innerText = pledgesCount.toLocaleString();
  const dlElem = document.getElementById('total-downloads-val');
  if (dlElem) dlElem.innerText = iecDownloads.toLocaleString();
  const todayElem = document.getElementById('today-pledges-counter');
  if (todayElem) todayElem.innerText = (4852 + (pledgesCount % 100)).toLocaleString();

  renderSwachhDigitBoxes(pledgesCount);
}






// Update Regional map UI elements
function updateRegionStatsUI() {
  const mapTot = document.getElementById('map-total-pledges');
  if (mapTot) mapTot.innerText = pledgesCount.toLocaleString();
  const mapN = document.getElementById('map-north-pledges');
  if (mapN) mapN.innerText = regionPledges.North.toLocaleString();
  const mapS = document.getElementById('map-south-pledges');
  if (mapS) mapS.innerText = regionPledges.South.toLocaleString();
  const mapE = document.getElementById('map-east-pledges');
  if (mapE) mapE.innerText = regionPledges.East.toLocaleString();
  const mapW = document.getElementById('map-west-pledges');
  if (mapW) mapW.innerText = regionPledges.West.toLocaleString();
  const mapC = document.getElementById('map-central-pledges');
  if (mapC) mapC.innerText = regionPledges.Central.toLocaleString();
}

// Setup Map interaction hover classes
function setupMapInteraction() {
  const labels = document.querySelectorAll('.map-region-label');
  labels.forEach(label => {
    label.addEventListener('mouseover', () => {
      const region = label.textContent.trim();
      const path = document.getElementById(`map-${region}`);
      if (path) path.classList.add('hover');
    });
    label.addEventListener('mouseout', () => {
      const region = label.textContent.trim();
      const path = document.getElementById(`map-${region}`);
      if (path) path.classList.remove('hover');
    });
  });
}

// Interactive Map selection filter
function selectMapRegion(regionName) {
  selectedRegion = regionName;

  const statItems = document.querySelectorAll('.region-stat-item');
  statItems.forEach(item => item.classList.remove('active'));
  const activeStat = document.getElementById(`stat-${regionName}`);
  if (activeStat) activeStat.classList.add('active');

  const paths = document.querySelectorAll('.map-region');
  paths.forEach(p => p.classList.remove('active'));
  if (regionName !== 'All') {
    const activePath = document.getElementById(`map-${regionName}`);
    if (activePath) activePath.classList.add('active');
  }
}


// 1-Click Quick Pledge Action
let hasPledged = false;
function takeQuickPledge() {
  if (hasPledged) return;
  hasPledged = true;

  pledgesCount += 1;
  localStorage.setItem('amr_pledges_count', pledgesCount);

  const regions = ["North", "South", "East", "West", "Central"];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];
  regionPledges[randomRegion] += 1;
  localStorage.setItem('amr_region_pledges', JSON.stringify(regionPledges));

  initCounters();
  updateRegionStatsUI();

  const btn = document.getElementById('btn-quick-pledge');
  if (btn) {
    btn.innerHTML = "✅ Pledge Confirmed!";
    btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    btn.style.color = "#ffffff";
    btn.style.boxShadow = "0 0 15px rgba(16, 185, 129, 0.4)";
    btn.style.pointerEvents = "none";
  }

  const msg = document.getElementById('pledgeSuccessMsg');
  if (msg) msg.style.display = 'block';
}

// Render Seasons Timeline Cards (Swachh India Inspired)
function renderSeasonCards(seasonNum) {
  const grid = document.getElementById('seasonsCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const items = SEASONS_DATA[seasonNum] || SEASONS_DATA[1];
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'season-card-item';
    card.innerHTML = `
      <span class="season-card-date">${escapeHTML(item.date)}</span>
      <div class="season-card-img-wrapper">
        <img src="${item.img}" alt="${escapeHTML(item.desc)}" class="season-card-img">
      </div>
      <p class="season-card-desc">${escapeHTML(item.desc)}</p>
    `;
    grid.appendChild(card);
  });
}

function switchSeason(seasonNum, btnElement) {
  const tabs = document.querySelectorAll('.season-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderSeasonCards(seasonNum);
}

// IEC Materials Filter & Search
function filterCategory(category, btnElement) {
  const tabs = document.querySelectorAll('.filter-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const cards = document.querySelectorAll('.iec-card');
  const query = document.getElementById('iecSearch').value.toLowerCase().trim();

  cards.forEach(card => {
    const cardCat = card.getAttribute('data-category');
    const cardTitle = card.getAttribute('data-title').toLowerCase();

    const matchesCategory = (category === 'all') || (cardCat === category);
    const matchesSearch = query === '' || cardTitle.includes(query);

    if (matchesCategory && matchesSearch) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

function filterIEC() {
  const activeTab = document.querySelector('.filter-btn.active');
  const activeCategory = activeTab ? activeTab.getAttribute('onclick').match(/'([^']+)'/)[1] : 'all';
  filterCategory(activeCategory, activeTab);
}

function triggerIECDownload(resourceTitle) {
  iecDownloads += 1;
  localStorage.setItem('amr_iec_downloads', iecDownloads);
  initCounters();

  const tempLink = document.createElement('a');
  tempLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`ACT4AMR Resource: ${resourceTitle}\nThank you for spreading awareness on Antimicrobial Resistance.`);

  tempLink.download = `${resourceTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
}

// Media Modal Functions
function playMockMedia(type, title, desc) {
  const modal = document.getElementById('mediaModal');
  if (!modal) return;

  const titleElem = document.getElementById('mediaModalTitle');
  if (titleElem) titleElem.innerText = title;
  const descElem = document.getElementById('mediaModalDesc');
  if (descElem) descElem.innerText = desc;
  const iconElem = document.getElementById('playerIconDisplay');
  if (iconElem) iconElem.innerText = type === 'video' ? '🎬' : '🎧';

  const anim = document.getElementById('mediaWaveAnim');
  if (anim) anim.style.display = 'flex';

  modal.classList.add('active');

  const progressBar = document.getElementById('mediaProgressBar');
  const mediaTime = document.getElementById('mediaTime');
  let progress = 0;

  if (window.mediaInterval) clearInterval(window.mediaInterval);
  window.mediaInterval = setInterval(() => {
    progress += 2;
    if (progress > 100) progress = 0;
    if (progressBar) progressBar.style.width = `${progress}%`;
    const seconds = Math.floor((progress / 100) * 90);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mediaTime) mediaTime.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs} / 1:30`;
  }, 200);
}

function closeMediaModal() {
  const modal = document.getElementById('mediaModal');
  if (modal) modal.classList.remove('active');
  if (window.mediaInterval) clearInterval(window.mediaInterval);
}


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
    quizPassed = true;
    localStorage.setItem('amr_quiz_passed', 'true');
  } else if (pct >= 0.5) {
    emoji = "🛡️";
    title = "AMR Aware";
    messageText = "Nice work — you've got a solid grip on the basics. Just a few gaps to close and you'll be a champion!";
    tips = [
      "Always finish your full antibiotic course as prescribed.",
      "Never flush medicines — use safe disposal instead.",
      "Ask your pharmacist about safe disposal."
    ];
    quizPassed = true;
    localStorage.setItem('amr_quiz_passed', 'true');
  } else {
    emoji = "🌱";
    title = "AMR Newcomer";
    messageText = "Great start! Every expert begins somewhere. Here are the key things worth remembering.";
    tips = [
      "Antibiotics fight bacteria — not colds, flu, or viruses.",
      "Only use antibiotics when a doctor prescribes them.",
      "Take leftover medicines to nearest health facility, never the bin or toilet."
    ];
    quizPassed = false;
    localStorage.setItem('amr_quiz_passed', 'false');
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
function openPosterModal(imgSrc, title, desc, hideDownload) {
  const modal = document.getElementById('posterModal');
  if (!modal) return;
  document.getElementById('posterModalImg').src = imgSrc;
  document.getElementById('posterModalTitle').innerText = title;
  document.getElementById('posterModalDesc').innerText = desc;
  const dlBtn = document.getElementById('posterModalDownloadBtn');
  if (dlBtn) {
    dlBtn.href = imgSrc;
    dlBtn.setAttribute('download', title.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg');
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

  // Increment IEC Downloads metric
  totalDownloadsCount += 1;
  localStorage.setItem('amr_iec_downloads', totalDownloadsCount);
  updateMetricsDisplay();
  showToast('Standard A3 High-Res Poster download started!');
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
  const carousels = ['carousel-national', 'carousel-stewardship', 'carousel-innovation', 'carousel-jury'];
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

// ─── Intersection Observer Scroll-Reveal Animations ───
(function () {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  reveals.forEach(function (el) {
    observer.observe(el);
  });
})();
