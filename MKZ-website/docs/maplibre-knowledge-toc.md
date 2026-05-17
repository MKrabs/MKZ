# MapLibre GL JS — Knowledge TOC
> Fetched 2026-05-17 from https://maplibre.org/maplibre-gl-js/docs/examples/
> Version used: maplibre-gl@5.x (latest stable)
> CDN: https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js

---

## 1. Installation (npm + Vite + SolidJS)
```bash
npm install maplibre-gl
```
```ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
```
No extra Vite config needed for MapLibre v5 with npm install.

---

## 2. Globe Projection (key feature we use)
**Example:** `display-a-globe-with-an-atmosphere`
```ts
const map = new maplibregl.Map({
  container: 'map',
  zoom: 0,
  center: [10, 51],
  style: {
    version: 8,
    projection: { type: 'globe' },          // ← KEY: enables 3D globe
    sources: {
      satellite: {
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
        type: 'raster',
        tileSize: 256,
      },
    },
    layers: [{ id: 'Satellite', type: 'raster', source: 'satellite' }],
    sky: {
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    light: { anchor: 'map', position: [1.5, 90, 80] },
  },
});
```
- `sky.atmosphere-blend` = fades atmosphere in at low zoom, out at high zoom
- `light` = simulates sun angle for 3D effect
- Background of map container: `background: #000` for space feel

---

## 3. flyTo (smooth camera transition)
**Example:** `fly-to-a-location`
```ts
map.flyTo({
  center: [lng, lat],     // destination
  zoom: 8,                // target zoom
  essential: true,        // respects prefers-reduced-motion
  duration: 2000,         // ms
  offset: [dx, dy],       // pixel offset: shifts where center lands in viewport
                          // positive X = right, positive Y = down
});
```
**`offset` is the key for making city appear in the preview box!**
- `offset: [200, 0]` → city appears 200px right of viewport center
- Calculate: `previewBox.center - viewport.center`

---

## 4. Idle Globe Rotation
**Example:** `animate-map-camera-around-a-point`
```ts
let animFrame: number;
function rotateCamera(timestamp: number) {
  map.setBearing((timestamp / 200) % 360);  // ~1.8 deg/sec
  animFrame = requestAnimationFrame(rotateCamera);
}
map.on('load', () => {
  animFrame = requestAnimationFrame(rotateCamera);
});
// Stop: cancelAnimationFrame(animFrame)
// Resume: animFrame = requestAnimationFrame(rotateCamera) with adjusted start time
```

---

## 5. Map.setBearing vs rotateTo
- `map.setBearing(angle)` → instant, no animation, use in RAF loop
- `map.rotateTo(angle, { duration: 0 })` → same effect, also instant with duration:0
- `map.flyTo({ bearing: angle })` → animated bearing change

---

## 6. Free Tile Sources (no API key!)
| Source | URL Pattern | Notes |
|--------|-------------|-------|
| EOX Sentinel-2 Satellite | `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg` | Cloud-free composite |
| OpenFreeMap Bright | `https://tiles.openfreemap.org/styles/bright` | Vector, bright style |
| OpenFreeMap Liberty | `https://tiles.openfreemap.org/styles/liberty` | Vector, liberty style |

**For our globe: use EOX satellite (raster)** — looks great on globe projection.

---

## 7. Map Padding / Offset for Asymmetric Focus
**Example:** `offset-the-vanishing-point-using-padding`
```ts
// Padding shifts the "center" calculation
map.flyTo({
  center: [lng, lat],
  padding: { left: 600, right: 0, top: 0, bottom: 0 },
  // OR use offset:
  offset: [dx, dy],   // pixel offset from viewport center
});
```
**Our approach:** use `offset` since we can measure the preview box DOM position.

---

