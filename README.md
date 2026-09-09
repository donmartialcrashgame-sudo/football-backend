# Football Backend

A clean, lightweight Node.js backend whose first job is to fetch football data.

## Current goal

Get the football provider connected and verify that real football data can be returned before adding databases, authentication, wallets, betting logic, or other platform features.

## Stack

- Node.js 20+
- Express
- API-Football / API-Sports
- Native `fetch`

## Render

Use these settings:

- **Build Command:** `npm install`
- **Start Command:** `npm start`

Environment variable:

- `API_SPORTS_KEY` = your API-Football/API-Sports key

Optional:

- `PORT` = Render supplies this automatically
- `FOOTBALL_API_BASE_URL` = `https://v3.football.api-sports.io`

Do not commit your real API key to GitHub.

## Endpoints

- `GET /`
- `GET /health`
- `GET /api/football/status`
- `GET /api/football/countries`
- `GET /api/football/leagues`
- `GET /api/football/fixtures`
- `GET /api/football/today`
- `GET /api/football/live`
- `GET /api/football/fixture/:id`
- `GET /api/football/standings`

Examples after deployment:

- `/api/football/countries`
- `/api/football/leagues?country=England&season=2025`
- `/api/football/fixtures?date=2026-09-09&timezone=Africa/Lagos`
- `/api/football/live`

## Roadmap

- [x] Create clean backend
- [x] Add health endpoint
- [x] Connect football provider client
- [x] Countries endpoint
- [x] Leagues endpoint
- [x] Fixtures endpoint
- [x] Today endpoint
- [x] Live matches endpoint
- [x] Fixture details endpoint
- [x] Standings endpoint
- [ ] Store football data in our own database
- [ ] Add teams
- [ ] Add players
- [ ] Add match statistics
- [ ] Add betting markets
- [ ] Build our own odds engine
- [ ] Add live market updates
- [ ] Add bet slip
- [ ] Add betting logic

## Important

This repository intentionally starts simple. We will add one feature at a time and verify each stage before moving to the next one.
