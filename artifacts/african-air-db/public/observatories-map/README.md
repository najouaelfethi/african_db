# Observatories & networks map — developer handoff

Interactive map of air-quality observatories, monitoring networks and field campaigns in Africa
(AERONET, INDAAF, SAFARI 2000, NDACC, SHADOZ), built as a static page with D3 v7.

## Contents

```
observatories-map/
├── index.html                  Page markup (header, filters, map, detail panel, station index)
├── css/styles.css              All styles (design tokens at the top, light + dark themes)
├── js/map.js                   All behaviour (map, zoom, cards, detail panel, filters, table)
├── data/
│   ├── networks.json           One entry per network / campaign (name, acronym, intro, links, marker shape)
│   ├── stations.json           One entry per station (131 stations)
│   ├── stations.csv            Same stations as a spreadsheet, for review / editing
│   └── africa-boundaries.geojson  Simplified country borders (Morocco shown as one country, no internal border)
└── standalone/
    └── observatories-map-standalone.html   Single-file version with everything inlined (for preview only)
```

## Running it

`map.js` loads the JSON files with `fetch()`, so `index.html` must be served over HTTP. Opening it
directly from disk (`file://`) won't work. For a quick local test:

```
cd observatories-map
python3 -m http.server 8000      # then open http://localhost:8000
```

The standalone file works offline by double-clicking it. Use it to preview, not to integrate.

## Integrating into the website

1. Copy the `<header>`/`<main>` markup from `index.html` into the site template. The site header and
   footer in the file are placeholders; replace them with the real site navigation.
2. Include `css/styles.css` and the Google Fonts `<link>` (Archivo, Figtree, IBM Plex Mono).
3. Load D3 **before** `js/map.js`:
   `<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>`
4. Set `MAP_CONFIG.dataPath` at the top of `js/map.js` to wherever the data files are served from
   (or point it at an API endpoint that returns the same JSON).
5. `MAP_CONFIG.openSampleCardOnLoad` opens one station's card on load to show visitors the interaction.
   Set it to `null` to start with no card open.

Element IDs the script relies on: `stats`, `nets`, `country`, `q`, `count`, `mapbox`, `map`, `zin`, `zout`,
`zreset`, `legend`, `station-details`, `rows`, `index-count`, plus `.seg button[data-s]` and `th[data-k]`.

## Behaviour

- **Click a station** → overview card (network + acronym definition, station, city, country, period, status).
- **Click the card** → full station record below the map (details, coordinates, activity timeline,
  network description, data links, other stations in the same country).
- Filters: network toggles, status (All / Active / Inactive), country, text search. They apply to the map and the table.
- Zoom: scroll / pinch / buttons. Country names appear progressively as the user zooms in.
- Island territories (Canary Islands, Cabo Verde, Ascension, Saint Helena, Réunion, Seychelles) are circled.
- SAFARI 2000 host countries are hatched in red.
- "Stations by country / territory" lists all 54 African countries plus 4 island territories, including
  countries with 0 stations.
- Light and dark themes follow the visitor's system setting.

## Data model

### networks.json (object keyed by network id)

| field | meaning |
|---|---|
| `name`, `full` | acronym and full name (shown as "NAME (Full name)") |
| `type` | e.g. "Field campaign", "Observation Network" |
| `kind` | `"network"` or `"campaign"` |
| `shape` | map marker: `circle`, `square`, `triangle`, `diamond`, `star` |
| `intro` | description paragraph |
| `website`, `database` | links (`database` may be null when stations have their own `db` link) |
| `publications` | array of URLs / DOIs |
| `datasets` | optional array of dataset DOIs (SHADOZ) |
| `countries` | campaigns only: countries to hatch on the map |

Marker colours are CSS tokens in `styles.css` (`--aeronet`, `--indaaf`, `--safari`, `--ndacc`, `--shadoz`)
mapped through the classes `.c-<network id>`.

### stations.json (array)

| field | meaning |
|---|---|
| `net` | network id (key in networks.json) |
| `id` | station name shown on the card |
| `kind` | site type, e.g. "INDAAF site", "Partner site", "Field campaign site" |
| `city`, `country` | location (country names must match the list in `AFRICA` / `TERR` in map.js) |
| `status` | `Active`, `Inactive` (hollow, smaller icon) or `Completed` (campaigns, filled icon) |
| `start`, `end` | years; `end: null` = "present" |
| `periodLabel`, `t0`, `t1` | optional custom period text and fractional years for the timeline |
| `lat`, `lon` | decimal degrees |
| `approx` | `false`, `"site"` (approximate position) or `"city"`, shows a "≈" note |
| `db` | optional station-specific data link |
| `avail` | optional "Yes"/"No" data availability |

### Adding a network

1. Add an entry to `networks.json` (pick an unused `shape`).
2. Add a colour token and a `.c-<id>{--c:var(--<token>)}` rule in `styles.css` (light and dark blocks).
3. Add its stations to `stations.json`. The filter chip, legend, overview card and chart update automatically.

## Data notes to verify before going live

- SAFARI 2000 and SHADOZ station coordinates are approximate (flagged with "≈" on the page).
- AERONET: 12 newer stations had no longitude in the source sheet. They're placed from known locations
  and flagged "Longitude approximate". Ahi_De_Cara and Casablanca_Platform were left out
  (their coordinates are outside Africa). LAMTO-STATION and Banizoumbou were de-duplicated.
- Descriptions for SAFARI 2000 and SHADOZ were drafted for the prototype and should be reviewed.

Boundaries: simplified from Natural Earth (public domain).
