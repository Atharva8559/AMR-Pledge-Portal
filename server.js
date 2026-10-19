const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMAkBgfhD47rOBERGpEYhVeqY3Q4byo401V_8KTyK_tMNqgTv7br5Ov5rCS_noIeM7KA/exec';
const COUNTS_FILE = path.join(__dirname, 'counts.json');

// GZIP compression for fast text, script, CSS and JSON delivery
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Body parsers for API endpoints
app.use(express.json());
app.use(express.text({ type: '*/*' }));

function getCounts() {
  try {
    if (fs.existsSync(COUNTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(COUNTS_FILE, 'utf8'));
      return {
        pledge_count: Number(data.pledge_count) || 0,
        quiz_count: Number(data.quiz_count) || 0
      };
    }
  } catch (err) {
    console.error('Error reading counts.json:', err);
  }
  return { pledge_count: 0, quiz_count: 0 };
}

function saveCounts(counts) {
  try {
    const payload = {
      pledge_count: counts.pledge_count,
      quiz_count: counts.quiz_count,
      last_updated: new Date().toISOString()
    };
    fs.writeFileSync(COUNTS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing counts.json:', err);
  }
}

// ── Real-Time Counter API (Synchronized with Google Apps Script) ──────────────

// GET: Current counts from Google Apps Script
app.get('/api/pledge', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const gRes = await fetch(GOOGLE_APPS_SCRIPT_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (gRes.ok) {
      const data = await gRes.json();
      if (data && Number.isFinite(Number(data.count))) {
        saveCounts({
          pledge_count: Number(data.count),
          quiz_count: Number(data.quiz_count) || 0
        });
        return res.json({
          count: Number(data.count),
          quiz_count: Number(data.quiz_count) || 0
        });
      }
    }
  } catch (err) {
    console.warn('Apps Script GET fallback to local cache:', err.message);
  }

  // Fallback to local counts if Apps Script is slow
  const counts = getCounts();
  return res.json({
    count: counts.pledge_count,
    quiz_count: counts.quiz_count
  });
});

// POST: Increment pledge or quiz count directly in Google Apps Script
app.post('/api/pledge', async (req, res) => {
  let action = 'pledge';
  try {
    let body = req.body;
    if (typeof body === 'string' && body.trim().length > 0) {
      body = JSON.parse(body);
    }
    if (body && body.action) {
      action = String(body.action).trim().toLowerCase();
    }
  } catch (e) {
    // Malformed body: safely default to pledge
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const gRes = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (gRes.ok) {
      const data = await gRes.json();
      if (action === 'quiz_complete' && data && Number.isFinite(Number(data.quiz_count))) {
        const counts = getCounts();
        counts.quiz_count = Number(data.quiz_count);
        saveCounts(counts);
        return res.json({ quiz_count: counts.quiz_count });
      } else if (data && Number.isFinite(Number(data.count))) {
        const counts = getCounts();
        counts.pledge_count = Number(data.count);
        saveCounts(counts);
        return res.json({ count: counts.pledge_count });
      }
    }
  } catch (err) {
    console.warn('Apps Script POST fallback to local increment:', err.message);
  }

  // Fallback if Apps Script is unreachable
  const counts = getCounts();
  if (action === 'quiz_complete') {
    counts.quiz_count = (counts.quiz_count || 0) + 1;
    saveCounts(counts);
    return res.json({ quiz_count: counts.quiz_count });
  }

  counts.pledge_count = (counts.pledge_count || 0) + 1;
  saveCounts(counts);
  return res.json({ count: counts.pledge_count });
});

// Health check endpoint for GoDaddy monitor
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ── Static Asset Serving with High-Performance Caching ────────────────────────
app.use(express.static(__dirname, {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    // HTML pages: revalidate immediately so updates show up
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
    // Static media, fonts, images: aggressive caching for speed
    else if (/\.(webp|png|jpg|jpeg|svg|css|js|woff2|woff|mp4|pdf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Route fallback: any unknown route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
