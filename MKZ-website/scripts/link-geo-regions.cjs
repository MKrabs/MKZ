#!/usr/bin/env node
// MKZ-website/scripts/link-geo-regions.cjs

'use strict';

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}
const isDry = args.includes('--dry');

const pbUrl    = getArg('--url')   ?? 'http://localhost:8090';
const email    = getArg('--email') ?? process.env.SUPERUSER_EMAIL ?? '';
const pass     = getArg('--pass')  ?? process.env.SUPERUSER_PASS  ?? '';
const repoRoot = path.resolve(__dirname, '..', '..');
const outDir   = getArg('--out')   ?? path.join(repoRoot, 'MKZ-pocketbase/migrations');

const TS_LINK = 1747500004;

if (!email || !pass) {
  console.error('❌ Superuser credentials required.');
  console.error('   Set SUPERUSER_EMAIL and SUPERUSER_PASS env vars, or use --email / --pass flags.');
  process.exit(1);
}

// ─── Manual overrides ────────────────────────────────────────────────────────
// code → string[]   exact geo_regions.gen values to link (one junction per entry)
// code → []         intentionally no geo_region (true city-states only)

const MANUAL_OVERRIDES = {
  // ── Stadt + Landkreis pairs ───────────────────────────────────────────────
  'A':   ['Augsburg', 'Augsburg, Landkreis'],
  'AB':  ['Aschaffenburg', 'Aschaffenburg, Landkreis'],
  'AN':  ['Ansbach', 'Ansbach, Landkreis'],
  'BA':  ['Bamberg', 'Bamberg, Landkreis'],
  'BT':  ['Bayreuth', 'Bayreuth, Landkreis'],
  'CO':  ['Coburg', 'Coburg, Landkreis'],
  'FÜ':  ['Fürth', 'Fürth, Landkreis'],
  'HN':  ['Heilbronn', 'Heilbronn, Landkreis'],
  'HO':  ['Hof', 'Hof, Landkreis'],
  'KA':  ['Karlsruhe', 'Karlsruhe, Landkreis'],
  'KL':  ['Kaiserslautern', 'Kaiserslautern, Landkreis'],
  'KS':  ['Kassel', 'Kassel, Landkreis'],
  'LA':  ['Landshut', 'Landshut, Landkreis'],
  'M':   ['München', 'München, Landkreis'],
  'OL':  ['Oldenburg (Oldb)', 'Oldenburg, Landkreis'],
  'OS':  ['Osnabrück', 'Osnabrück, Landkreis'],
  'PA':  ['Passau', 'Passau, Landkreis'],
  'R':   ['Regensburg', 'Regensburg, Landkreis'],
  'RO':  ['Rosenheim', 'Rosenheim, Landkreis'],
  'SW':  ['Schweinfurt', 'Schweinfurt, Landkreis'],
  'WÜ':  ['Würzburg', 'Würzburg, Landkreis'],

  // ── Single region (collision resolution or name mismatch) ────────────────
  'AC':  ['Städteregion Aachen'],
  'BR':  ['Karlsruhe, Landkreis'],
  'BRB': ['Brandenburg an der Havel'],
  'BÜS': ['Konstanz'],
  'DLG': ['Dillingen a.d.Donau'],
  'F':   ['Frankfurt am Main'],
  'GÜ':  ['Rostock, Landkreis'],
  'H':   ['Region Hannover'],
  'HRO': ['Rostock'],
  'L':   ['Leipzig'],
  'MAK': ['Wunsiedel i.Fichtelgebirge'],
  'MU':  ['München, Landkreis'],
  'MUC': ['München'],
  'MÜ':  ['Mühldorf a.Inn'],
  'NEA': ['Neustadt a.d.Aisch-Bad Windsheim'],
  'NEW': ['Neustadt a.d.Waldnaab'],
  'NK':  ['Neunkirchen'],
  'NM':  ['Neumarkt i.d.OPf.'],
  'PAF': ['Pfaffenhofen a.d.Ilm'],
  'SB':  ['Regionalverband Saarbrücken'],
  'TR':  ['Trier', 'Trier-Saarburg'],
  'VK':  ['Regionalverband Saarbrücken'],
  'VOH': ['Neustadt a.d.Waldnaab'],
  'WEN': ['Weiden i.d.OPf.'],
  'WUN': ['Wunsiedel i.Fichtelgebirge'],

  // ── kreisangehörige Städte (belong to a Landkreis) ────────────────────────
  'HGW': ['Vorpommern-Greifswald'],
  'HST': ['Vorpommern-Rügen'],
  'HWI': ['Nordwestmecklenburg'],
  'IGB': ['Saarpfalz-Kreis'],
  'NB':  ['Mecklenburgische Seenplatte'],
  'NEC': ['Coburg', 'Coburg, Landkreis'],

  // ── Multi-district codes ──────────────────────────────────────────────────
  'AIB': ['München, Landkreis', 'Rosenheim, Landkreis'],
  'BH':  ['Ortenaukreis', 'Rastatt'],
  'BK':  ['Rems-Murr-Kreis', 'Schwäbisch Hall'],
  'BUL': ['Amberg-Sulzbach', 'Schwandorf'],
  'EBS': ['Bayreuth, Landkreis', 'Forchheim', 'Kulmbach'],
  'ESB': ['Amberg-Sulzbach', 'Bayreuth, Landkreis', 'Neustadt a.d.Waldnaab', 'Nürnberger Land'],
  'GEO': ['Haßberge', 'Schweinfurt, Landkreis'],
  'HCH': ['Freudenstadt', 'Zollernalbkreis'],
  'HD':  ['Heidelberg', 'Rhein-Neckar-Kreis'],
  'HU':  ['Main-Kinzig-Kreis'],
  'KEM': ['Bayreuth, Landkreis', 'Tirschenreuth'],
  'LF':  ['Altötting', 'Berchtesgadener Land', 'Traunstein'],
  'LH':  ['Coesfeld', 'Unna'],
  'MAI': ['Kelheim', 'Landshut, Landkreis'],
  'MAL': ['Landshut, Landkreis', 'Straubing-Bogen'],
  'MON': ['Städteregion Aachen', 'Düren'],
  'MÜB': ['Bayreuth, Landkreis', 'Hof, Landkreis'],
  'N':   ['Nürnberg', 'Nürnberger Land'],
  'NAB': ['Amberg-Sulzbach', 'Schwandorf'],
  'PAR': ['Kelheim', 'Neumarkt i.d.OPf.'],
  'PEG': ['Bayreuth, Landkreis', 'Forchheim', 'Nürnberger Land'],
  'PF':  ['Pforzheim', 'Enzkreis'],
  'PS':  ['Pirmasens', 'Südwestpfalz'],
  'REH': ['Hof, Landkreis', 'Wunsiedel i.Fichtelgebirge'],
  'ROD': ['Cham', 'Schwandorf'],
  'ROL': ['Kelheim', 'Landshut, Landkreis'],
  'SAN': ['Hof, Landkreis', 'Kronach', 'Kulmbach'],
  'SEF': ['Neustadt a.d.Aisch-Bad Windsheim'],
  'SEL': ['Wunsiedel i.Fichtelgebirge'],
  'SLE': ['Düren', 'Euskirchen'],
  'SLG': ['Ravensburg', 'Sigmaringen'],
  'SR':  ['Straubing', 'Straubing-Bogen'],
  'STO': ['Konstanz', 'Sigmaringen'],
  'UFF': ['Neustadt a.d.Aisch-Bad Windsheim'],
  'UL':  ['Ulm', 'Alb-Donau-Kreis'],
  'VIB': ['Landshut, Landkreis', 'Mühldorf a.Inn', 'Rottal-Inn'],
  'WER': ['Augsburg, Landkreis', 'Dillingen a.d.Donau'],
  'WOL': ['Freudenstadt', 'Ortenaukreis'],
  'WOR': ['Bad Tölz-Wolfratshausen', 'München, Landkreis', 'Starnberg'],
  'WS':  ['Mühldorf a.Inn', 'Rosenheim, Landkreis'],
  'ZW':  ['Zweibrücken', 'Südwestpfalz'],
  'ÜB':  ['Bodenseekreis', 'Ravensburg', 'Sigmaringen'],
  'HH':  ['Hamburg'],                  // Freie und Hansestadt Hamburg — single city-state geo entry
  'HB':  ['Bremen', 'Bremerhaven'],    // Stadt Bremen + Stadt Bremerhaven (X-9999 range)
  'HL':  ['Lübeck'],                   // Stadt Lübeck — kreisfreie Stadt, has geo entry
};

