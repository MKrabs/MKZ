#!/usr/bin/env node
/**
 * fetch-region-outlines.js
 *
 * Downloads German Kreise (district) boundaries from the Regionalatlas API
 * and stores them as GeoJSON files:
 * - high-res: full detail polygons
 * - low-res: simplified polygons (using maxAllowableOffset)
 *
 * Source: https://regionalatlas.statistikportal.de/
 * API: ArcGIS REST Services (stba/regionalatlas/MapServer)
 *
 * Usage: node scripts/fetch-region-outlines.js
 *
 * Output:
 *   src/data/region-outlines-high.json  (full detail)
 *   src/data/region-outlines-low.json   (simplified for overview zoom)
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.gis-idmz.nrw.de/arcgis/rest/services/stba/regionalatlas/MapServer/dynamicLayer/query';

// Layer config: typ=3 = Kreise und kreisfreie Städte
const LAYER_JSON = JSON.stringify({
  source: {
    dataSource: {
      geometryType: 'esriGeometryPolygon',
      workspaceId: 'gdb',
      query: 'SELECT * FROM verwaltungsgrenzen_gesamt WHERE typ = 3 AND jahr = 2022',
      oidFields: 'id',
      spatialReference: {wkid: 25832},
      type: 'queryTable',
    }, type: 'dataLayer',
  },
});

const BATCH_SIZE = 100; // ArcGIS server limit per request
const TOTAL_RECORDS = 400;

async function fetchBatch(offset, maxAllowableOffset = null) {
  const params = new URLSearchParams({
    layer: LAYER_JSON,
    where: '1=1',
    outFields: 'ags,gen',
    returnGeometry: 'true',
    f: 'geojson',
    outSR: '4326',
    resultRecordCount: String(BATCH_SIZE),
    resultOffset: String(offset),
  });

  if (maxAllowableOffset !== null) {
    params.set('maxAllowableOffset', String(maxAllowableOffset));
  }

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`  Fetching offset=${offset}...`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();

  return data.features || [];
}

async function fetchAll(maxAllowableOffset = null) {
  const allFeatures = [];

  for (let offset = 0; offset < TOTAL_RECORDS + BATCH_SIZE; offset += BATCH_SIZE) {
    const features = await fetchBatch(offset, maxAllowableOffset);
    if (features.length === 0) break;
    allFeatures.push(...features);
    console.log(`  Got ${features.length} features (total: ${allFeatures.length})`);

    // Be polite — small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    type: 'FeatureCollection', features: allFeatures,
  };
}

async function main() {
  const outDir = path.join(__dirname, '..', 'src', 'data');
  fs.mkdirSync(outDir, {recursive: true});

  // High resolution (full detail)
  console.log('Fetching HIGH-RES region outlines...');
  const highRes = await fetchAll(null);
  const highPath = path.join(outDir, 'region-outlines-high.json');
  fs.writeFileSync(highPath, JSON.stringify(highRes));
  console.log(`  Written: ${highPath} (${(fs.statSync(highPath).size / 1024 / 1024).toFixed(2)} MB, ${highRes.features.length} features)`);

  // Low resolution (simplified — offset in degrees, ~0.005° ≈ 500m)
  console.log('\nFetching LOW-RES region outlines...');
  const lowRes = await fetchAll(0.005);
  const lowPath = path.join(outDir, 'region-outlines-low.json');
  fs.writeFileSync(lowPath, JSON.stringify(lowRes));
  console.log(`  Written: ${lowPath} (${(fs.statSync(lowPath).size / 1024 / 1024).toFixed(2)} MB, ${lowRes.features.length} features)`);

  console.log('\nDone! Region outlines saved.');
  console.log(`  High-res: ${highRes.features.length} Kreise`);
  console.log(`  Low-res:  ${lowRes.features.length} Kreise`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