## 8. Map Initialization Options
```ts
new maplibregl.Map({
  container: element,           // HTMLElement or string id
  style: styleObject,           // inline style object OR URL
  center: [lng, lat],           // initial center [longitude, latitude]
  zoom: number,                 // initial zoom (0 = whole world)
  bearing: number,              // initial rotation (0 = north up)
  pitch: number,                // 0-85 degrees tilt
  interactive: boolean,         // false = non-interactive
  attributionControl: boolean,  // show/hide attribution
  renderWorldCopies: boolean,   // false for globe
});
```

---

## 9. Events
```ts
map.on('load', () => { /* map fully loaded */ });
map.on('moveend', () => { /* camera stopped moving */ });
map.on('error', (e) => { /* tile load errors */ });
```

---

## 10. SolidJS Integration Pattern
```tsx
import { onMount, onCleanup } from 'solid-js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapComponent = () => {
  let containerRef: HTMLDivElement | undefined;
  
  onMount(() => {
    const map = new maplibregl.Map({ container: containerRef!, ... });
    onCleanup(() => map.remove());
  });
  
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};
```
- Use `ref` callback, not `getElementById`
- `onCleanup` removes the map on component unmount
- Do NOT access `map` in reactive computations — use callbacks/signals

---

## 11. Testing Strategy (jsdom / no WebGL)
MapLibre needs WebGL, which jsdom doesn't support. Mock the module:
```ts
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn((event, cb) => { if (event === 'load') setTimeout(cb, 0); }),
      flyTo: vi.fn(),
      setBearing: vi.fn(),
      remove: vi.fn(),
      getCanvas: vi.fn(() => ({ style: {} })),
    })),
    supported: vi.fn(() => true),
  },
}));
```

---

## 12. German License Plate Prefixes (our data set)
| Prefix | City | Coordinates [lng, lat] |
|--------|------|------------------------|
| M | Munich (München) | [11.5820, 48.1351] |
| B | Berlin | [13.4050, 52.5200] |
| KA | Karlsruhe | [8.4037, 49.0069] |

Prefix = first word when plate split by space: `"M AB 1234".split(' ')[0]` → `"M"`

---

## 13. Useful MapLibre API Methods
```ts
map.flyTo(options)       // smooth transition
map.jumpTo(options)      // instant transition
map.easeTo(options)      // animated (no zoom arc)
map.setBearing(angle)    // instant bearing set
map.setZoom(zoom)        // instant zoom set
map.getCanvas()          // HTMLCanvasElement
map.remove()             // clean up
map.isStyleLoaded()      // boolean
```

---

## 14. PocketBase — kennzeichen Collection (added 2026-05-17)

**Project:** `/home/mago2/Projects/MKZ-pocketbase/`
**Binary version:** v0.38.1 (prebuilt)
**Go project:** yes — `main.go` + `migrations/`

### Collection: `kennzeichen`
| Field | Type | Notes |
|-------|------|-------|
| `id` | TEXT | PB auto-generated 15-char ID |
| `code` | Text (max 3, required) | Plate prefix e.g. "M", "KA", "B" |
| `district_name` | Text (max 200, required) | Zulassungsbezirk name |
| `bundesland` | Text (max 50, required) | Full state name e.g. "Bayern" |
| `bundesland_iso` | Text (max 6, required) | ISO 3166-2 e.g. "DE-BY" |
| `derivation` | Text (max 200) | How the abbreviation was derived |
| `active` | Bool | `false` = "auslaufend" (phased out) |
| `notes` | Text (max 500) | Phase-out info etc. |

**Indexes:** `idx_kennzeichen_code_unique` (UNIQUE), `idx_kennzeichen_bundesland`, `idx_kennzeichen_active`

**Data:** 714 records (687 active + 27 auslaufend/phased-out)
**Source:** openpotato/kfz-kennzeichen (MIT) + Wikipedia cross-check

### Running migrations
```bash
cd /home/mago2/Projects/MKZ-pocketbase
go run . migrate up       # apply pending migrations
go run . migrate down 1   # revert last migration
go run . serve            # starts server + auto-applies migrations
```
