/**
 * Transform the raw ARC-Air CSV export into a clean, typed JSON dataset
 * consumed by the frontend data services (src/app/services/).
 *
 * Usage: node scripts/transform-arcair.mjs <input.csv> <output.json>
 *
 * The CSV has 3 header rows:
 *  row 0: pollutant category groups (merged-cell style, carried forward)
 *  row 1: pollutant / column names (each pollutant spans 3 columns)
 *  row 2: Mean ( sd) / Min / Max sub-headers
 * Data rows use merged-cell style for Region / Country / Source: blank cells
 * continue the previous value.
 */
import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node transform-arcair.mjs <input.csv> <output.json>");
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inq = false;
      } else cur += ch;
    } else if (ch === '"') inq = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const clean = (s) =>
  (s ?? "")
    .replace(/\uFFFD/g, "é") // mojibake from the export (e.g. Coté d'Ivoire)
    .replace(/\s+/g, " ")
    .trim();

const rows = parseCSV(fs.readFileSync(inputPath, "utf8"));
const [catRow, nameRow] = rows;

// ---- Build pollutant column map (each pollutant = 3 columns: mean, min, max)
const META_END = 7; // cols 0..6 are sampling metadata
const TAIL_START = 217; // Data processing, Author, Journal, Identifier, Title
// Keys are category names with any parenthetical unit stripped (the raw
// export contains mojibake in the unit part, e.g. "(?g m-3)").
const CATEGORY_LABELS = {
  "Bulk PM": { label: "Bulk PM", unit: "µg/m³" },
  "Carbonaceous aerosols": { label: "Carbonaceous aerosols", unit: "µg/m³" },
  "Water soluble inorganic aerosols": {
    label: "Water soluble inorganic aerosols",
    unit: "µg/m³",
  },
  "Trace metals": { label: "Trace metals", unit: "ng/m³" },
  "Atmosphreric Gases": { label: "Atmospheric gases", unit: "ppb" },
};

