import { describe, expect, it } from "vitest";
import type { Study } from "../types/arcair";
import { buildStudyCsv } from "./studyExport";

const study: Study = {
  id: "study-1",
  region: "Northern Africa",
  country: "Morocco",
  source: "Example et al. 2024",
  author: "A. Example",
  journal: "Air Quality Journal",
  identifier: "https://doi.org/example",
  title: 'Air quality, an "example"\nstudy',
  dataProcessing: "Observations",
  publicationYear: 2024,
  yearFrom: 2020,
  yearTo: 2021,
  records: [
    {
      id: 1,
      studyArea: "Rabat",
      methodology: "Field monitoring",
      samplingPeriod: "2020-2021",
      description: "Urban, residential",
      measurements: {
        pm25: { raw: "12.5", mean: 12.5, sd: 1.5, min: 9, max: 16 },
        pm10: { raw: "30", mean: 30, sd: null, min: null, max: null },
      },
    },
    {
      id: 2,
      studyArea: "Rabat",
      methodology: "Field monitoring",
      samplingPeriod: "2020-2021",
      description: "Urban, residential",
      measurements: {
        pm25: { raw: "10", mean: 10, sd: null, min: null, max: null },
      },
    },
  ],
};

const info = new Map([
  ["pm10", { name: "PM10", unit: "µg/m³" }],
  ["pm25", { name: "PM2.5", unit: "µg/m³" }],
]);

// Minimal RFC 4180 parser to prove the column structure survives quoting.
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

describe("buildStudyCsv", () => {
  it("exports one row for a study with several pollutants and records", () => {
    const rows = parse(buildStudyCsv([study], info));
    const [header, row] = rows;

    expect(rows).toHaveLength(2);
    expect(row).toHaveLength(header.length);
    const get = (name: string) => row[header.indexOf(name)];
    expect(get("Study ID")).toBe("study-1");
    expect(get("Study title")).toBe('Air quality, an "example" study');
    expect(get("Pollutant")).toBe("PM10; PM2.5");
    expect(get("Study area")).toBe("Rabat");
    expect(get("Methodology")).toBe("Field monitoring");
    expect(get("Record ID")).toBe("1; 2");
    expect(get("Mean value")).toBe(
      "PM10 (Rabat): 30; PM2.5 (Rabat): 12.5; PM2.5 (Rabat): 10",
    );
    expect(get("Unit")).toBe("PM10: µg/m³; PM2.5: µg/m³");
  });

  it("exports one row per filtered study and merges duplicate study ids", () => {
    const other: Study = {
      ...study,
      id: "study-2",
      title: "Second",
      records: [study.records[1]],
    };
    const rows = parse(
      buildStudyCsv([study, other, { ...study, records: [] }], info),
    );

    expect(rows.map((r) => r[0])).toEqual(["Study ID", "study-1", "study-2"]);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
  });

  it("keeps studies with no measurements", () => {
    const rows = parse(buildStudyCsv([{ ...study, records: [] }]));
    expect(rows[1][1]).toContain("Air quality");
    expect(rows[1][rows[0].indexOf("Pollutant")]).toBe("");
  });

  it("prevents text cells from being interpreted as spreadsheet formulas", () => {
    expect(buildStudyCsv([{ ...study, title: "=SUM(1,1)" }])).toContain(
      `"'=SUM(1,1)"`,
    );
  });
});
