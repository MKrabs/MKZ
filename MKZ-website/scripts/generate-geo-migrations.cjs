#!/usr/bin/env node
// MKZ-website/scripts/generate-geo-migrations.cjs
//
// Generates two PocketBase Go migration files:
//   1747500001_create_geo_regions.go   — collection schema
//   1747500002_seed_geo_regions.go     — insert all features
//
// The kennzeichen↔geo_regions relationship is handled separately via the
// kennzeichen_geo_regions junction table (see 1747500003) and the
// link-geo-regions.cjs script.
//
// Usage (from repo root):
//   node MKZ-website/scripts/generate-geo-migrations.cjs
//   node MKZ-website/scripts/generate-geo-migrations.cjs \
//     --low  MKZ-website/src/data/region-outlines-low.json  \
//     --high MKZ-website/src/data/region-outlines-high.json \
//     --out  MKZ-pocketbase/migrations

'use strict';

const fs = require('fs');
const path = require('path');

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1
         ? args[i + 1]
         : null;
}

const repoRoot = path.resolve(__dirname, '..', '..');

const lowPath = getArg('--low') ?? path.join(repoRoot, 'MKZ-website/src/data/region-outlines-low.json');
const highPath = getArg('--high') ?? path.join(repoRoot, 'MKZ-website/src/data/region-outlines-high.json');
const outDir = getArg('--out') ?? path.join(repoRoot, 'MKZ-pocketbase/migrations');

const TS_CREATE = 1747500001;
const TS_SEED = 1747500002;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readGeoJSON(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (e) {
    throw new Error(`Could not read ${abs}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${abs}: ${e.message}`);
  }
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error(`${abs} is not a valid GeoJSON FeatureCollection`);
  }
  return parsed;
}

function extractFeatures(geojson, label) {
  const map = new Map();
  const skipped = [];

  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i];
    if (!f || typeof f !== 'object') {
      skipped.push(`[${label}] #${i}: not an object`);
      continue;
    }
    if (!f.properties) {
      skipped.push(`[${label}] #${i}: missing properties`);
      continue;
    }
    const ags = f.properties.ags;
    const gen = f.properties.gen;
    if (!ags || typeof ags !== 'string' || ags.trim() === '') {
      skipped.push(`[${label}] #${i} (gen="${gen}"): missing/empty ags`);
      continue;
    }
    if (!gen || typeof gen !== 'string' || gen.trim() === '') {
      skipped.push(`[${label}] #${i} (ags="${ags}"): missing/empty gen`);
      continue;
    }
    if (!f.geometry?.type || !f.geometry?.coordinates) {
      skipped.push(`[${label}] #${i} (ags="${ags}"): missing geometry`);
      continue;
    }
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') {
      skipped.push(`[${label}] #${i} (ags="${ags}"): unsupported geometry "${f.geometry.type}"`);
      continue;
    }
    if (map.has(ags.trim())) {
      skipped.push(`[${label}] #${i} (ags="${ags}"): duplicate, keeping first`);
      continue;
    }
    map.set(ags.trim(), {ags: ags.trim(), gen: gen.trim(), geometry: f.geometry});
  }

  if (skipped.length > 0) {
    console.warn(`\n⚠️  Skipped in ${label}:`);
    skipped.forEach(s => console.warn(`   ${s}`));
  }
  return map;
}

function escapeGoRawString(str) {
  return str.split('`').join('` + "`" + `');
}

function geometryToGoRawString(geometry) {
  return escapeGoRawString(JSON.stringify(geometry));
}

// ─── Load + validate ─────────────────────────────────────────────────────────

console.log(`Reading low:  ${lowPath}`);
const lowGeo = readGeoJSON(lowPath);

console.log(`Reading high: ${highPath}`);
const highGeo = readGeoJSON(highPath);

const lowMap = extractFeatures(lowGeo, 'low');
const highMap = extractFeatures(highGeo, 'high');

const onlyInLow = [...lowMap.keys()].filter(k => !highMap.has(k));
const onlyInHigh = [...highMap.keys()].filter(k => !lowMap.has(k));
if (onlyInLow.length) {
  console.warn(`\n⚠️  ${onlyInLow.length} ags in LOW only:`);
  onlyInLow.forEach(k => console.warn(`   ${k} (${lowMap.get(k).gen})`));
}
if (onlyInHigh.length) {
  console.warn(`\n⚠️  ${onlyInHigh.length} ags in HIGH only:`);
  onlyInHigh.forEach(k => console.warn(`   ${k} (${highMap.get(k).gen})`));
}

const allAgs = new Set([...lowMap.keys(), ...highMap.keys()]);
console.log(`\n✅ Unique ags codes: ${allAgs.size} (low: ${lowMap.size}, high: ${highMap.size})`);

// ─── Output dir + package name ────────────────────────────────────────────────

fs.mkdirSync(path.resolve(outDir), {recursive: true});

