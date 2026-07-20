# JaviAlert — Earthquake Safety PWA

A progressive web app that monitors nearby earthquakes using PHIVOLCS data (with USGS as fallback) and provides safety alerts in Tagalog, English, or Cebuano through Javi, a friendly Filipino character.

## AI Provider Configuration

Javi tries multiple AI providers in order until one succeeds. Set any combination of these API keys in Vercel — the more you configure, the more reliable Javi becomes.

### Provider Chain (tried in order)

| Order | Provider | Env Variable | Notes |
|-------|----------|--------------|-------|
| 1st | **NVIDIA NIM** | `NVIDIA_API_KEY` | Fastest — try this first |
| 2nd | **Google AI Studio** | `GOOGLE_AI_STUDIO_API_KEY` | Gemini 2.5 Flash |

Both support streaming responses. If all fail, Javi gives a fallback response from built-in messages.

## Features

- **Real-time earthquake monitoring** — PHIVOLCS primary, USGS fallback, auto-refreshes every 5 minutes
- **Location-based alerts** — detects your location via GPS or search, shows nearest earthquakes
- **AI-powered chat** — ask Javi anything about earthquakes, safety, or preparedness (streaming responses)
- **Push notifications** — browser + server-side push for new quakes, filtered by distance from you
- **PWA installable** — works offline with service worker caching
- **Earthquake map** — Leaflet map with time/magnitude filters
- **Safety quiz** — test your earthquake knowledge (Tagalog, English, Cebuano)
- **Safety tips & emergency hotlines** — built-in guidance for during/after quakes
- **Background music** — ambient tracks with play/pause/shuffle controls
- **Multi-language** — Tagalog, English, Cebuano with auto-detection
- **Dark mode** — toggle in settings
- **Safety levels** — Safe (green), Warning (yellow), Danger (red) based on magnitude + distance + intensity

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
   - Select your repository
   - Click **Import**

3. **Configure**
   - Framework Preset: **Other**
   - Build Command: leave empty
   - Output Directory: `.`
   - Click **Deploy**

4. **Set Environment Variables** (optional but recommended)
   - `NVIDIA_API_KEY` — get from [NVIDIA NIM](https://build.nvidia.com/)
   - `GOOGLE_AI_STUDIO_API_KEY` — get from [Google AI Studio](https://aistudio.google.com/)
   - `MONGODB_URI` — for push notification subscriber storage (MongoDB Atlas)
   - `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — for Web Push (generate with `npm run generate-keys`)

5. **Set up Cron** (for push notifications when app is closed)
   - Go to your Vercel project ? **Storage ? Cron Jobs**
   - Add a cron: `*/5 * * * *` (every 5 minutes) pointing to `/api/cron-check?token=YOUR_CRON_SECRET`
   - Set `CRON_SECRET` in your Vercel environment variables

### Custom Domain (optional)

- Go to your project dashboard on Vercel
- Click **Settings ? Domains**
- Add your custom domain and follow DNS instructions

## Tech Stack

- **Vanilla HTML/CSS/JS** — no frameworks
- **PHIVOLCS** — primary earthquake data (Philippines)
- **USGS** — fallback earthquake data
- **Google Gemini 2.5 Flash** — AI chat (primary)
- **NVIDIA NIM** — AI chat (fastest fallback)
- **MongoDB** — push subscription storage
- **Leaflet** — earthquake map
- **Lucide Icons** — SVG icon library
- **Nominatim** — reverse geocoding for location names
- **Service Worker** — offline caching + push handling

## Project Structure

```
/
+-- index.html              # Main app HTML
+-- app.js                  # Main app logic (JaviAlertApp class)
+-- audio.js                # Alert sounds + background music player
+-- api-utils.js            # Earthquake data helpers, distance calc, PHIVOLCS intensity
+-- messages.js             # Javi messages, reactions, safety tips, changelog
+-- quiz-questions.js       # Quiz questions (Tagalog + English)
+-- style.css               # All styles (cartoon theme, dark mode, responsive)
+-- sw.js                   # Service worker (cache, push, offline)
+-- manifest.json           # PWA manifest
+-- vercel.json             # Vercel config (rewrites, headers, function timeouts)
+-- package.json            # Dependencies + scripts
+-- api/
¦   +-- ask-javi.js         # AI chat endpoint (streaming SSE)
¦   +-- cron-check.js       # Server-side earthquake checker + push sender
¦   +-- health.js           # AI provider health check
¦   +-- phivolcs-quakes.js  # PHIVOLCS HTML scraper
¦   +-- push-send.js        # Send push notification to subscribers
¦   +-- push-subscribe.js   # Subscribe/unsubscribe push
¦   +-- push-public-key.js  # Return VAPID public key
¦   +-- _db.js              # MongoDB connection manager
+-- icons/                  # App icons (javi-icon.png, javi-avatar.png)
+-- sounds/                 # MP3 audio files (alert, ambient tracks)
+-- javi/                   # Character images (PNG reactions)
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ask-javi` | POST | AI chat with streaming SSE response |
| `/api/phivolcs-quakes` | GET | Fetch latest PHIVOLCS earthquakes |
| `/api/cron-check` | GET | Server-side cron (check quakes + send pushes) |
| `/api/push-subscribe` | POST/DELETE | Subscribe or unsubscribe push notifications |
| `/api/push-send` | POST | Send push notification to subscribers |
| `/api/push-public-key` | GET | Return VAPID public key |
| `/api/health` | GET | Check AI provider status |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | No | NVIDIA NIM API key for AI chat |
| `GOOGLE_AI_STUDIO_API_KEY` | No | Google AI Studio API key for AI chat |
| `MONGODB_URI` | Yes* | MongoDB Atlas connection string for push subscriptions |
| `VAPID_PUBLIC_KEY` | Yes* | Web Push public key |
| `VAPID_PRIVATE_KEY` | Yes* | Web Push private key |
| `CRON_SECRET` | No | Secret token for cron endpoint authentication |

*Required for push notifications. The app works without these — just no server-side alerts.
