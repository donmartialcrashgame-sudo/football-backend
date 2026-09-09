const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// API-Football / API-Sports configuration.
// Keep the real key only in Render environment variables.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_BASE_URL = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'betvora-football-backend',
    provider: 'API-Football',
    message: 'Betvora football backend is running',
    apiFootballConfigured: Boolean(API_FOOTBALL_KEY)
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'betvora-football-backend',
    provider: 'API-Football',
    apiFootballConfigured: Boolean(API_FOOTBALL_KEY)
  });
});

async function footballRequest(path, query = {}) {
  if (!API_FOOTBALL_KEY) {
    const error = new Error('API-Football key is not configured. Add API_FOOTBALL_KEY in Render environment variables.');
    error.status = 500;
    throw error;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }

  const url = `${API_FOOTBALL_BASE_URL}${path}${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url, {
    headers: {
      'x-apisports-key': API_FOOTBALL_KEY,
      'Accept': 'application/json'
    }
  });

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(`API-Football returned HTTP ${response.status}`);
    error.status = response.status;
    error.provider = data;
    throw error;
  }

  if (data && data.errors && Object.keys(data.errors).length > 0) {
    const error = new Error('API-Football returned an API error');
    error.status = 502;
    error.provider = data.errors;
    throw error;
  }

  return data || { get: path, parameters: query, errors: {}, results: 0, response: [] };
}

function handleError(res, error) {
  res.status(error.status || 500).json({
    ok: false,
    error: error.message,
    provider: error.provider || null
  });
}

// -----------------------------------------------------------------------------
// API-Football routes used by Betvora
// -----------------------------------------------------------------------------

// Football competitions. Optional: ?country=Nigeria or ?season=2026
app.get('/api/football/leagues', async (req, res) => {
  try {
    const query = {};
    if (req.query.id) query.id = req.query.id;
    if (req.query.name) query.name = req.query.name;
    if (req.query.country) query.country = req.query.country;
    if (req.query.code) query.code = req.query.code;
    if (req.query.season) query.season = req.query.season;
    res.json(await footballRequest('/leagues', query));
  } catch (error) {
    handleError(res, error);
  }
});

// Fixtures. Examples:
// /api/football/fixtures?league=39&season=2026
// /api/football/fixtures?date=2026-09-09
// /api/football/fixtures?next=20
app.get('/api/football/fixtures', async (req, res) => {
  try {
    const allowed = [
      'id', 'ids', 'live', 'date', 'league', 'season', 'team', 'last',
      'next', 'from', 'to', 'round', 'status', 'timezone'
    ];
    const query = {};
    for (const key of allowed) {
      if (req.query[key] !== undefined) query[key] = req.query[key];
    }
    res.json(await footballRequest('/fixtures', query));
  } catch (error) {
    handleError(res, error);
  }
});

// Current live fixtures.
app.get('/api/football/live', async (req, res) => {
  try {
    const query = { live: 'all' };
    if (req.query.league) query.league = req.query.league;
    if (req.query.season) query.season = req.query.season;
    if (req.query.timezone) query.timezone = req.query.timezone;
    res.json(await footballRequest('/fixtures', query));
  } catch (error) {
    handleError(res, error);
  }
});

// Teams. Example: /api/football/teams?league=39&season=2026
app.get('/api/football/teams', async (req, res) => {
  try {
    const query = {};
    if (req.query.id) query.id = req.query.id;
    if (req.query.name) query.name = req.query.name;
    if (req.query.league) query.league = req.query.league;
    if (req.query.season) query.season = req.query.season;
    if (req.query.country) query.country = req.query.country;
    res.json(await footballRequest('/teams', query));
  } catch (error) {
    handleError(res, error);
  }
});

// League standings.
app.get('/api/football/standings', async (req, res) => {
  try {
    const query = {};
    if (req.query.league) query.league = req.query.league;
    if (req.query.season) query.season = req.query.season;
    if (req.query.team) query.team = req.query.team;
    res.json(await footballRequest('/standings', query));
  } catch (error) {
    handleError(res, error);
  }
});

// Match events: goals, cards, substitutions, VAR, etc.
app.get('/api/football/events', async (req, res) => {
  try {
    if (!req.query.fixture) {
      return res.status(400).json({ ok: false, error: 'fixture is required' });
    }
    const query = { fixture: req.query.fixture };
    if (req.query.team) query.team = req.query.team;
    res.json(await footballRequest('/fixtures/events', query));
  } catch (error) {
    handleError(res, error);
  }
});

// Match statistics.
app.get('/api/football/statistics', async (req, res) => {
  try {
    if (!req.query.fixture) {
      return res.status(400).json({ ok: false, error: 'fixture is required' });
    }
    const query = { fixture: req.query.fixture };
    if (req.query.team) query.team = req.query.team;
    res.json(await footballRequest('/fixtures/statistics', query));
  } catch (error) {
    handleError(res, error);
  }
});

// -----------------------------------------------------------------------------
// Compatibility routes for the current Betvora frontend.
// These now return API-Football data instead of The Odds API data.
// -----------------------------------------------------------------------------

app.get('/api/odds/sports', async (_req, res) => {
  try {
    res.json((await footballRequest('/leagues')).response || []);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/odds/football/leagues', async (req, res) => {
  try {
    const query = {};
    if (req.query.country) query.country = req.query.country;
    if (req.query.season) query.season = req.query.season;
    res.json((await footballRequest('/leagues', query)).response || []);
  } catch (error) {
    handleError(res, error);
  }
});

// Keep the existing frontend endpoint alive. `sport` can now be an API-Football
// league ID (for example 39 for the Premier League), while no sport returns
// upcoming fixtures from API-Football.
app.get('/api/odds/football', async (req, res) => {
  try {
    const query = {};
    if (req.query.sport) query.league = req.query.sport;
    if (req.query.season) query.season = req.query.season;
    if (req.query.date) query.date = req.query.date;
    if (req.query.from) query.from = req.query.from;
    if (req.query.to) query.to = req.query.to;
    if (!query.league && !query.date && !query.next && !query.last) query.next = 20;
    res.json((await footballRequest('/fixtures', query)).response || []);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/odds/football/scores', async (req, res) => {
  try {
    const query = { live: 'all' };
    if (req.query.sport) query.league = req.query.sport;
    if (req.query.season) query.season = req.query.season;
    res.json((await footballRequest('/fixtures', query)).response || []);
  } catch (error) {
    handleError(res, error);
  }
});

// Find a fixture by ID.
app.get('/api/odds/event/:id', async (req, res) => {
  try {
    const data = await footballRequest('/fixtures', { id: req.params.id });
    const fixture = (data.response || [])[0];
    if (!fixture) return res.status(404).json({ ok: false, error: 'Football fixture not found' });
    res.json(fixture);
  } catch (error) {
    handleError(res, error);
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
  console.log(`Betvora football backend listening on port ${PORT}`);
  console.log(`Football provider: ${API_FOOTBALL_BASE_URL}`);
  console.log(`API-Football key configured: ${Boolean(API_FOOTBALL_KEY)}`);
});
