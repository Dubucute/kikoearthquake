# JaviAlert — Earthquake Safety PWA

A progressive web app that monitors nearby earthquakes using USGS data and provides safety alerts in Tagalog through Javi, a friendly Filipino character.

## AI provider configuration

Javi tries multiple AI providers in order until one succeeds. Set any combination of these API keys in Vercel — the more you configure, the more reliable Javi becomes.

### Provider chain (tried in order)

| Order | Provider | Env variable(s) | Limit | Notes |
|---|---|---|---|---|
| 1st | **NVIDIA** | `NVIDIA_API_KEY` | RPM only, no daily cap | Fastest, try this first |
| 2nd | **Groq** | `GROQ_API_KEY` | Daily + RPM | Very fast inference |
| 3rd | **Google AI Studio** | `GOOGLE_AI_STUDIO_API_KEY` (or `GEMINI_API_KEY`), `GOOGLE_AI_STUDIO_MODEL` | Daily | Model defaults to `gemini-2.0-flash` |
| 4th | **Hugging Face** | `HF_TOKEN` | Rate-limited | Final fallback |

All four are tried in that order. The first one to return a reply wins. If all fail, Javi tells the user to try again later.

## Features

- **Real-time earthquake monitoring** — polls USGS API every 5 minutes
- **Location-based alerts** — detects your location and shows nearest earthquakes
- **AI-powered messages** — Javi gives safety updates in Tagalog via OpenRouter (free model)
- **PWA installable** — works offline with service worker caching
- **Pagination** — browse earthquakes 10 per page
- **Safety levels** — Safe (green), Warning (yellow), Danger (red) based on magnitude and distance

## Deploy to Vercel

### Prerequisites

1. A [GitHub](https://github.com) account
2. A [Vercel](https://vercel.com) account (sign in with GitHub)

### Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click **Continue with GitHub**
   - Select the `kikoearthquake` repository
   - Click **Import**

3. **Configure (no changes needed)**
   - Framework Preset: **Other** (auto-detected as static)
   - Build Command: leave empty
   - Output Directory: leave as `.`
   - Click **Deploy**

4. **Done!**
   - Vercel will deploy instantly — your app is live at `https://javi-alert.vercel.app`
   - Every push to `main` auto-deploys

### Custom Domain (optional)

- Go to your project dashboard on Vercel
- Click **Settings → Domains**
- Add your custom domain and follow DNS instructions

## Tech Stack

- **Vanilla HTML/CSS/JS** — no frameworks
- **USGS Earthquake API** — real-time seismic data
- **OpenRouter (owl-alpha)** — free AI for Javi's messages
- **Lucide Icons** — SVG icon library
- **Nominatim** — reverse geocoding for location names
- **Service Worker** — offline caching

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main app (HTML + CSS + JS) |
| `sw.js` | Service worker for offline support |
| `manifest.json` | PWA manifest |
| `icons/` | App icons for PWA |
