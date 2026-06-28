# 🏎️ F1 Race Center

Ein interaktives Formula-1-Race-Dashboard mit **3D-Streckenansicht**, **Timing Tower**,
**Telemetrie**, **Race-Control-Feed** und **Replay** – komplett gespeist aus der freien
[OpenF1 API](https://openf1.org/).

Es fühlt sich an wie ein echtes Race-Center: Autos fahren animiert über eine aus echten
GPS-Daten rekonstruierte Strecke, der Timing Tower sortiert sich live, gelbe Flaggen lassen
die Strecke aufleuchten und ein Klick auf ein Auto öffnet Live-Telemetrie.

![Stack](https://img.shields.io/badge/React-18-61dafb) ![Stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![Stack](https://img.shields.io/badge/Three.js-R3F-black) ![Stack](https://img.shields.io/badge/Tailwind-3-38bdf8)

---

## 🚀 Schnellstart

```bash
npm install
npm run dev
```

Dann im Browser öffnen: **http://localhost:5173**

Beim Start erscheint die Session-Auswahl (standardmäßig auf die **aktuelle Saison**).
Schnellster Weg: **„▶ Latest Race ({Jahr})"** → lädt das letzte gefahrene Rennen der laufenden
Saison. Alternativ **„Demo"** für das 2023 Singapore GP (Sieger: Carlos Sainz).

Weitere Befehle:

```bash
npm run build      # Production-Build (Vite)
npm run preview    # Build lokal testen
npm run typecheck  # TypeScript prüfen
```

**Voraussetzung:** Node 18+ (getestet mit Node 24).

---

## 🔐 Authentifizierung (OpenF1-Abo) & CORS

Alle API-Calls laufen über einen **lokalen Proxy** (`vite.config.ts`, Route `/api/openf1`).
Das löst zwei Dinge:

1. **CORS** – der Browser spricht nur mit `localhost`, der Proxy leitet serverseitig an
   `https://api.openf1.org` weiter. (Direkte Browser-Requests scheiterten zuletzt z. B. bei
   `meetings?year=2026` an CORS.)
2. **Auth** – hast du ein OpenF1-Abo, kopiere `.env.example` → `.env` und trage ein:

   ```bash
   OPENF1_USERNAME=deine_email
   OPENF1_PASSWORD=dein_passwort
   ```

   Der Proxy holt damit serverseitig einen **OAuth2-Token** (`/token`), cached ihn (1 h) und
   hängt ihn als `Authorization: Bearer …` an jeden Request. **Die Zugangsdaten bleiben im
   Backend** und landen nie im Browser-Code – genau wie es die OpenF1-Doku empfiehlt.
   Ohne `.env` läuft alles anonym weiter (nur niedrigere Rate-Limits).

   > Nach dem Anlegen der `.env` den Dev-Server **neu starten**. In der Konsole erscheint dann
   > `[openf1] authenticated mode enabled`.
   >
   > **Troubleshooting:** Antwortet `/token` mit `401 "Incorrect username or password"`, stimmen
   > die Zugangsdaten nicht (App läuft dann anonym weiter). Prüfe Tippfehler; enthält das
   > Passwort Sonderzeichen (`$`, `#`, Anführungszeichen), in `.env` in doppelte Anführungszeichen
   > setzen: `OPENF1_PASSWORD="dein#pass"`.

   Echtzeit-Streaming (MQTT/WebSocket) ist damit vorbereitet: der Token-Mechanismus steckt
   bereits im Proxy; ein MQTT-Client (`wss://mqtt.openf1.org:8084/mqtt`, Token als Passwort)
   kann im Live-Modus ergänzt werden.

---

## 🧱 Tech-Stack

| Bereich        | Technologie                                  |
| -------------- | -------------------------------------------- |
| Framework      | React 18 + TypeScript + Vite                 |
| 3D             | Three.js via `@react-three/fiber` + `drei`   |
| State (UI)     | Zustand                                       |
| State (Server) | TanStack React Query (Caching, Abort, Retry) |
| Charts         | Recharts (Telemetrie-Sparkline)              |
| Styling        | Tailwind CSS (Dark / Glassmorphism / Neon)   |

---

## 🗂️ Projektstruktur

```
src/
  api/
    openf1.ts          # API-Service-Schicht (alle Endpunkte, Throttle, Retry)
    types.ts           # TypeScript-Modelle der OpenF1-Daten
  lib/
    geometry.ts        # Strecke aus Location-Daten bauen + Normalisierung
    interpolation.ts   # Positions-/Werte-Interpolation über die Replay-Zeit
    raceData.ts        # Rohdaten -> indizierte, schnell abfragbare Struktur
    format.ts          # Zeit-/Farb-/Reifen-Formatierung
  hooks/
    useSessionData.ts  # Lädt + normalisiert eine Session (React Query)
    useDerived.ts      # Standings/Flags/Bestzeiten zum aktuellen Zeitpunkt
    useCarData.ts      # Telemetrie des ausgewählten Fahrers (on demand)
  clock/
    ClockProvider.tsx  # Replay-Uhr (requestAnimationFrame + throttled UI-Zeit)
  store/useRaceStore.ts# UI-/Client-State (Auswahl, Kamera, Play/Speed …)
  context/RaceDataContext.tsx
  components/
    AppLayout.tsx  SessionSelector.tsx  TopBar.tsx
    track/Track3DView.tsx  track/DriverCarMarker.tsx
    TimingTower.tsx  DriverDetailPanel.tsx  TelemetryPanel.tsx
    RaceControlFeed.tsx  FlagStatusBanner.tsx  WeatherWidget.tsx
    ReplayControls.tsx
```

---

## 🛰️ Genutzte OpenF1-Endpunkte

Alle Aufrufe liegen in [`src/api/openf1.ts`](src/api/openf1.ts):

| Funktion           | Endpoint          | Verwendung                                   |
| ------------------ | ----------------- | -------------------------------------------- |
| `getMeetings`      | `/v1/meetings`    | Grand-Prix-Auswahl pro Jahr                  |
| `getSessions`      | `/v1/sessions`    | Race / Qualifying / Practice je Meeting      |
| `getSession`       | `/v1/sessions`    | Meta + Zeitfenster der gewählten Session     |
| `getDrivers`       | `/v1/drivers`     | Namen, Kürzel, Startnummern, **Teamfarben**  |
| `getLocations`     | `/v1/location`    | x/y/z-Positionen → Strecke + Auto-Animation  |
| `getLaps`          | `/v1/laps`        | Rundenzeiten, Sektoren, Bestzeiten           |
| `getIntervals`     | `/v1/intervals`   | Abstände (Gap to Leader / Interval)          |
| `getPositions`     | `/v1/position`    | Reihenfolge / Positionswechsel               |
| `getCarData`       | `/v1/car_data`    | Telemetrie: Speed, Gang, RPM, DRS, Gas/Bremse|
| `getRaceControl`   | `/v1/race_control`| Flaggen, Safety Car, Penalties, Track Limits |
| `getWeather`       | `/v1/weather`     | Strecken-/Lufttemperatur, Regen, Wind        |
| `getPits`          | `/v1/pit`         | Boxenstopps (im Fahrerpanel)                 |
| `getStints`        | `/v1/stints`      | Reifenmischung + Stintlänge (Leaderboard + Panel) |
| `getTeamRadio`     | `/v1/team_radio`  | Boxenfunk-Clips pro Fahrer                    |

### Wichtige OpenF1-Eigenheiten (im Code berücksichtigt)

- **404 = „keine Treffer".** OpenF1 liefert bei leeren Ergebnissen einen `404` statt eines
  leeren Arrays. Der Service behandelt `404` deshalb als leeres Ergebnis.
- **Rate Limiting (429).** Die anonyme API drosselt Bursts. Der Service nutzt eine
  **Concurrency-Begrenzung (2)**, **Mindestabstand zwischen Requests (350 ms)** und
  **exponentielles Backoff + `Retry-After`** bei `429`.
- **`session_key=9158` ist NICHT das Rennen**, sondern *Practice 1* (Singapur 2023). Das
  Demo nutzt korrekt **`9165` (Race)**. Generell findet man Sessions über die Auswahl.
- **`date_end` ist manchmal zu früh.** OpenF1 liefert für manche Sessions ein zu frühes
  Session-Ende (z. B. wenn das Qualifying wegen roter Flaggen überzieht). Das echte Ende wird
  daher aus dem **letzten Lap** und der **letzten Race-Control-Meldung** abgeleitet
  (`effectiveEnd` in [`useSessionData`](src/hooks/useSessionData.ts)).
- **Datenmenge.** Location/Telemetrie sind dicht (~3,7 Hz × 20 Fahrer). Die **gesamte Session**
  wird geladen, aber **in Zeit-Chunks** (`LOCATION_CHUNK_MINUTES`), **dezimiert**
  (`LOCATION_MIN_INTERVAL_MS`) und **progressiv** (Fortschrittsbalken). Ein Sicherheits-Cap
  liegt bei `MAX_SESSION_MINUTES`.

---

## ⏯️ Wie funktioniert der Replay-Modus?

1. **Session laden** ([`useSessionData`](src/hooks/useSessionData.ts)): Das Fenster umfasst die
   **komplette Session** (`date_start` → `effectiveEnd`, mit Cap). Location wird für **alle
   Fahrer** in **Zeit-Chunks** parallel geladen, sofort kompaktiert + dezimiert und mit einem
   **Fortschrittsbalken** angezeigt (statt eines einzigen Riesen-Requests).
2. **Strecke bauen** ([`geometry.ts`](src/lib/geometry.ts)): Aus dem Fahrer mit den meisten
   Punkten wird per **Loop-Closure** genau eine Runde isoliert, geglättet und in
   Szenenkoordinaten projiziert. Die gleiche Projektion gilt für alle Autos → sie liegen
   exakt auf der Strecke.
3. **Indizieren** ([`raceData.ts`](src/lib/raceData.ts)): Alle Datenreihen werden pro Fahrer
   nach Zeit sortiert, damit „neuester Wert ≤ t" per **Binärsuche** in O(log n) geht.
4. **Uhr** ([`ClockProvider`](src/clock/ClockProvider.tsx)): Eine `requestAnimationFrame`-
   Schleife führt die Replay-Zeit in einem **Ref** (jeder Frame, kein Re-Render). Eine
   gedrosselte Kopie (≈5×/s) landet im Store und treibt Timing/Telemetrie.
5. **Autos animieren** ([`Track3DView`](src/components/track/Track3DView.tsx)): In `useFrame`
   wird pro Fahrer die Position zur Replay-Zeit **interpoliert** und die Mesh-Position
   **imperativ** gesetzt (flüssig, ohne React-Rerender). Heading folgt der Bewegung.
6. **Timeline** ([`ReplayControls`](src/components/ReplayControls.tsx)): Play/Pause, Scrubber
   und Speeds **0.5× / 1× / 2× / 5× / 10×**. Race-Control-Meldungen, Standings, Flaggen und
   Telemetrie aktualisieren sich passend zur Replay-Zeit.

---

## 🔴 Wie aktiviere ich später Live-Daten?

Die Architektur ist bereits darauf vorbereitet:

- Der Store kennt den Modus `live` (`mode: 'demo' | 'replay' | 'live'`).
- In [`useSessionData`](src/hooks/useSessionData.ts) wird im Live-Modus per
  `refetchInterval` (Werte in [`config.ts`](src/config.ts) → `LIVE_POLL`) **gepollt**:
  location/car_data ~2 s, intervals/position ~4 s, race_control ~5 s, weather ~15 s.
- Live-Requests umgehen den In-Memory-Cache (`noCache`), nutzen aber weiter Throttle +
  AbortController + Retry.
- „● Go Live (beta)" in der Session-Auswahl holt via `session_key=latest` die aktuell
  laufende Session.

**Damit Live wirklich „lebt", sind noch zwei kleine Schritte nötig:**

1. Das Zeitfenster im Live-Modus an „jetzt" nachführen (rollierendes Fenster) und die Uhr
   dem Tail folgen lassen.
2. Optional auf **Polling → WebSocket/MQTT** umstellen (OpenF1 bietet einen MQTT-Stream).
   Dafür muss nur die Datenquelle in der Service-Schicht ergänzt werden – UI/Store bleiben.

---

## ⚠️ Einschränkungen bei OpenF1-Echtzeitdaten

- **Freie historische Daten ab 2023** sind ohne Auth verfügbar – ideal für den Replay-Modus.
- **Echtzeit** kann je nach Zugang/Last **verzögert** oder **gedrosselt** sein; der MQTT-
  Live-Stream und sehr hohe Frequenzen sind teils einer **Subscription** vorbehalten.
- Während eines echten Rennwochenendes ist „latest" sinnvoll gefüllt – außerhalb gibt es
  evtl. keine Live-Session (dann bitte Replay/Demo nutzen).
- **Rate Limits** treffen Bursts hart (siehe oben) – im Live-Betrieb die Polling-Frequenzen
  konservativ halten.

---

## ✨ Features im Überblick

- **3D-Streckenansicht** mit Zoom/Rotation, Kamera-Modi **Orbit / TV Cam / Top / Follow**.
- **Autos in Teamfarben**, animiert & interpoliert; Klick öffnet das Fahrerpanel.
- **Rundenzähler & Quali-Phase** oben: `LAP x / total` im Rennen bzw. `Q1 / Q2 / Q3` im
  Qualifying (aus den Zielflaggen abgeleitet).
- **Timing Tower**: Position, Kürzel, Teamfarbe, Interval, letzte Runde, Fastest-Lap-Badge.
- **Fahrerpanel**: Team, Position, Gaps, letzte/beste Runde, **Reifen/Stint**, **Telemetrie**
  (Speed, Gang, **RPM mit Redline**, Gas/Bremse als Verlaufs-Chart + Balken, DRS, **Topspeed**)
  und fahrerbezogene Race-Control-Events.
- **Boxenstopp-Predictor**: schätzt die Position **nach einem Stopp jetzt** anhand der aktuellen
  Abstände + einstellbarem Pit-Loss („Undercut-Sim"); zeigt zwischen welchen Fahrern man
  rauskommt.
- **Team-Radio**: Klick auf einen Fahrer lädt seine Boxenfunk-Clips (OpenF1 `team_radio`),
  abspielbar und synchron zur Replay-Zeit.
- **Live-Sektoren**: für den ausgewählten Fahrer werden die Sektoren der laufenden Runde
  **live aufgedeckt** (S1/S2/S3, lila/grün gefärbt) — ideal im Quali-/Broadcast-Modus, um zu
  sehen, wer auf Pole-Kurs ist.
- **Boxenstopp-Zeiten**: das Fahrerpanel zeigt die absolvierten Stopps mit Runde + Dauer.
- **Maßstäbliche Autos + Straßen-Ribbon**: die Autos sind relativ zur Streckenlänge skaliert
  (statt überdimensioniert), und die Strecke ist eine **breite Fahrbahn mit Randlinien** — so
  fahren zwei Autos im Zweikampf nebeneinander statt ineinander (Follow-/Broadcast-Kamera zoomt
  dafür näher heran). Tuning: `carLength`/`trackWidth` in
  [`Track3DView.tsx`](src/components/track/Track3DView.tsx).
- **Reifen + Sektoren im Leaderboard**: Reifenmischung (S/M/H) je Fahrer rechts in der Tabelle,
  plus farbige Sektor-Indikatoren (lila = Session-Bestzeit, grün = persönliche Bestzeit).
- **Qualifying-Modus**: das Leaderboard wird zur **provisorischen Startaufstellung** (sortiert
  nach Bestzeit, Gap zur Pole), Q1/Q2/Q3 oben.
- **Broadcast-Modus**: ein Auto-Regisseur, der wie ein TV-Feed automatisch auf die engsten
  Duelle (Race) bzw. die Pole-Anwärter (Quali) schaltet und die Follow-Kamera mitführt.
- **Wetter-Radar**: animiertes Radar mit Windvektor, Regen-Blips und Nass/Trocken-Timeline.
- **Realistische 3D-Autos**: GLB-Modell (`public/models/f1-car.glb`), pro Fahrer auf die
  Teamfarbe eingefärbt; umschaltbar auf einfache Marker (Button **„3D Cars"**). Falls das Modell
  verdreht/zu groß wirkt: `FORWARD_OFFSET` / `TARGET_LENGTH` in
  [`DriverCar3D.tsx`](src/components/track/DriverCar3D.tsx) anpassen.
- **Race-Control-Feed** farbcodiert; **gelbe Flagge** färbt die Strecke, **Safety Car / VSC /
  Rote Flagge** zeigen ein großes Status-Banner.
- **Weather-Widget**, **Replay-Timeline**, **responsives Layout** (Desktop-Spalten →
  Mobile-Tabs für Timing / Race Control / Driver).

---

## 🔧 Konfiguration

Zentral in [`src/config.ts`](src/config.ts):

| Konstante                  | Bedeutung                                     | Default        |
| -------------------------- | --------------------------------------------- | -------------- |
| `DEMO_SESSION_KEY`         | Fallback-Demo (2023 Singapore **Race**)       | `9165`         |
| `MAX_SESSION_MINUTES`      | Sicherheits-Cap für die geladene Session      | `200`          |
| `LOCATION_CHUNK_MINUTES`   | Chunk-Größe beim Laden der Positionsdaten     | `15`           |
| `LOCATION_MIN_INTERVAL_MS` | Dezimierung der Positionsdaten (~2,8 Hz)      | `350`          |
| `DEFAULT_PIT_LOSS_S`       | Start-Pit-Loss im Predictor                   | `22`           |
| `AVAILABLE_YEARS`          | Auswahljahre (dynamisch bis akt. Saison)      | 2023…heute     |
| `PLAYBACK_SPEEDS`          | Replay-Geschwindigkeiten                      | …10×           |
| `LIVE_POLL`                | Polling-Intervalle im Live-Modus              | s. o.          |

> Tipp: Für die volle Show eine **Race**-Session wählen – dort gibt es Positionen, Boxenstopps,
> Safety Car und reichlich Race-Control-Meldungen.
#   f 1 - r a c e - c e n t e r  
 