// ─── Normalize ────────────────────────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\b(landkreis|kreis|stadt|gemeinde|markt|flecken|amt)\b/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b[a-z]\.\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── PocketBase helpers ───────────────────────────────────────────────────────

async function pbFetch(urlPath, opts = {}) {
  const res = await fetch(`${pbUrl}${urlPath}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PocketBase ${opts.method ?? 'GET'} ${urlPath} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function authenticate() {
  console.log(`Authenticating as ${email}…`);
  const data = await pbFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password: pass }),
  });
  console.log('✅ Authenticated');
  return data.token;
}

async function fetchAllRecords(token, collection, fields) {
  const results = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ page: String(page), perPage: '200', fields, skipTotal: '1' });
    const data = await pbFetch(`/api/collections/${collection}/records?${params}`, {
      headers: { Authorization: token },
    });
    results.push(...data.items);
    if (data.items.length < 200) break;
    page++;
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const token = await authenticate();

  console.log('\nFetching kennzeichen…');
  const kennzeichen = await fetchAllRecords(token, 'kennzeichen', 'id,code,district_name');
  console.log(`  ${kennzeichen.length} records`);

  console.log('Fetching geo_regions…');
  const geoRegions = await fetchAllRecords(token, 'geo_regions', 'id,ags,gen');
  console.log(`  ${geoRegions.length} records`);

  // Build lookup maps.
  const geoByGen     = new Map();
  const geoByNorm    = new Map();
  const normConflict = new Set();

  for (const geo of geoRegions) {
    geoByGen.set(geo.gen, geo);
    const norm = normalize(geo.gen);
    if (geoByNorm.has(norm)) normConflict.add(norm);
    geoByNorm.set(norm, geo);
  }

  // ── Resolve each kennzeichen to 0..N geo_region IDs ──────────────────────

  const junctions = []; // { kzId, kzCode, kzName, geoId, geoGen, geoAgs, via }
  const skipped   = []; // intentionally empty []
  const unmatched = []; // no resolution found

  for (const kz of kennzeichen) {
    const code = kz.code;

    // Layer 1: manual override
    if (code in MANUAL_OVERRIDES) {
      const gens = MANUAL_OVERRIDES[code];
      if (gens.length === 0) {
        skipped.push({ code, name: kz.district_name });
        continue;
      }
      for (const gen of gens) {
        const geo = geoByGen.get(gen);
        if (geo) {
          junctions.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, geoId: geo.id, geoGen: geo.gen, geoAgs: geo.ags, via: 'override' });
        } else {
          unmatched.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, norm: `[OVERRIDE NOT FOUND: "${gen}"]` });
        }
      }
      continue;
    }

    // Layer 2: exact match on district_name
    const exactGeo = geoByGen.get(kz.district_name);
    if (exactGeo) {
      junctions.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, geoId: exactGeo.id, geoGen: exactGeo.gen, geoAgs: exactGeo.ags, via: 'exact' });
      continue;
    }

    // Layer 3: normalized match (no collision)
    const norm = normalize(kz.district_name);
    if (!normConflict.has(norm) && geoByNorm.has(norm)) {
      const geo = geoByNorm.get(norm);
      junctions.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, geoId: geo.id, geoGen: geo.gen, geoAgs: geo.ags, via: 'normalized' });
      continue;
    }

    // Layer 4: first token before " / "
    if (kz.district_name.includes(' / ')) {
      const firstPart = kz.district_name.split(' / ')[0].trim();
      const firstNorm = normalize(firstPart);
      const geo = geoByGen.get(firstPart) ?? (!normConflict.has(firstNorm) ? geoByNorm.get(firstNorm) : undefined);
      if (geo) {
        junctions.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, geoId: geo.id, geoGen: geo.gen, geoAgs: geo.ags, via: 'first-token' });
        continue;
      }
    }

    unmatched.push({ kzId: kz.id, kzCode: code, kzName: kz.district_name, norm });
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const coveredKz = new Set(junctions.map(j => j.kzId)).size;
  console.log(`\n📊 Results:`);
  console.log(`   Junction records:      ${junctions.length}`);
  console.log(`   Kennzeichen covered:   ${coveredKz} / ${kennzeichen.length}`);
  console.log(`   Skipped (city-states): ${skipped.length}`);
  console.log(`   Unmatched:             ${unmatched.length}`);

  if (skipped.length > 0) {
    console.log(`\nℹ️  City-states (no Landkreis geo_region):`);
    for (const s of skipped) console.log(`   ${s.code.padEnd(6)} ${s.name}`);
  }

  if (unmatched.length > 0) {
    console.log(`\n❌ Unmatched — add to MANUAL_OVERRIDES:`);
    console.log(`${'Code'.padEnd(6)} ${'district_name'.padEnd(50)} normalized`);
    console.log('─'.repeat(90));
    for (const u of unmatched) console.log(`${u.kzCode.padEnd(6)} ${u.kzName.padEnd(50)} ${u.norm}`);
    if (!isDry) {
      console.error('\n❌ Refusing to write migration with unmatched records.');
      process.exit(1);
    }
  } else {
    console.log(`\n✅ 100% coverage achieved.`);
  }

  if (isDry) {
    // Show multi-region codes
    const byCode = {};
    for (const j of junctions) {
      if (!byCode[j.kzCode]) byCode[j.kzCode] = [];
      byCode[j.kzCode].push(j.geoGen);
    }
    const multiEntries = Object.entries(byCode).filter(([, v]) => v.length > 1);
    console.log(`\n[dry run] Multi-region codes (${multiEntries.length}):`);
    for (const [code, gens] of multiEntries.sort()) {
      console.log(`  ${code.padEnd(6)} → ${gens.join(' + ')}`);
    }
    console.log(`\n[dry run] Skipping migration write.`);
    return;
  }

  // ── Write migration ────────────────────────────────────────────────────────

  let packageName = 'migrations';
  const existingGoFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.go'));
  if (existingGoFiles.length > 0) {
    const sample = fs.readFileSync(path.join(outDir, existingGoFiles[0]), 'utf8');
    const match  = sample.match(/^package\s+(\w+)/m);
    if (match) packageName = match[1];
  }

  const insertLines = junctions.map(j =>
    `\t\t{"${j.kzId}", "${j.geoId}"}, // ${j.kzCode} → ${j.geoGen} (${j.geoAgs}) [${j.via}]`
  ).join('\n');

  const deleteLines = junctions.map(j =>
    `\t\t"${j.kzId}", // ${j.kzCode}`
  ).join('\n');

  const migration = `package ${packageName}

import (
\t"github.com/pocketbase/pocketbase/core"
\tm "github.com/pocketbase/pocketbase/migrations"
)

// Populates kennzeichen_geo_regions junction table.
// Generated by link-geo-regions.cjs
//   Junction records:      ${junctions.length}
//   Kennzeichen covered:   ${coveredKz} / ${kennzeichen.length}
//   Skipped (city-states): ${skipped.length}
func init() {
\tm.Register(func(app core.App) error {
\t\tcollection, err := app.FindCollectionByNameOrId("kennzeichen_geo_regions")
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\tlinks := [][2]string{
${insertLines}
\t\t}

\t\tfor _, link := range links {
\t\t\trec := core.NewRecord(collection)
\t\t\trec.Set("kennzeichen", link[0])
\t\t\trec.Set("geo_region", link[1])
\t\t\tif err := app.Save(rec); err != nil {
\t\t\t\treturn err
\t\t\t}
\t\t}
\t\treturn nil
\t}, func(app core.App) error {
\t\t_, err := app.DB().NewQuery("DELETE FROM kennzeichen_geo_regions").Execute()
\t\treturn err
\t})
}
`;

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${TS_LINK}_seed_kennzeichen_geo_regions.go`);
  fs.writeFileSync(outFile, migration, 'utf8');
  console.log(`\n✅ Written: ${outFile}`);
  console.log(`\nApply with:\n  cd MKZ-pocketbase && go run . migrate up`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
