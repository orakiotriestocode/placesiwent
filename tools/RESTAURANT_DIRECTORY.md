# Places I Went — free restaurant directory (DEV)

The restaurant scanner reads static JSON tiles hosted by our own GitHub Pages site. No API keys, per-search credits or live Overpass calls. Restaurants are sorted by distance. Ratings have been removed.

## Worldwide architecture, incremental coverage
The tile index works at any longitude/latitude, but **only imported regions contain data**. No global restaurant dataset has been imported yet. The DEV UI reports missing coverage rather than pretending there are zero restaurants. The worldwide directory is not complete.

To populate an area, open GitHub Actions → **Import OSM restaurant directory region** → Run workflow and provide a Geofabrik extract URL, for example:
`https://download.geofabrik.de/europe/belgium-latest.osm.pbf`

The workflow downloads the extract, generates 0.1° tiles, and commits them. Run it separately for additional countries/regions. Large regions can exceed GitHub Actions time, repository size, or GitHub Pages publishing limits; do not attempt the entire planet as one import. For full global coverage, a larger static hosting/data pipeline will be needed. GitHub Actions and Pages have usage/bandwidth limits; "unlimited" here means no metered restaurant lookup API, not unlimited free hosting.

## Licensing
Restaurant data © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright. Retain attribution. If publishing a derivative database, review ODbL share-alike obligations. Source data from Geofabrik: https://download.geofabrik.de/

## Technical details
Tiles live at `explore/data/restaurants/{floor(lat*10)}_{floor(lon*10)}.json`. Missing files return HTTP 404. A scan loads neighboring tiles intersecting the chosen radius, calculates exact great-circle distances client-side, deduplicates by name and rounded coordinates, and sorts nearest first. A region import merges OSM type/id records with existing tiles.

## Verification
JavaScript syntax and mocked scans should pass before each DEV promotion. A real browser GPS test plus imported tile smoke test is required before calling the worldwide directory operational.