let packageName = 'migrations';
const existingGoFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.go'));
if (existingGoFiles.length > 0) {
  const sample = fs.readFileSync(path.join(outDir, existingGoFiles[0]), 'utf8');
  const match = sample.match(/^package\s+(\w+)/m);
  if (match) packageName = match[1];
}
console.log(`Using Go package name: "${packageName}"`);

// ─── Migration 1: create geo_regions ─────────────────────────────────────────

const migration1 = `package ${packageName}

import (
\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
\t"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
\tm.Register(func(app core.App) error {
\t\tcollection := core.NewBaseCollection("geo_regions")

\t\tcollection.ListRule = types.Pointer("")
\t\tcollection.ViewRule = types.Pointer("")
\t\tcollection.CreateRule = nil
\t\tcollection.UpdateRule = nil
\t\tcollection.DeleteRule = nil

\t\tcollection.Fields.Add(
\t\t\t&core.TextField{
\t\t\t\tName:     "ags",
\t\t\t\tRequired: true,
\t\t\t\tMax:      20,
\t\t\t},
\t\t\t&core.TextField{
\t\t\t\tName:        "gen",
\t\t\t\tRequired:    true,
\t\t\t\tMax:         200,
\t\t\t\tPresentable: true,
\t\t\t},
\t\t\t&core.JSONField{
\t\t\t\tName:     "low",
\t\t\t\tRequired: false,
\t\t\t},
\t\t\t&core.JSONField{
\t\t\t\tName:     "high",
\t\t\t\tRequired: false,
\t\t\t},
\t\t)

\t\tcollection.AddIndex("idx_geo_regions_ags", true,  "ags", "")
\t\tcollection.AddIndex("idx_geo_regions_gen", false, "gen", "")

\t\treturn app.Save(collection)
\t}, func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId("geo_regions")
\t\tif err != nil {
\t\t\treturn nil
\t\t}
\t\treturn app.Delete(collection)
\t})
}
`;

// ─── Migration 2: seed geo_regions ───────────────────────────────────────────

const BATCH_SIZE = 50;
const rows = [];

for (const ags of allAgs) {
  const low = lowMap.get(ags);
  const high = highMap.get(ags);
  const gen = (low ?? high).gen;
  rows.push({
    ags,
    gen,
    lowJSON: low
             ? `\`${geometryToGoRawString(low.geometry)}\``
             : `""`,
    highJSON: high
              ? `\`${geometryToGoRawString(high.geometry)}\``
              : `""`,
    hasLow: !!low,
    hasHigh: !!high,
  });
}

const batchBlocks = [];
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const lines = [];
  for (const r of batch) {
    lines.push(`\t\t{`);
    lines.push(`\t\t\trec := core.NewRecord(collection)`);
    lines.push(`\t\t\trec.Set("ags", "${r.ags}")`);
    lines.push(`\t\t\trec.Set("gen", \`${escapeGoRawString(r.gen)}\`)`);
    if (r.hasLow) lines.push(`\t\t\trec.Set("low",  ${r.lowJSON})`);
    if (r.hasHigh) lines.push(`\t\t\trec.Set("high", ${r.highJSON})`);
    lines.push(`\t\t\tif err := app.Save(rec); err != nil { return err }`);
    lines.push(`\t\t}`);
  }
  batchBlocks.push(lines.join('\n'));
}

const migration2 = `package ${packageName}

import (
\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

func init() {
\tm.Register(func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId("geo_regions")
\t\tif err != nil {
\t\t\treturn err
\t\t}

${batchBlocks.join('\n\n')}

\t\treturn nil
\t}, func(app core.App) error {
\t\t_, err := app.DB().NewQuery("DELETE FROM geo_regions").Execute()
\t\treturn err
\t})
}
`;

// ─── Write files ──────────────────────────────────────────────────────────────

const file1 = path.join(outDir, `${TS_CREATE}_create_geo_regions.go`);
const file2 = path.join(outDir, `${TS_SEED}_seed_geo_regions.go`);

fs.writeFileSync(file1, migration1, 'utf8');
console.log(`\n✅ Written: ${file1}`);

fs.writeFileSync(file2, migration2, 'utf8');
console.log(`✅ Written: ${file2}`);

const seedSize = fs.statSync(file2).size;
console.log(`   Seed file size: ${(seedSize / 1024 / 1024).toFixed(2)} MB (${allAgs.size} regions)`);
if (seedSize > 50 * 1024 * 1024) {
  console.warn('⚠️  Seed file >50 MB — consider an external seeding script.');
}

console.log(`
Done. These migrations create and seed geo_regions only.
The kennzeichen↔geo_regions link is handled by:
  1747500003_create_kennzeichen_geo_regions.go  — junction table schema
  1747500004_seed_kennzeichen_geo_regions.go    — generated by link-geo-regions.cjs

Next steps:
  1. Start the server:  cd MKZ-pocketbase && go run . serve --dir pb_data
  2. Run the linker:    node MKZ-website/scripts/link-geo-regions.cjs --email ... --pass ...
  3. Apply migrations:  cd MKZ-pocketbase && go run . migrate up
`);
