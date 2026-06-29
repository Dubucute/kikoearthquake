# JaviAlert — Earthquake Safety PWA

A progressive web app that monitors nearby earthquakes using USGS data and provides safety alerts in Tagalog through Javi, a friendly Filipino character.

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
   - Vercel will deploy instantly — your app is live at `https://kikoearthquake.vercel.app`
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
