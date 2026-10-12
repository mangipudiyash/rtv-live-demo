# RTV Live — News, Safety Pulse & RTV Instant

A concept news platform built on RTV's public news feed. Not affiliated with RTV News Network.

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

### 📰 Reading experience
In-app reader with listen-aloud, text size, save and share · search across 6,000+ stories ·
section browsing with pagination · "Near you" and "Picked for you" rows · live weather ·
live TV · "JUST IN" alerts for newly published stories · dark mode · fully responsive.

## Tech
Vanilla JavaScript, HTML and CSS — no frameworks. Runs entirely in the browser with no backend:
WordPress REST API (news), Open-Meteo (weather & air quality), USGS (earthquakes),
OpenStreetMap / Nominatim (places & nearest help), Web Speech API (narration).

All news content belongs to RTV News Network.
