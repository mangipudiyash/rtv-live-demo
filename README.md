# RTV Live — News, Safety Pulse & RTV Instant

A concept news platform by [@mangipudiyash](https://github.com/mangipudiyash), built on RTV's public news feed.
Not affiliated with RTV News Network. All stories and photos belong to RTV.

**Live site:** open the link in the "About" section of this repository →

## What it does

### 🛡️ Safety Pulse — "Is your area safe right now?"
One tap checks the user's exact location against live public data and gives a clear verdict
(*Looks calm* / *Stay aware* / *Take care*) with the reasons:
- Live weather hazards and the next 6 hours (storms, heavy rain, gusts, fog)
- Heat stress, UV and air quality (AQI, PM2.5, PM10)
- Daylight / after-dark, sunset time
- Earthquakes within 400 km
- Local crime & safety reports from the newsroom, by area
- Nearest police station, hospital and fire station with directions
- SOS 112, national helplines, and "Share my location"

### 📺 RTV Instant — an on-demand TV bulletin generated in the browser
Press play and the latest stories become a continuous, narrated broadcast:
- Animated channel sting and kinetic headlines
- Ken Burns motion on story photos
- Narration with word-by-word karaoke captions
- Automatic data call-outs (figures like "71.23 lakh voters" become count-up graphics),
  quote cards and location pins — all derived from the story text
- Lower-thirds, live bug, headline ticker, "Up next", swipeable vertical reels on phones
- Channels: Top stories, Near me, Telangana, Andhra Pradesh, National, International and more

### 🗺 Live News Map
Every story is pinned where it happened — India and the world — with glowing hotspots, flight-path arcs
between places in the same story, and a **time-lapse** of up to 14 days of news rippling across the map
(live clock, activity graph, "breaking" cards). Tap a place to fly to it, read its stories, or play its own
RTV Instant bulletin. Places are tagged by the hourly job; land is drawn without political borders.

### 📺 My Show — a personal news show
A 4-step setup (name, areas, topics, length) builds a personal RTV Instant bulletin: the anchor greets you by
name, plays your areas first and skips what you've already seen. Daily reminder via a calendar file, and
"Add to Home Screen" as an app. Preferences stay on the viewer's device.

### 📰 Reading experience
In-app reader with listen-aloud, text size, save and share · instant search ·
section browsing · "Near you" and "Picked for you" rows · live weather ·
live TV · "JUST IN" alerts for newly published stories · dark mode · fully responsive.

## How it stays light on the source
Visitors never contact RTV's servers. A GitHub Actions job (`.github/workflows/update-news.yml`)
reads RTV's public feed **once an hour** — about 2 requests plus any new photos — and publishes a
static snapshot (`data/`, `img/`) with the site. If the feed doesn't answer, the run is skipped and
the previous snapshot stays live.

## Tech
Vanilla JavaScript, HTML and CSS — no frameworks, no backend. GitHub Actions + Pages for the hourly
snapshot; Open-Meteo (weather & air quality), USGS (earthquakes), OpenStreetMap / Nominatim
(places & nearest help) and the Web Speech API (narration) at view time.

All news content belongs to RTV News Network.
