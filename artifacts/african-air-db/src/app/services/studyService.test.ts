import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPollutants,
  getPollutantsByCategory,
  getCountrySummaries,
  getDatasetStats,
  getStudyById,
  getPublicStatistics,
  queryStudies,
} from "./studyService";

const filtersResponse = {
  countries: [
    {
      country: "Algeria",
      study_count: 1,
      cities: [
        {
          study_area: "Algiers City",
          study_count: 1,
          studies: [
            {
              id: "study-1",
              title: "Air quality in Algiers",
              methodology: "Filter sampling",
              start_year: null,
              end_year: null,
              site_description: "Urban site",
              source: "Example et al. 2018",
              sampling_period_raw: "2007",
              articles: [
                {
                  id: "article-1",
                  author: "Example et al. 2018",
                  journal: "Air Quality Journal",
                  identifier: "https://example.org/article",
                  title: "Air quality in Algiers",
                },
              ],
              measurements: [
                {
                  id: "measurement-1",
                  variable_id: "variable-1",
                  item_name: "∑PAHs",
                  category: "organic",
                  subcategory: "pah",
                  item_unit: "ng.m-3",
                  mean_value: 13,
                  sd_value: null,
                  min_value: null,
                  max_value: null,
                },
              ],
              methodologies: [],
            },
          ],
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public filters response", () => {
  it("uses measurement categories for pollutant catalog and study filtering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => filtersResponse,
      }),
    );

    const pollutants = await getPollutants();
    const result = await queryStudies({
      filters: { categories: ["Organic pollutants"] },
    });
    const nonMatchingResult = await queryStudies({
      filters: { categories: ["Trace metals"] },
    });
    const matchingCategoryAndPollutant = await queryStudies({
      filters: {
        categories: ["Organic pollutants"],
        pollutants: ["∑PAHs"],
      },
    });
    const nonMatchingPollutant = await queryStudies({
      filters: {
        categories: ["Organic pollutants"],
        pollutants: ["∑Alkanes"],
      },
    });
    const subcategorySearch = await queryStudies({
      filters: { query: "pah" },
    });

    expect(pollutants).toContainEqual(
      expect.objectContaining({
        key: "∑PAHs",
        category: "Organic pollutants",
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(nonMatchingResult.items).toHaveLength(0);
    expect(matchingCategoryAndPollutant.items).toHaveLength(1);
    expect(nonMatchingPollutant.items).toHaveLength(0);
    expect(subcategorySearch.items).toHaveLength(1);
    expect(result.items[0].records[0].measurements["∑PAHs"]).toMatchObject({
      category: "organic",
      subcategory: "pah",
      mean: 13,
    });
  });

  describe("public statistics response", () => {
    it("maps all homepage statistics from the API response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            total_studies: 289,
            total_countries: 32,
            total_study_areas: 128,
            total_authors: 241,
            total_articles: 288,
            total_journals: 246,
            total_measurements: 2251,
            total_variables: 95,
            year_range: { min: 1992, max: 2026 },
          }),
        }),
      );

      await expect(getPublicStatistics()).resolves.toEqual({
        totalStudies: 289,
        totalCountries: 32,
        totalStudyAreas: 128,
        totalAuthors: 241,
        totalArticles: 288,
        totalJournals: 246,
        totalMeasurements: 2251,
        totalVariables: 95,
        yearRange: { min: 1992, max: 2026 },
      });
    });

    it("rejects invalid statistic totals", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            total_studies: -1,
            total_countries: 32,
            total_study_areas: 128,
            total_authors: 241,
            total_articles: 288,
            total_journals: 246,
            total_measurements: 2251,
            total_variables: 95,
            year_range: { min: 1992, max: 2026 },
          }),
        }),
      );

      await expect(getPublicStatistics()).rejects.toThrow(
        "Statistics API returned an invalid total_studies",
      );
    });
  });

  it("loads available measurements and filters studies from methodology measurements", async () => {
    const response = structuredClone(filtersResponse);
    const study = response.countries[0].cities[0].studies[0];
    const corruptedSumName = `${String.fromCharCode(0x00e2, 0x0088, 0x0091)}Alkanes`;
    study.measurements = [];
    study.methodologies = [
      {
        methodology: "Filter sampling",
        study_area: "Algiers City",
        description: "Urban site",
        sampling_period_raw: "2007",
        start_year: 2007,
        end_year: 2007,
        measurements: [
          "PM2.5",
          "NO2",
          "Naphthalene",
          "Oxalate",
          corruptedSumName,
        ],
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => response,
      }),
    );

    const groups = await getPollutantsByCategory();
    const particulateStudies = await getCountrySummaries({
      categories: ["Bulk PM"],
      pollutants: ["PM2.5"],
    });
    const gasStudies = await getCountrySummaries({
      categories: ["Atmospheric Gases"],
      pollutants: ["NO2"],
    });
    const organicStudies = await getCountrySummaries({
      categories: ["Organic pollutants"],
      pollutants: ["Naphthalene"],
    });

    expect(groups.find((group) => group.category === "Bulk PM")?.pollutants)
      .toEqual([expect.objectContaining({ key: "PM2.5" })]);
    expect(
      groups.find((group) => group.category === "Atmospheric Gases")
        ?.pollutants,
    ).toEqual([expect.objectContaining({ key: "NO2" })]);
    expect(
      groups.find((group) => group.category === "Organic pollutants")
        ?.pollutants,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "Naphthalene" }),
        expect.objectContaining({ key: corruptedSumName, name: "∑Alkanes" }),
      ]),
    );
    expect(
      groups.find(
        (group) => group.category === "Water soluble inorganic aerosols",
      )?.pollutants,
    ).toEqual([expect.objectContaining({ key: "Oxalate" })]);
    expect(particulateStudies[0].studyCount).toBe(1);
    expect(particulateStudies[0].studies[0].records[0].measurements).toHaveProperty(
      "PM2.5",
    );
    expect(gasStudies[0].studyCount).toBe(1);
    expect(organicStudies[0].studyCount).toBe(1);
    expect(gasStudies[0].studies[0].records[0].measurements).toHaveProperty(
      "NO2",
    );
  });

  it("matches selected pollutants and categories when the API reports null values", async () => {
    const responseWithUnquantifiedMeasurement = structuredClone(filtersResponse);
    const study =
      responseWithUnquantifiedMeasurement.countries[0].cities[0].studies[0];
    study.measurements[0].mean_value = null;
    study.measurements[0].min_value = null;
    study.measurements[0].max_value = null;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => responseWithUnquantifiedMeasurement,
      }),
    );

    const summaries = await getCountrySummaries({
      categories: ["Organic pollutants"],
      pollutants: ["∑PAHs"],
    });

    expect(summaries).toMatchObject([
      {
        name: "Algeria",
        studyCount: 1,
        areas: [{ studyCount: 1 }],
      },
    ]);
  });

  it("derives detail-page years from the sampling period", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => filtersResponse,
      }),
    );

    const study = await getStudyById("study-1");

    expect(study).toMatchObject({ yearFrom: 2007, yearTo: 2007 });
  });

  it("builds map summaries from the nested country and city data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => filtersResponse,
      }),
    );

    const summaries = await getCountrySummaries();

    expect(summaries).toMatchObject([
      {
        name: "Algeria",
        studyCount: 1,
        totalStudyCount: 1,
        areas: [{ name: "Algiers", studyCount: 1 }],
      },
    ]);
  });

  it("keeps map and dataset loading working when measurements are null or omitted", async () => {
    const responseWithMissingMeasurements = structuredClone(filtersResponse);
    responseWithMissingMeasurements.countries[0].cities[0].studies[0]
      .measurements = null;
    responseWithMissingMeasurements.countries[0].cities[0].studies.push({
      ...responseWithMissingMeasurements.countries[0].cities[0].studies[0],
      id: "study-without-measurements",
      measurements: undefined,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => responseWithMissingMeasurements,
      }),
    );

    await expect(getCountrySummaries()).resolves.toMatchObject([
      { name: "Algeria", studyCount: 2, areas: [{ studyCount: 2 }] },
    ]);
    await expect(getPollutants()).resolves.toEqual([]);
    await expect(getDatasetStats()).resolves.toMatchObject({
      studyCount: 2,
      pollutantCount: 0,
    });
  });
});
