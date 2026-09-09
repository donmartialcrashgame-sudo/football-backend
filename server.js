const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// The Odds API is used as Betvora's football match/event source.
// Betvora's own WebSocket odds engine will handle displayed pricing later.
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

// The Odds API requires an exact sport key such as soccer_epl.
// Never assume that "soccer" is a valid sport key.
async function getSoccerSports() {
  const sports = await oddsApiRequest('/sports');
  return sports.filter((sport) =>
    sport.group === 'Soccer' &&
    sport.active === true &&
    sport.has_outrights !== true
  );
}

// List every currently available sport from The Odds API.
app.get('/api/odds/sports', async (_req, res) => {
  try {
    res.json(await oddsApiRequest('/sports'));
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      provider: error.provider || null
    });
  }
});

// List only active soccer competitions with their real API sport keys.
app.get('/api/odds/football/leagues', async (_req, res) => {
  try {
    const leagues = await getSoccerSports();
    res.json(leagues);
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      provider: error.provider || null
    });
  }
});

// Fetch events for one exact sport key.
// Example: /api/odds/football?sport=soccer_epl
app.get('/api/odds/football', async (req, res) => {
  try {
    const requestedSport = req.query.sport ? String(req.query.sport) : null;
    const query = {};

    if (req.query.dateFormat) query.dateFormat = String(req.query.dateFormat);
    if (req.query.commenceTimeFrom) query.commenceTimeFrom = String(req.query.commenceTimeFrom);
    if (req.query.commenceTimeTo) query.commenceTimeTo = String(req.query.commenceTimeTo);

    if (requestedSport) {
      const data = await oddsApiRequest(`/sports/${encodeURIComponent(requestedSport)}/events`, query);
      return res.json(data);
    }

    // No league supplied: collect events from all active soccer competitions.
    // The /events endpoint does not consume usage quota.
    const soccerSports = await getSoccerSports();
    const results = await Promise.all(
      soccerSports.map(async (sport) => {
        const events = await oddsApiRequest(`/sports/${encodeURIComponent(sport.key)}/events`, query);
        return events.map((event) => ({
          ...event,
          sport_key: event.sport_key || sport.key,
          sport_title: event.sport_title || sport.title
        }));
      })
    );

    const events = results
      .flat()
      .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));

    res.json(events);
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      provider: error.provider || null
    });
  }
});

// Fetch scores for one exact sport key.
// Example: /api/odds/football/scores?sport=soccer_epl
app.get('/api/odds/football/scores', async (req, res) => {
  try {
    const requestedSport = req.query.sport ? String(req.query.sport) : null;
    const query = {};

    if (req.query.daysFrom) query.daysFrom = String(req.query.daysFrom);
    if (req.query.dateFormat) query.dateFormat = String(req.query.dateFormat);

    if (requestedSport) {
      const data = await oddsApiRequest(`/sports/${encodeURIComponent(requestedSport)}/scores`, query);
      return res.json(data);
    }

    // Scores are only supported for selected sports. If no sport is supplied,
    // try all active soccer competitions and keep successful responses.
    const soccerSports = await getSoccerSports();
    const results = await Promise.allSettled(
      soccerSports.map((sport) => oddsApiRequest(`/sports/${encodeURIComponent(sport.key)}/scores`, query))
    );

    const scores = results
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value);

    scores.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
    res.json(scores);
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      provider: error.provider || null
    });
  }
});

// Find an event across a supplied sport or, if no sport is supplied, across
// all active soccer competitions.
app.get('/api/odds/event/:id', async (req, res) => {
  try {
    const eventId = String(req.params.id);
    const requestedSport = req.query.sport ? String(req.query.sport) : null;

    if (requestedSport) {
      const events = await oddsApiRequest(`/sports/${encodeURIComponent(requestedSport)}/events`, {});
      const event = events.find((item) => String(item.id) === eventId);

      if (!event) {
        return res.status(404).json({ ok: false, error: 'Football event not found' });
      }

      return res.json(event);
    }

    const soccerSports = await getSoccerSports();
    const results = await Promise.allSettled(
      soccerSports.map((sport) => oddsApiRequest(`/sports/${encodeURIComponent(sport.key)}/events`, {}))
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const event = result.value.find((item) => String(item.id) === eventId);
      if (event) return res.json(event);
    }

    res.status(404).json({ ok: false, error: 'Football event not found' });
  } catch (error) {
    res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      provider: error.provider || null
    });
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
