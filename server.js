const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// The Odds API is used only as the football match/event source for Betvora.
// Keep the API key server-side in Render environment variables.
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'betvora-football-backend',
    message: 'Betvora football backend is running',
    oddsApiConfigured: Boolean(ODDS_API_KEY)
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'betvora-football-backend' });
});

async function oddsApiRequest(path, query = {}) {
  if (!ODDS_API_KEY) {
    const error = new Error('Odds API key is not configured. Add ODDS_API_KEY in Render environment variables.');
    error.status = 500;
    throw error;
  }

  const params = new URLSearchParams({ apiKey: ODDS_API_KEY, ...query });
  const response = await fetch(`${ODDS_API_BASE_URL}${path}?${params}`);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(`Odds provider returned HTTP ${response.status}`);
    error.status = response.status;
    error.provider = data;
    throw error;
  }

  return data;
}

// List available sports from The Odds API.
app.get('/api/odds/sports', async (_req, res) => {
  try {
    res.json(await oddsApiRequest('/sports'));
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

// Fetch football/soccer events. This route intentionally does not use
// bookmaker odds; Betvora's own odds engine/WebSocket will handle pricing.
app.get('/api/odds/football', async (req, res) => {
  try {
    const sport = String(req.query.sport || 'soccer');
    const query = {};

    if (req.query.dateFormat) query.dateFormat = String(req.query.dateFormat);
    if (req.query.daysFrom) query.daysFrom = String(req.query.daysFrom);

    // The API requires a region/markets selection when requesting odds.
    // For fixture discovery, use the scores/events endpoint below instead.
    const data = await oddsApiRequest(`/sports/${encodeURIComponent(sport)}/events`, query);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

// Upcoming/live football scores and event state. Useful for matching the
// WebSocket odds engine to the correct event IDs.
app.get('/api/odds/football/scores', async (req, res) => {
  try {
    const sport = String(req.query.sport || 'soccer');
    const query = {};
    if (req.query.daysFrom) query.daysFrom = String(req.query.daysFrom);
    if (req.query.dateFormat) query.dateFormat = String(req.query.dateFormat);

    const data = await oddsApiRequest(`/sports/${encodeURIComponent(sport)}/scores`, query);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, provider: error.provider || null });
  }
});

// Event-specific fixture lookup. The returned event ID can be used by the
// Betvora odds engine as its stable match reference.
app.get('/api/odds/event/:id', async (req, res) => {
  try {
    const sport = String(req.query.sport || 'soccer');
    const events = await oddsApiRequest(`/sports/${encodeURIComponent(sport)}/events`, {});
    const event = events.find((item) => String(item.id) === String(req.params.id));

    if (!event) {
      return res.status(404).json({ ok: false, error: 'Football event not found' });
    }

    res.json(event);
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
  console.log(`Betvora football backend listening on port ${PORT}`);
  console.log(`Odds provider: ${ODDS_API_BASE_URL}`);
  console.log(`Odds API key configured: ${Boolean(ODDS_API_KEY)}`);
});
