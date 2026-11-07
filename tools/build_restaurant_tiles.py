#!/usr/bin/env python3
"""Generate worldwide-compatible 0.1-degree restaurant tiles from an OSM PBF extract.
Requires: pip install osmium
Usage: python tools/build_restaurant_tiles.py belgium-latest.osm.pbf
No paid APIs or per-search credits. Import each region separately; merge existing tiles.
"""
import argparse
import json
import math
from pathlib import Path
import osmium

parser = argparse.ArgumentParser()
parser.add_argument("pbf", help="OSM PBF extract (e.g. from Geofabrik)")
parser.add_argument("--out", default="explore/data/restaurants")
args = parser.parse_args()
output = Path(args.out)
output.mkdir(parents=True, exist_ok=True)
tiles = {}

def collect(osm_type, osm_id, lat, lon, tags):
    if not (-90 <= lat < 90 and -180 <= lon < 180):
        return
    name = tags.get("name")
    if not name or tags.get("amenity") != "restaurant":
        return
    key = f"{math.floor(lat*10)}_{math.floor(lon*10)}.json"
    allowed = ("name", "cuisine", "addr:street", "addr:housenumber", "addr:full", "addr:city", "website", "contact:website")
    item = {"type": osm_type, "id": osm_id, "lat": round(lat, 7), "lon": round(lon, 7),
            "tags": {k: tags[k] for k in allowed if k in tags}}
    tiles.setdefault(key, {})[(osm_type, osm_id)] = item

class Restaurants(osmium.SimpleHandler):
    def node(self, n):
        if n.location.valid():
            collect("node", n.id, n.location.lat, n.location.lon, n.tags)
    def way(self, w):
        if "amenity" not in w.tags or w.tags.get("amenity") != "restaurant":
            return
        try:
            coords = [(n.lat, n.lon) for n in w.nodes if n.location.valid()]
            if coords:
                collect("way", w.id, sum(p[0] for p in coords)/len(coords), sum(p[1] for p in coords)/len(coords), w.tags)
        except osmium.InvalidLocationError:
            pass
    def area(self, a):
        # Way polygons are already captured above. Relations can be added in a later import.
        pass

Restaurants().apply_file(args.pbf, locations=True)
count = 0
for key, new in tiles.items():
    path = output/key
    merged = {}
    if path.exists():
        for item in json.loads(path.read_text(encoding="utf-8")):
            merged[(item["type"], item["id"])] = item
    merged.update(new)
    rows = sorted(merged.values(), key=lambda v: (v["type"], v["id"]))
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    count += len(new)
print(f"Processed {count} restaurants across {len(tiles)} tiles. Output: {output}")
