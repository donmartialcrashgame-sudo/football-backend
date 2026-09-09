const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_SPORTS_KEY || process.env.FOOTBALL_API_KEY;
const API_BASE_URL = process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io';

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'football-backend',
    message: 'Football API backend is running',
    footballApiConfigured: Boolean(API_KEY)
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'football-backend' });
});

async function footballRequest(path) {
  if (!API_KEY) {
    const error = new Error('Football API key is not configured. Add API_SPORTS_KEY in Render environment variables.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'x-apisports-key': API_KEY,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(`Football provider returned HTTP ${response.status}`);
    error.status = response.status;
    error.provider = data;
    throw error;
  }

  return data;
}

app.get('/api/football/status', async (_req, res) => {
  try {
    const data = await footballRequest('/status');
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/countries', async (_req, res) => {
  try {
    res.json(await footballRequest('/countries'));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/leagues', async (req, res) => {
  try {
    const params = new URLSearchParams();
    for (const key of ['id', 'name', 'country', 'code', 'season', 'type', 'current', 'search']) {
      if (req.query[key]) params.set(key, String(req.query[key]));
    }
    res.json(await footballRequest(`/leagues${params.toString() ? `?${params}` : ''}`));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/fixtures', async (req, res) => {
  try {
    const params = new URLSearchParams();
    for (const key of ['id', 'live', 'date', 'league', 'season', 'team', 'last', 'next', 'from', 'to', 'status', 'timezone']) {
      if (req.query[key]) params.set(key, String(req.query[key]));
    }
    res.json(await footballRequest(`/fixtures${params.toString() ? `?${params}` : ''}`));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/today', async (req, res) => {
  try {
    const timezone = String(req.query.timezone || 'Africa/Lagos');
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const params = new URLSearchParams({ date, timezone });
    res.json(await footballRequest(`/fixtures?${params}`));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/live', async (_req, res) => {
  try {
    res.json(await footballRequest('/fixtures?live=all'));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/fixture/:id', async (req, res) => {
  try {
    res.json(await footballRequest(`/fixtures?id=${encodeURIComponent(req.params.id)}`));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.get('/api/football/standings', async (req, res) => {
  try {
    const params = new URLSearchParams();
    for (const key of ['league', 'season', 'team']) {
      if (req.query[key]) params.set(key, String(req.query[key]));
    }
    res.json(await footballRequest(`/standings?${params}`));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Football backend listening on port ${PORT}`);
  console.log(`Football provider: ${API_BASE_URL}`);
  console.log(`Football API key configured: ${Boolean(API_KEY)}`);
});
