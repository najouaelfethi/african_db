import { describe, expect, it } from "vitest";
import type { Study } from "../types/arcair";
import { buildStudyCsv } from "./studyExport";

const study: Study = {
  id: "study-1",
  region: "",
  country: "Morocco",
  source: "Example et al. 2024",
  author: "A. Example",
  journal: "Air Quality Journal",
  identifier: "https://doi.org/example",
  title: "Air quality, an example study",
  dataProcessing: "",
  publicationYear: 2024,
  yearFrom: 2020,
  yearTo: 2021,
  records: [
    {
      id: 0,
      studyArea: "Rabat",
      methodology: "Field monitoring",
      samplingPeriod: "2020–2021",
      description: "Urban, residential",
      measurements: {
        pm25: { raw: "12.5", mean: 12.5, sd: 1.5, min: 9, max: 16 },
      },
    },
  ],
};

describe("buildStudyCsv", () => {
  it("exports readable study and measurement columns with correctly quoted values", () => {
    const csv = buildStudyCsv(
      [study],
      new Map([["pm25", { name: "PM2.5", unit: "µg/m³" }]]),
    );
    const [header, row] = csv.split("\r\n");

    expect(header).toContain('"Study title"');
    expect(header).toContain('"Publication year"');
    expect(header).toContain('"Standard deviation"');
    expect(row).toContain('"Air quality, an example study"');
    expect(row).toContain('"PM2.5","µg/m³","12.5","1.5","9","16"');
  });

  it("keeps studies with no measurements in the exported file", () => {
    const csv = buildStudyCsv([{ ...study, records: [] }]);
    const [, row] = csv.split("\r\n");

    expect(row).toContain('"Air quality, an example study"');
    expect(row).toContain('"Morocco"');
  });

  it("prevents text cells from being interpreted as spreadsheet formulas", () => {
    const csv = buildStudyCsv([{ ...study, title: "=SUM(1,1)" }]);

    expect(csv).toContain(`"'=SUM(1,1)"`);
  });
});
