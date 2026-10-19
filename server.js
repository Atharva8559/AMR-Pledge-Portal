const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

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

const COUNTS_FILE = path.join(__dirname, 'counts.json');

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

// ── Real-Time Counter API ─────────────────────────────────────────────────────

// GET: Current counts
app.get('/api/pledge', (req, res) => {
  const counts = getCounts();
  res.json({
    count: counts.pledge_count,
    quiz_count: counts.quiz_count
  });
});

// POST: Increment pledge or quiz count
app.post('/api/pledge', (req, res) => {
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
    // Malformed JSON: safely default to pledge
  }

  const counts = getCounts();

  if (action === 'quiz_complete') {
    counts.quiz_count = (counts.quiz_count || 0) + 1;
    saveCounts(counts);
    return res.json({ quiz_count: counts.quiz_count });
  }

  // Default: increment pledge
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