const pollutants = [];
let currentCategory = "";
for (let c = META_END; c < TAIL_START; c += 3) {
  const rawCat = clean(catRow[c]);
  if (rawCat) currentCategory = rawCat;
  const name = clean(nameRow[c]);
  if (!name) continue;
  let categoryBase = currentCategory.replace(/\s*\(.*$/, "").trim();
  // The organics block (ΣAlkanes/ΣPAHs/ΣPCBs/ΣOCPs) has no category header
  // of its own in the export; give it a proper category.
  if (/^\?/.test(name)) categoryBase = "Organic pollutants";
  const catInfo = CATEGORY_LABELS[categoryBase] ?? {
    label: categoryBase || "Other",
    unit: "",
  };
  // Organics (alkanes, PAHs, PCBs, OCPs) carry their unit in the name
  let unit = catInfo.unit;
  const unitMatch = name.match(/\(([a-zµ]+ ?m-3)\)/i);
  if (unitMatch) unit = unitMatch[1].replace("ug", "µg").replace(" m-3", "/m³").replace("m-3", "/m³");
  if (name === "*CH4") unit = "ppm";
  let key = name
    .replace(/^\?/, "sum_")
    .replace(/\s*\((ng|pg|ug) m-3\)/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  // Guarantee unique keys: ions vs metals vs gases can normalize to the same
  // slug (e.g. Cl-/Cl, K+/K, Na+/Na, CO/Co). Suffix with a category slug.
  if (pollutants.some((p) => p.key === key)) {
    const catSlug = catInfo.label
      .replace(/[^A-Za-z0-9]+/g, "_")
      .toLowerCase()
      .split("_")[0];
    key = `${key}_${catSlug}`;
    if (pollutants.some((p) => p.key === key)) {
      throw new Error(`Duplicate pollutant key after suffixing: ${key}`);
    }
  }
  pollutants.push({
    key,
    name: name.replace(/^\?/, "Σ").replace(/\s*\((ng|pg|ug) m-3\)/i, "").replace(/^\*/, ""),
    category: catInfo.label,
    unit,
    colStart: c,
  });
}
// VOCs tail columns (223..225)
pollutants.push({
  key: "vocs",
  name: "VOCs",
  category: "Atmospheric gases",
  unit: "ppb",
  colStart: 223,
});

const parseNum = (s) => {
  const m = clean(s).replace(/,/g, "").match(/-?\d+(\.\d+)?([eE]-?\d+)?/);
  return m ? Number(m[0]) : null;
};

// "12.3 (4.5)" -> mean 12.3, sd 4.5
function parseMeanSd(raw) {
  const value = clean(raw);
  if (!value) return null;
  const mean = parseNum(value);
  const sdMatch = value.match(/\(([^)]+)\)/);
  const sd = sdMatch ? parseNum(sdMatch[1]) : null;
  return { raw: value, mean, sd };
}

// ---- Walk data rows, carrying Region / Country / Source forward
let region = "";
let country = "";
let sourceKey = "";
const studiesByKey = new Map();
let recordId = 0;

for (const r of rows.slice(3)) {
  if (!r.some((x) => clean(x))) continue;
  if (clean(r[0])) region = clean(r[0]);
  if (clean(r[1])) country = clean(r[1]);
  if (clean(r[2])) sourceKey = clean(r[2]);
  if (!sourceKey) continue;

  const mapKey = `${country}|${sourceKey}`;
  if (!studiesByKey.has(mapKey)) {
    studiesByKey.set(mapKey, {
      id: studiesByKey.size + 1,
      region,
      country,
      source: sourceKey,
      author: "",
      journal: "",
      identifier: "",
      title: "",
      dataProcessing: "",
      records: [],
    });
  }
  const study = studiesByKey.get(mapKey);
  // Study Area is also merged-cell style: blank cells continue the previous
  // area within the same source group.
  const prev = study.records[study.records.length - 1];
  const studyArea = clean(r[3]) || (prev ? prev.studyArea : "");
  if (clean(r[217])) study.dataProcessing = clean(r[217]);
  if (clean(r[218])) study.author = clean(r[218]);
  if (clean(r[219])) study.journal = clean(r[219]);
  if (clean(r[220])) study.identifier = clean(r[220]);
  if (clean(r[221])) study.title = clean(r[221]);

  const measurements = {};
  for (const p of pollutants) {
    const meanCell = parseMeanSd(r[p.colStart]);
    const min = parseNum(r[p.colStart + 1]);
    const max = parseNum(r[p.colStart + 2]);
    if (meanCell || min !== null || max !== null) {
      measurements[p.key] = {
        raw: meanCell?.raw ?? "",
        mean: meanCell?.mean ?? null,
        sd: meanCell?.sd ?? null,
        min,
        max,
      };
    }
  }

  study.records.push({
    id: ++recordId,
    studyArea,
    methodology: clean(r[4]),
    samplingPeriod: clean(r[5]),
    description: clean(r[6]),
    measurements,
  });
}

const studies = [...studiesByKey.values()];

// Derive sampling years from "2006 - 2015" style periods for filtering
for (const s of studies) {
  let from = null;
  let to = null;
  for (const rec of s.records) {
    const years = (rec.samplingPeriod.match(/(19|20)\d{2}/g) ?? []).map(Number);
    for (const y of years) {
      if (from === null || y < from) from = y;
      if (to === null || y > to) to = y;
    }
  }
  s.yearFrom = from;
  s.yearTo = to;
}

const dataset = {
  generatedAt: new Date().toISOString(),
  sourceFile: inputPath.split("/").pop(),
  pollutants: pollutants.map(({ colStart, ...p }) => p),
  studies,
};

fs.writeFileSync(outputPath, JSON.stringify(dataset));
console.log(
  `Wrote ${outputPath}: ${studies.length} studies, ${recordId} records, ${pollutants.length} pollutant columns`,
);
