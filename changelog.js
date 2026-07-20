/**
 * Changelog — version history for JaviAlert.
 * Split from messages.js to keep that file focused on content.
 */
export const CHANGELOG = [ { ver: 'v1.150', date: '2026-07-20', items: [
    'New: Split app.js into 6 module files (modules/chat.js, map.js, quiz.js, analysis.js, share.js, settings.js)',
    'Fix: Chat history now clears when older than 24 hours',
    'Fix: Removed ~2500 lines of dead code from app.js',
    'New: Changelog moved to separate changelog.js file',
    'Updated: Service worker cache bumped to v1.150'
  ]},
  { ver: 'v1.149', date: '2026-07-20', items: [
    'New: Modern cartoon redesign — cartoon-style borders, shadows, rounded speech bubble',
    'New: Furry Javi character concept with cartoon char-card and pill status indicator',
    'New: Animated clouds (8 cloud layers, gentle drift animation) and sun/moon sky elements',
    'New: Decorative sparkle effects on character card and Javi tap',
    'New: Breathing animation on character (iosBreathe)',
    'Updated: Service worker cache bumped to v1.149'
  ]},
  { ver: 'v1.148', date: '2026-07-20', items: [
    'Change: Restored pull-to-refresh on iOS (Safari chrome) — removed overscroll-behavior:contain',
    'Updated: Service worker cache bumped to v1.148'
  ]},
  { ver: 'v1.147', date: '2026-07-20', items: [
    'Fix: Typing indicator now stays visible until first streaming token arrives',
    'Updated: Service worker cache bumped to v1.147'
  ]},
  { ver: 'v1.146', date: '2026-07-20', items: [
    'Fix: Typing indicator now stays visible until first streaming token arrives',
    'Updated: Service worker cache bumped to v1.146'
  ]},
  { ver: 'v1.145', date: '2026-07-20', items: [
    'New: Streaming SSE responses — Javi\'s replies now appear word-by-word as generated',
    'Change: Stripped AI providers to only Google Gemini and NVIDIA NIM (faster + free)',
    'Change: NVIDIA NIM now uses openai/gpt-oss-20b, meta/llama-3.1-8b-instruct, nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'Updated: Service worker cache bumped to v1.145'
  ]},
  { ver: 'v1.144', date: '2026-07-06', items: [
    'Fix: Removed pull-to-refresh — now using the manual refresh button instead',
    'Updated: Service worker cache bumped to v1.144'
  ]},
  { ver: 'v1.143', date: '2026-07-06', items: [
    'Fix: Today shake counter now resets at local midnight instead of using a rolling 24-hour window',
    'Updated: Service worker cache bumped to v1.143'
  ]},
  { ver: 'v1.142', date: '2026-07-06', items: [
    'New: Push notifications now filter by distance — you\'ll only get alerts for earthquakes near your location',
    'New: Subscriber location (lat/lon) stored at subscription time for distance-based filtering',
    'New: Server-side filtering in cron and push-send endpoints using haversine distance calculation',
    'Fix: Subscribers far from the quake no longer receive irrelevant push notifications',
    'Updated: Service worker cache bumped to v1.142'
  ]},
  { ver: 'v1.141', date: '2026-07-06', items: [
    'Fix: Notification format changed to "Mag 3.2 — Place · 10km deep" (cleaner, includes depth)',
    'Fix: Removed redundant browser notification from _alertNewQuakes — cron push already handles it',
    'Fix: Added _fromCronPush flag so _triggerServerPush skips when refresh came from cron push',
    'Fix: No more triple notifications — only in-app toast + single push notification per new quake',
    'Updated: Service worker cache bumped to v1.141'
  ]},
  { ver: 'v1.140', date: '2026-07-06', items: [
    'Fix: Prevent double sound/voice when push notification is tapped while app is already open',
    'Fix: Added 10s cooldown (_lastAlertTime) to prevent alert sound playing twice',
    'Updated: Service worker cache bumped to v1.140'
  ]},
  { ver: 'v1.139', date: '2026-07-06', items: [
    'Fix: Push notification now plays alert sound even when app is closed',
    'Fix: Clicking a push notification opens the app and plays the correct alert sound automatically',
    'Updated: Service worker cache bumped to v1.139'
  ]},
  { ver: 'v1.138', date: '2026-07-06', items: [
    'Fix: Removed grid layout — single column centered layout for desktop (600px/680px)',
    'Fix: All content now flows naturally without disconnected pieces or extra gaps',
    'Updated: Service worker cache bumped to v1.138'
  ]},
  { ver: 'v1.137', date: '2026-07-06', items: [
    'Fix: messages.js syntax error resolved — restored missing changelog entry',
    'Updated: Service worker cache bumped to v1.137'
  ]},
  { ver: 'v1.136', date: '2026-07-06', items: [
    'New: Desktop hover effects on buttons, quake items, and interactive elements',
    'Fix: Desktop layout now uses compact phone-width form instead of stretched wide layout',
    'Updated: Service worker cache bumped to v1.136'
  ]},
  { ver: 'v1.135', date: '2026-07-06', items: [
    'New: Desktop layout — wider container, bigger cards/modals, multi-column quake list',
    'New: Responsive media queries at 768px and 1200px breakpoints',
    'Updated: Service worker cache bumped to v1.135'
  ]},
  { ver: 'v1.134', date: '2026-07-06', items: [
    'New: Desktop layout — wider container, bigger cards/modals, multi-column quake list',
    'New: Responsive media queries at 768px and 1200px breakpoints',
    'Updated: Service worker cache bumped to v1.134'
  ]},
  { ver: 'v1.133', date: '2026-07-06', items: [
    'Fix: Clicking address bar now clears the input so you can type right away',
    'Fix: If no autocomplete item is selected, the current address is restored automatically',
    'Updated: Service worker cache bumped to v1.133'
  ]},
  { ver: 'v1.132', date: '2026-07-06', items: [
    'Fix: Custom address from search dropdown now saves properly with cachedAt: Infinity',
    'Fix: GPS no longer overrides manually searched address on next page load',
    'Updated: Service worker cache bumped to v1.132'
  ]},
  { ver: 'v1.131', date: '2026-07-06', items: [
    'Fix: PHIVOLCS HTML parsing now handles multiple date patterns (auto-style99 span, plain link, or direct td text)',
    'Fix: cron-check.js PHIVOLCS parsing also updated with same robust pattern',
    'Change: Javi AI context now includes ALL mag 3+ quakes (not just latest/nearest/strongest)',
    'Updated: Service worker cache bumped to v1.131'
  ]},
  { ver: 'v1.130', date: '2026-07-06', items: [
    'Fix: Cron push notifications only for mag 3+ (no more 2.x alerts)',
    'Change: Notification title always "New earthquake detected" (no count, no emojis)',
    'Change: Notification body format cleaned — no emojis, clean text like "3.2 mag 14km away - Place"',
    'Fix: Test notification button uses notifSound preference (alarm/voice/silent)',
    'Updated: Service worker cache bumped to v1.130'
  ]},
  { ver: 'v1.129', date: '2026-07-06', items: [
    'Change: Major provider overhaul — Google (Gemini 2.5 Flash) is now first provider',
    'New: Added Cerebras (Qwen 3 32B, Llama 4 Scout), Cloudflare (Llama 3.1, Mistral) providers',
    'New: maxTokens bumped to 8192 for top 3 providers, 4096 for rest',
    'Change: OpenRouter models updated (gpt-oss-120b, qwen3-235b, hermes-3-70b, deepseek-v3, nemotron-3-120b)',
    'Change: Groq upgraded to Llama 3.3 70B Versatile',
    'Change: Cloudflare account ID configured with custom callCloudflare function',
    'Change: Google API key env name fixed to GOOGLE_AI_STUDIO_API_KEY',
    'Updated: Service worker cache bumped to v1.129'
  ]},
  { ver: 'v1.128', date: '2026-07-06', items: [
    'Fix: Cebuano replies no longer forced to pure Bisaya — can naturally mix English/Tagalog words',
    'Fix: Pure Tagalog and pure English stay pure (no mixing)',
    'Updated: Service worker cache bumped to v1.128'
  ]},
  { ver: 'v1.127', date: '2026-07-06', items: [
    'Fix: Javi no longer mentions AI providers (NVIDIA, Groq, OpenRouter etc.) — just Javi',
    'New: Javi can say who made the site (J Marlo Pu-od aka Dubu) but only when asked',
    'Updated: Service worker cache bumped to v1.127'
  ]},
  { ver: 'v1.126', date: '2026-07-06', items: [
    'Fix: Javi personality toned down — no more forced corny/playful replies, now natural and to the point',
    'Updated: Service worker cache bumped to v1.126'
  ]},
  { ver: 'v1.125', date: '2026-07-06', items: [
    'Updated: Service worker cache bumped to v1.125'
  ]},
  { ver: 'v1.124', date: '2026-07-06', items: [
    'Change: OpenRouter is now the first AI provider (was NVIDIA) — massive 30B–120B models',
    'New: OpenRouter models — poolside/laguna-m.1:free, nemotron-3-super-120b:free, gpt-oss-120b:free, nemotron-3-nano-30b-reasoning:free',
    'Change: maxTokens increased to 4096 for richer replies',
    'Updated: Service worker cache bumped to v1.124'
  ]},
  { ver: 'v1.123', date: '2026-07-06', items: [
    'Fix: Bisaya playful words now only used when Cebuano detected — no more random Bisaya in Tagalog replies',
    'Fix: Language detection now requires stronger Cebuano signal (min 4 words, at least 2 more than Tagalog)',
    'Updated: Service worker cache bumped to v1.123'
  ]},
  { ver: 'v1.122', date: '2026-07-06', items: [
    'Change: Mixtral 8x7B (NVIDIA) now first model tried in provider chain — smartest model prioritized',
    'Updated: Service worker cache bumped to v1.122'
  ]},
  { ver: 'v1.121', date: '2026-07-06', items: [
    'Fix: Javi playful words changed from English to Bisaya (hala, mao ba, bitaw, sige, nya, aguy, sus, hala oy, aw)',
    'Fix: Reinforced Cebuano language rules in AI system prompt for better Bisaya responses',
    'Updated: Service worker cache bumped to v1.121'
  ]},
  { ver: 'v1.120', date: '2026-07-06', items: [
    'Fix: Cebuano quick reply buttons now show Cebuano text (not English)',
    'Fix: Language detection now runs on every chat message, not just first',
    'Fix: Improved Cebuano vs Tagalog word detection — removed overlapping words',
    'Fix: AI now told explicitly what language the user is writing in',
    'Updated: Service worker cache bumped to v1.120'
  ]},
  { ver: 'v1.119', date: '2026-07-06', items: [
    'New: Toggle to show/hide Safety Tips card on the home screen',
    'Updated: Service worker cache bumped to v1.119'
  ]},
  { ver: 'v1.118', date: '2026-07-06', items: [
    'Fix: Replaced Alarm/Voice/Silent button group with custom dropdown — no more overlap or squish',
    'Updated: Service worker cache bumped to v1.118'
  ]},
  { ver: 'v1.117', date: '2026-07-06', items: [
    'Fix: Sound picker label squished on small screens — label now resists shrink',
    'Fix: Sound picker buttons smaller on mobile (under 400px)',
    'Updated: Service worker cache bumped to v1.117'
  ]},
  { ver: 'v1.116', date: '2026-07-06', items: [
    'Fix: Alarm / Voice / Silent picker text no longer wraps (white-space: nowrap)',
    'Updated: Service worker cache bumped to v1.116'
  ]},
  { ver: 'v1.115', date: '2026-07-06', items: [
    'Fix: Alarm / Voice / Silent picker text alignment in settings',
    'Updated: Service worker cache bumped to v1.115'
  ]},
  { ver: 'v1.114', date: '2026-07-06', items: [
    'New: "Last checked" relative timestamp (Updated X min ago) under quake list',
    'New: Notification sound picker — Alarm / Voice (speech) / Silent',
    'New: Push notifications and browser alerts only for magnitude 3+ earthquakes',
    'New: Javi chat history saved in localStorage (conversation persists across sessions)',
    'Updated: Alert Sound setting changed from toggle to 3-option picker',
    'Updated: Service worker cache bumped to v1.114'
  ]},
  { ver: 'v1.113', date: '2026-07-06', items: [
    'New: OpenRouter provider added (meta-llama/llama-3.1-8b-instruct, mistralai/mistral-7b-instruct)',
    'New: Added google/gemma-2-9b-it and microsoft/phi-3-mini-4k-instruct to OpenRouter',
    'Removed: Cohere provider (bad RP, not OpenAI-compatible)',
    'Removed: Groq gpt-oss-20b (rarely available), HF GLM-5.2 & Kimi-K2 (slow/unreliable)',
    'Optimized: Models trimmed to RP & translation only',
    'Updated: Service worker cache bumped to v1.113'
  ]},
  { ver: 'v1.112', date: '2026-07-06', items: [
    'New: Cohere provider added (command-r-plus-08-2024) as fallback AI',
    'Updated: Groq models to openai/gpt-oss-20b (primary), llama-3.1-8b-instant (fallback)',
    'Updated: NVIDIA models to meta/llama-3.1-8b-instruct (faster)',
    'Updated: HuggingFace models — GLM-5.2:novita as primary',
    'Optimized: Per-provider maxTokens — NVIDIA 1024, Groq 2048, Cohere 1024, HF 1024',
    'Removed: Gemini AI provider (unreliable)',
    'Updated: Service worker cache bumped to v1.112'
  ]},
  { ver: 'v1.110', date: '2026-07-06', items: [
    'Fix: NDRRMC alarm not playing — reverted AudioContext (buffer wasn\'t ready in time)',
    'Fix: Back to HTMLAudioElement for alert — reliable playback on mobile',
    'Kept: Ambient music pauses during alarm, resumes after',
    'Updated: Service worker cache bumped to v1.109'
  ]},
  { ver: 'v1.108', date: '2026-07-05', items: [
    'Fix: NDRRMC alarm now uses Web Audio API — no mobile media controls in notification',
    'New: AudioContext pre-buffers alert sound for instant playback on first tap',
    'Removed: Opening intro track (Sabay-sabay Tayong Bida) — ambient starts directly',
    'Fix: Ambient music pauses during NDRRMC alarm, resumes after',
    'Updated: Service worker cache bumped to v1.108'
  ]},
  { ver: 'v1.107', date: '2026-07-05', items: [
    'New: Warning mood Javi tap shows reassuring messages (wag kabahan)',
    'New: Danger mood Javi tap shows safety tips (DROP, COVER, HOLD ON)',
    'Fix: Notification click now focuses window and navigates to app',
    'Fix: Notification text format — line breaks for readability on iOS/Android',
    'Fix: Added icon, badge, image to push payload for better display',
    'Fix: iOS notification — removed vibrate/requireInteraction (unsupported)',
    'New: Reassuring warning messages in all 3 languages (TL/EN/CEB)',
    'Updated: Service worker cache bumped to v1.107'
  ]},
  { ver: 'v1.72', date: '2026-07-05', items: [
    'New: Earthquake map time filter — show 24h / 3 days / 7 days / 30 days',
    'New: Earthquake map magnitude filter dropdown',
    'New: Quake list column labels — Mag / Int / Location / Away',
    'Fix: Map only shows quakes within 300km of user',
    'Updated: Service worker cache bumped to v1.72'
  ]},  { ver: 'v1.68', date: '2026-07-05', items: [
    'New: PHIVOLCS Intensity Scale (PEIS) — each quake shows intensity (I-X) based on mag + distance',
    'New: Tiered distance filter — mag ≥5 always shown, smaller quakes closer to you',
    'New: Intensity badges on quake list and detail modal',
    'New: Notifications show intensity label (e.g. "III — Weak — 2.6 mag at Glan")',
    'Fix: Mood detection now uses intensity instead of raw magnitude',
    'Fix: Quake list no longer shows all nationwide quakes — only relevant ones near you',
    'Updated: Service worker cache bumped to v1.68'
  ]},
  { ver: 'v1.67', date: '2026-07-05', items: [
    'Fix: PHIVOLCS results now filtered by 500km radius from your location (was showing all nationwide)',
    'Updated: Service worker cache bumped to v1.67'
  ]},
  { ver: 'v1.66', date: '2026-07-05', items: [
    'Fix: PHIVOLCS API SSL cert issue — added rejectUnauthorized:false for PHIVOLCS self-signed cert',
    'Updated: Service worker cache bumped to v1.66'
  ]},
  { ver: 'v1.65', date: '2026-07-05', items: [
    'Fix: PHIVOLCS API on Vercel — switched to Node.js https module (Vercel fetch can\'t reach PHIVOLCS)',
    'Updated: Service worker cache bumped to v1.65'
  ]},
  { ver: 'v1.64', date: '2026-07-05', items: [
    'New: PHIVOLCS as primary earthquake data source — more accurate for PH',
    'New: /api/phivolcs-quakes — serverless parser that scrapes PHIVOLCS HTML table into live quake data',
    'New: USGS fallback — auto-falls back to USGS if PHIVOLCS is unreachable or returns no data',
    'Fix: Location distance now computed from real PHIVOLCS coordinates (not hardcoded text)',
    'Updated: Service worker cache bumped to v1.64'
  ]},
  { ver: 'v1.63', date: '2026-07-05', items: [
    'New: Javi Chat Head — floating draggable button on screen (like Messenger)',
    'New: Chat Head drag with edge-snap — position saved across sessions',
    'New: Unread badge on Chat Head when Javi replies while chat is closed',
    'New: Notification popup on Chat Head — shows preview of Javi\'s reply or earthquake alert',
    'New: Popup auto-positions LEFT or RIGHT based on where Chat Head is on screen',
    'New: Fullscreen mode for Ask Javi chat — expand to fill entire screen',
    'New: Quick reply buttons that send real messages to Javi (not modals)',
    'New: Proactive earthquake alerts pushed to chat with Chat Head notification',
    'New: Javi chat memory (localStorage) — remembers your last 3 topics for 1 hour',
    'New: Typewriter effect with blinking cursor on Javi\'s replies',
    'New: Language detection — auto-switches app language based on your first message',
    'New: Fallback mode — Javi still responds when AI providers are down',
    'New: Health check endpoint (/api/health) to monitor AI provider status',
    'Fix: Quick reply buttons no longer appear above user messages',
    'Fix: Chat modal background no longer scrolls behind the popup',
    'Fix: Chat Head drag no longer opens chat or scrolls page on mobile',
    'Fix: Settings modal is now scrollable (no longer overflows screen)',
    'Fix: Chat Head icon and avatar are perfectly circular (overflow hidden)',
    'Fix: Share image icon uses crisp circular clipping',
    'Updated: AI provider chain — NVIDIA → Groq → Google AI Studio → Hugging Face',
    'Updated: System prompt fixes — correct language matching, limited emoji usage',
    'Updated: Service worker cache bumped to v1.63'
  ]},
  { ver: 'v1.33', date: '2026-07-04', items: [
    'Fix: Javi character uses PNG only (no more GIFs for smoother performance)',
    'Updated: Service worker cache version bumped to v1.33'
  ]},
  { ver: 'v1.32', date: '2026-07-04', items: [
    'New: Music player progress bar with mood color accent',
    'New: Play/Pause, Mode, Next buttons grouped together',
    'Fix: Music no longer auto-plays — tap play to start',
    'Fix: Now-playing bar always visible (never disappears)',
    'Updated: Service worker cache version bumped to v1.32'
  ]},
  { ver: 'v1.31', date: '2026-07-04', items: [
    'Fix: Loading screen now stays visible during app update — shows updating message until reload',
    'Updated: Service worker cache version bumped to v1.31'
  ]},
  { ver: 'v1.30', date: '2026-07-04', items: [
    'New: Javi adapts to what you ask — helps with assignments, chats about life, or talks about quakes!',
    'Updated: Service worker cache version bumped to v1.30'
  ]},
  { ver: 'v1.29', date: '2026-07-04', items: [
    'New: Javi now talks like a playful little kid — short, cute, childlike replies!',
    'Updated: Service worker cache version bumped to v1.29'
  ]},
  { ver: 'v1.28', date: '2026-07-04', items: [
    'Fix: Ask Javi server error fixed — model fallback now works correctly',
    'Updated: Service worker cache version bumped to v1.28'
  ]},
  { ver: 'v1.27', date: '2026-07-04', items: [
    'New: Ask Javi now tries up to 4 different AI models if one fails — better reliability!',
    'Updated: Service worker cache version bumped to v1.27'
  ]},
  { ver: 'v1.26', date: '2026-07-04', items: [
    'New: Ask Javi can now chat about ANY topic — life, feelings, random fun, not just earthquakes!',
    'Updated: Service worker cache version bumped to v1.26'
  ]},
  { ver: 'v1.25', date: '2026-07-04', items: [
    'New: Ask Javi now knows the latest earthquakes — ask about recent quakes get real-time data!',
    'Updated: Service worker cache version bumped to v1.25'
  ]},
  { ver: 'v1.24', date: '2026-07-04', items: [
    'New: Test Notification button in Settings (debug — sends browser + push + in-app toast)',
    'Updated: Service worker cache version bumped to v1.24'
  ]},
  { ver: 'v1.23', date: '2026-07-04', items: [
    'New: Push notification toggle now properly turns notifications ON/OFF',
    'New: Disabling push unsubscribes from server (saves battery/data)',
    'New: Disabled state survives page reload (saved in your device)',
    'Updated: Service worker cache version bumped to v1.23'
  ]},
  { ver: 'v1.22', date: '2026-07-04', items: [
    'Fix: Push notification toggle now shows feedback when tapped (test toast for granted, guidance for denied)',
    'Fix: Notification toggle no longer shows "not-allowed" cursor when blocked',
    'Updated: Service worker cache version bumped to v1.22'
  ]},
  { ver: 'v1.21', date: '2026-07-04', items: [
    'New: Quiz fully translated to English and Cebuano (questions + UI)',
    'New: 100+ new English reactions and messages for Javi',
    'New: 100+ new Cebuano reactions and messages for Javi',
    'New: 20 safety tips each in English and Cebuano',
    'Updated: Service worker cache version bumped to v1.21'
  ]},
  { ver: 'v1.19', date: '2026-07-04', items: [
    'New: Ask Javi AI Chat — ask Javi earthquake safety questions in real-time!',
    'New: Chat button with message-circle icon in action bar',
    'Updated: Service worker cache version bumped to v1.19'
  ]},
  { ver: 'v1.18', date: '2026-07-04', items: [
    'Fix: Language dropdown options now properly hide/show on click',
    'Updated: Service worker cache version bumped to v1.18'
  ]},
  { ver: 'v1.16', date: '2026-07-04', items: [
    'New: Fully styled custom language dropdown — options now match app theme',
    'Updated: Service worker cache version bumped to v1.16'
  ]},
  { ver: 'v1.15', date: '2026-07-04', items: [
    'New: Language selector dropdown in Settings (English / Tagalog / Cebuano)',
    'Fix: Language dropdown now styled to match app theme',
    'Updated: Service worker cache version bumped to v1.15'
  ]},
  { ver: 'v1.14', date: '2026-07-04', items: [
    'Fix: CSS wrapping for translated text in modals and quiz options',
    'Updated: Service worker cache version bumped to v1.14 for fresh asset caching'
  ]},
  { ver: 'v1.13', date: '2026-07-04', items: [
    'New: Earthquake Quiz feature with score tracking and quiz progress',
    'New: External quiz questions module for easier updates and expansion',
    'Updated: Service worker cache version bumped to v1.13 for fresh asset caching'
  ]},
  { ver: 'v1.11', date: '2026-07-03', items: [
    'Fixed: Alert sound (NDRRMC) now plays on mobile — pre-authorized on first tap',
    'Fixed: In-app notification toast shows on iOS where browser notifications are blocked',
    'Fixed: Auto-refresh earthquake data when returning to the app'
  ]},
  { ver: 'v1.10', date: '2026-07-03', items: [
    'Fixed: App now loads in Messenger and other in-app browsers (non-blocking SW)',
    'Fixed: Track names display correctly with URL decoding and "by JaviAlert"',
    'New: Official NDRRMC Alert sound replaces old synthesized beeps'
  ]},
  { ver: 'v1.00', date: '2026-07-02', items: [
    'New: Now Playing bar with song name, play/pause, next, and mode controls',
    'New: Playback modes — Shuffle All, Loop One, Play Once',
    'New: Background Music toggle + Volume slider in settings',
    'New: Opening theme song (Sabay-sabay Tayong Bida) plays before ambient mix',
    'Fixed: Autoplay music works on page load (browser policy compliant)',
    'Fixed: Opening and ambient music no longer overlap (merged into one player)'
  ]},
  { ver: 'v1.00', date: '2026-07-01', items: [
    'New: Push notifications highlight the NEWEST quake (not the strongest)',
    'New: Depth-adjusted magnitude — shallow quakes feel stronger, deep ones feel weaker',
    'New: Lowered danger threshold to Mag 4.0, with distance-triggered danger at Mag 3.5+ within 120km',
    'Fixed: Service Worker auto-clears old cache on every update',
    'Fixed: "Pinakamalakas" changed to "Pinakabago" in alert bubbles'
  ]},
  { ver: 'v0.9', date: '2026-06-30', items: [
    'New: Real MP3 music tracks replace synthesized melodies',
    'New: Javi cartoon redesign with animated GIF reactions',
    'New: Earthquake safety tips, emergency hotlines, and "Am I Safe?" analysis',
    'New: Dark mode toggle',
    'New: Leaflet map with earthquake markers and magnitude filters',
    'New: Installable PWA with offline support via Service Worker',
    'New: Push notifications for new earthquakes'
  ]}
];
