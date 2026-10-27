import {
  AREA_COORDINATES,
  COUNTRY_CENTROIDS,
  COUNTRY_NAME_ALIASES,
  COUNTRY_TOPO_ID,
} from "../data/geo";
import { apiUrl } from "./apiUrl";
import type {
  ArcAirDataset,
  AreaSummary,
  CountrySummary,
  DatasetStats,
  Measurement,
  PagedResult,
  PollutantInfo,
  SamplingRecord,
  Study,
  StudyFilters,
  StudyQuery,
} from "../types/arcair";

async function fetchMapData() {
  const response = await fetch(apiUrl("/api/v1/public/filters"));

  if (!response.ok) {
    throw new Error(`Map API error: ${response.status}`);
  }

  return response.json();
}
interface PublicApiMeasurement {
  id?: string;
  variable_id?: string;
  item_name: string;
  item_unit?: string;
  category?: string | null;
  subcategory?: string | null;
  mean_value?: number | null;
  sd_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
}

interface PublicApiMethodology {
  id?: string;
  methodology?: string;
  study_area?: string;
  description?: string;
  sampling_period_raw?: string;
  start_year?: number | null;
  end_year?: number | null;
  measurements?: string[];
}

interface PublicApiArticle {
  id: string;
  author: string;
  journal: string;
  identifier: string;
  title: string;
}

interface PublicApiStudy {
  id: string;
  title: string;
  methodology?: string;
  start_year?: number | null;
  end_year?: number | null;
  site_description?: string;
  source: string;
  sampling_period_raw?: string;

  articles: PublicApiArticle[];

  measurements?: PublicApiMeasurement[] | null;
  methodologies?: PublicApiMethodology[] | null;
}
function getStudyYears(study: PublicApiStudy): {
  yearFrom: number | null;
  yearTo: number | null;
} {
  const allYears = [
    study.sampling_period_raw,
    ...(study.methodologies ?? []).map((methodology) =>
      methodology.sampling_period_raw ?? "",
    ),
  ]
    .join(" ")
    .match(/\b(?:19|20)\d{2}\b/g);

  if (allYears && allYears.length > 0) {
    const parsedYears = allYears.map(Number);

    return {
      yearFrom: Math.min(...parsedYears),
      yearTo: Math.max(...parsedYears),
    };
  }

  const years = [
    study.start_year,
    study.end_year,
    ...(study.methodologies ?? []).flatMap((methodology) => [
      methodology.start_year,
      methodology.end_year,
    ]),
  ].filter((year): year is number => typeof year === "number");

  if (years.length > 0) {
    return { yearFrom: Math.min(...years), yearTo: Math.max(...years) };
  }

  return {
    yearFrom: null,
    yearTo: null,
  };
}

function getPublicationYear(source: string): number | null {
  const match = source.match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function createMeasurements(
  measurements: PublicApiMeasurement[],
  names: string[] = [],
): Record<string, Measurement> {
  const result: Record<string, Measurement> = {};

  for (const measurement of measurements) {
    result[measurement.item_name] = {
      raw:
        measurement.mean_value != null ? String(measurement.mean_value) : "",
      mean: measurement.mean_value ?? null,
      sd: measurement.sd_value ?? null,
      min: measurement.min_value ?? null,
      max: measurement.max_value ?? null,
      category:
        measurement.category ?? inferredCategoryKey(measurement.item_name),
      subcategory: measurement.subcategory ?? null,
    };
  }

  for (const name of names) {
    if (result[name]) continue;
    result[name] = {
      raw: "",
      mean: null,
      sd: null,
      min: null,
      max: null,
      category: inferredCategoryKey(name),
      subcategory: null,
    };
  }

  return result;
}

function createStudyRecord(
  study: PublicApiStudy,
  studyArea: string,
  methodology?: PublicApiMethodology,
): SamplingRecord {
  const methodArea = methodology?.study_area ?? studyArea;
  return {
    id: 0,
    studyArea: methodArea,
    methodology: methodology?.methodology ?? study.methodology ?? "",
    samplingPeriod:
      methodology?.sampling_period_raw ?? study.sampling_period_raw ?? "",
    description: methodology?.description ?? study.site_description ?? "",
    measurements: createMeasurements(
      getStudyMeasurements(study),
      methodology?.measurements ?? [],
    ),
  };
}

interface PublicApiCity {
  study_area: string;
  study_count: number;
  studies: PublicApiStudy[];
}

interface PublicApiCountry {
  country: string;
  study_count: number;
  cities: PublicApiCity[];
}

interface PublicApiResponse {
  countries: PublicApiCountry[];
}

const API_CATEGORY_LABELS: Record<string, string> = {
  bulk_pm: "Bulk PM",
  carbonaceous: "Carbonaceous aerosols",
  wsia: "Water soluble inorganic aerosols",
  trace_metals: "Trace metals",
  organic: "Organic pollutants",
  gas: "Atmospheric Gases",
};

function normalizeMeasurementName(itemName: string): string {
  const corruptedSumSymbol = String.fromCharCode(0x00e2, 0x0088, 0x0091);
  return itemName.startsWith(corruptedSumSymbol)
    ? `∑${itemName.slice(corruptedSumSymbol.length)}`
    : itemName;
}

function getCategory(rawItemName: string): string {
  const itemName = normalizeMeasurementName(rawItemName);
  if (
    ["PM10", "PM2.5", "PM1", "TSP", "Total Suspended Particles (TSP)"].includes(
      itemName,
    )
  ) {
    return "Bulk PM";
  }
  if (
    ["BC", "OC", "Black carbon (BC)", "Organic carbon (OC)"].includes(
      itemName,
    )
  ) {
    return "Carbonaceous aerosols";
  }
  if (
    [
      "NO3-",
      "SO42-",
      "Cl-",
      "F-",
      "PO43-",
      "Oxalate",
      "Oxalate (C2O42-)",
      "NH4+",
      "K+",
      "Na+",
      "Fe2+/Fe3+",
      "Mg2+",
      "Ca2+",
    ].includes(itemName)
  ) {
    return "Water soluble inorganic aerosols";
  }
  if (
    [
      "Na",
      "Mg",
      "Al",
      "Si",
      "P",
      "Cl",
      "K",
      "Ca",
      "Ti",
      "V",
      "Cr",
      "Mn",
      "Fe",
      "Co",
      "Ni",
      "Cu",
      "Zn",
      "As",
      "Se",
      "Sr",
      "Cd",
      "Ba",
      "Pb",
    ].includes(itemName) ||
    itemName.includes("Trace metals")
  ) {
    return "Trace metals";
  }
  if (
    [
      "∑Alkanes",
      "∑PAHs",
      "Naphthalene",
      "Naphtalene",
      "Acenaphthylene",
      "Acenaphthene",
      "Fluorene",
      "Phenanthrene",
      "Anthracene",
      "Fluoranthene",
      "Pyrene",
      "Benzo[a]anthracene",
      "Benzo[a]pyrene",
      "Benzo[e]pyrene",
      "Benzo[b]fluoranthene",
      "Benzo[k]fluoranthene",
      "Benzo[ghi]perylene",
      "Chrysene",
      "Dibenzo[a,h]anthracene",
      "Indeno[1,2,3-cd]pyrene",
      "∑PCBs",
      "∑OCPs",
      "VOCs",
    ].includes(itemName) ||
    ["Alkanes", "PAHs", "PCBs", "OCPs"].some((name) =>
      itemName.includes(name),
    )
  ) {
    return "Organic pollutants";
  }
  if (["NO2", "NO", "SO2", "CH4", "NMHC", "NH3", "O3", "CO"].includes(itemName)) {
    return "Atmospheric Gases";
  }
  return "Other";
}

function inferredCategoryKey(itemName: string): string | null {
  const category = getCategory(itemName);
  return (
    Object.entries(API_CATEGORY_LABELS).find(([, label]) => label === category)?.[0] ??
    null
  );
}

interface PublicApiStatistics {
  total_measurements?: unknown;
  total_variables?: unknown;
  year_range?: {
    min?: unknown;
    max?: unknown;
  };
}

async function getPublicMapData(): Promise<PublicApiResponse> {
  return fetchMapData();
}

function getStudyMeasurements(
  study: PublicApiStudy,
): PublicApiMeasurement[] {
  return Array.isArray(study.measurements) ? study.measurements : [];
}

function getStudyMeasurementNames(study: PublicApiStudy): string[] {
  return [
    ...getStudyMeasurements(study).map((measurement) => measurement.item_name),
    ...(study.methodologies ?? []).flatMap(
      (methodology) => methodology.measurements ?? [],
    ),
  ];
}

function getStudyRecords(
  study: PublicApiStudy,
  fallbackArea: string,
): SamplingRecord[] {
  const methodologies = study.methodologies ?? [];
  return methodologies.length > 0
    ? methodologies.map((methodology) =>
        createStudyRecord(study, fallbackArea, methodology),
      )
    : [createStudyRecord(study, fallbackArea)];
}
export async function getPublicationYearRange(): Promise<{ min: number; max: number }> {
  const statistics = await fetchPublicStatistics();
  const { min, max } = statistics.year_range ?? {};
  if (
    typeof min !== "number" ||
    !Number.isInteger(min) ||
    typeof max !== "number" ||
    !Number.isInteger(max) ||
    min > max
  ) {
    throw new Error("Statistics API returned an invalid year_range");
  }

  return { min, max };
}

export async function getPublicStatisticsCounts(): Promise<{
  totalMeasurements: number;
  totalVariables: number;
}> {
  const statistics = await fetchPublicStatistics();
  const { total_measurements, total_variables } = statistics;
  if (
    typeof total_measurements !== "number" ||
    !Number.isSafeInteger(total_measurements) ||
    total_measurements < 0 ||
    typeof total_variables !== "number" ||
    !Number.isSafeInteger(total_variables) ||
    total_variables < 0
  ) {
    throw new Error("Statistics API returned invalid measurement or variable totals");
  }

  return {
    totalMeasurements: total_measurements,
    totalVariables: total_variables,
  };
}

async function fetchPublicStatistics(): Promise<PublicApiStatistics> {
  const response = await fetch(apiUrl("/api/v1/public/statistics"));
  if (!response.ok) {
    throw new Error(`Statistics API error: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Statistics API returned an invalid response");
  }

  return payload as PublicApiStatistics;
}

/*Test API temporary*/
export async function testMapApi() {
  const data = await fetchMapData();
  console.log("MAP API DATA:", data);
  return data;
}

export function canonicalCountryName(raw: string): string {
  return COUNTRY_NAME_ALIASES[raw] ?? raw;
}

/**
 * Canonical area (city/site) name: strips "City" / "city of" decorations and
 * unifies duplicate spellings so "Tetouan City" and "Tetouan city" merge.
 * Multi-site labels like "Pretoria - Rosslyn" collapse to the parent city.
 */
export function canonicalAreaName(raw: string): string {
  let name = raw.trim().replace(/\.$/, "");
  name = name.replace(/^city of\s+/i, "");
  name = name.replace(/\s+city$/i, "");
  name = name.replace(/^City of\s+/i, "");
  if (
    /^Pretoria(\s*[-–]| west)/i.test(name) ||
    name === "University of Pretoria"
  ) {
    return "Pretoria";
  }
  if (/^Boskrans/.test(name)) return "Boskrans";
  if (/^Khatoum$/i.test(name)) return "Khartoum";
  return name;
}

function areaCoordinates(
  country: string,
  area: string,
): [number, number] | null {
  return AREA_COORDINATES[`${country}|${area}`] ?? null;
}

function countryCoordinates(country: string): [number, number] | null {
  const direct = COUNTRY_CENTROIDS[country];
  if (direct) return direct;

  // Multi-country API entries have no single country centroid. Use the
  // geographic center of the listed countries rather than plotting at 0, 0.
  const names = country
    .split(/,\s*|\s+and\s+/i)
    .map((name) => canonicalCountryName(name.trim()))
    .filter(Boolean);
  if (names.length < 2) return null;

  const centers = names.map((name) => COUNTRY_CENTROIDS[name]);
  if (centers.some((center) => !center)) return null;

  return [
    centers.reduce((sum, center) => sum + center![0], 0) / centers.length,
    centers.reduce((sum, center) => sum + center![1], 0) / centers.length,
  ];
}
export async function getPollutants(): Promise<PollutantInfo[]> {
  const response = await fetch(apiUrl("/api/v1/public/filters"));

  if (!response.ok) {
    throw new Error(`Failed to fetch pollutants: ${response.status}`);
  }

  const data: PublicApiResponse = await response.json();

  const pollutants = new Map<string, PollutantInfo>();

  const pollutantDisplayNames: Record<string, string> = {
    TSP: "Total Suspended Particles (TSP)",
    BC: "Black carbon (BC)",
    OC: "Organic carbon (OC)",
    CH4: "*CH4",
  };

  for (const country of data.countries) {
    for (const city of country.cities) {
      for (const study of city.studies) {
        const measurementsByName = new Map(
          getStudyMeasurements(study).map((measurement) => [
            measurement.item_name,
            measurement,
          ]),
        );
        for (const itemName of getStudyMeasurementNames(study)) {
          const measurement = measurementsByName.get(itemName);
          const category =
            (measurement?.category &&
              API_CATEGORY_LABELS[measurement.category]) ||
            getCategory(itemName);
          const name =
            pollutantDisplayNames[normalizeMeasurementName(itemName)] ??
            normalizeMeasurementName(itemName);

          if (!pollutants.has(itemName)) {
            pollutants.set(itemName, {
              key: itemName,
              name,
              category,
              unit: measurement?.item_unit ?? "",
            });
          }
        }
      }
    }
  }

  return Array.from(pollutants.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getPollutantsByCategory(): Promise<
  { category: string; pollutants: PollutantInfo[] }[]
> {
  const pollutants = await getPollutants();

  const groups = new Map<string, PollutantInfo[]>();

  for (const pollutant of pollutants) {
    const list = groups.get(pollutant.category) ?? [];
    list.push(pollutant);
    groups.set(pollutant.category, list);
  }

  return [...groups.entries()].map(([category, pollutants]) => ({
    category,
    pollutants,
  }));
}

export async function getDatasetStats(): Promise<DatasetStats> {
  const data = await getPublicMapData();

  const countries = new Set<string>();
  const areas = new Set<string>();

  let studyCount = 0;
  let yearFrom: number | null = null;
  let yearTo: number | null = null;

  const pollutantNames = new Set<string>();

  for (const country of data.countries) {
    countries.add(country.country);

    for (const city of country.cities) {
      areas.add(`${country.country}|${city.study_area}`);

      for (const study of city.studies) {
        studyCount++;

        const { yearFrom: studyYearFrom, yearTo: studyYearTo } =
          getStudyYears(study);

        if (studyYearFrom !== null && studyYearFrom > 0) {
          if (yearFrom === null || studyYearFrom < yearFrom) {
            yearFrom = studyYearFrom;
          }
        }

        if (studyYearTo !== null && studyYearTo > 0) {
          if (yearTo === null || studyYearTo > yearTo) {
            yearTo = studyYearTo;
          }
        }

        // Count all unique measurement variables.
        getStudyMeasurementNames(study).forEach((name) =>
          pollutantNames.add(name),
        );
      }
    }
  }

  console.log("DATASET STATS:", {
    studyCount,
    yearFrom,
    yearTo,
    countryCount: countries.size,
    areaCount: areas.size,
  });

  return {
    studyCount,
    recordCount: studyCount,
    countryCount: countries.size,
    areaCount: areas.size,
    yearFrom,
    yearTo,
    pollutantCount: pollutantNames.size,
  };
}

/** Regions are not provided by the public Map API. */
export async function getRegions(): Promise<string[]> {
  return [];
}

export async function getSettings(): Promise<string[]> {
  const data = await getPublicMapData();

  const settings = new Set<string>();

  for (const country of data.countries) {
    for (const city of country.cities) {
      for (const study of city.studies) {
        if (study.site_description) settings.add(study.site_description);
        for (const methodology of study.methodologies ?? []) {
          if (methodology.description) settings.add(methodology.description);
        }
      }
    }
  }

  return [...settings].sort();
}

// ---------------------------------------------------------------------------
// Studies: querying, filtering, sorting, pagination
// ---------------------------------------------------------------------------

function studyPollutantKeys(study: Study): Set<string> {
  const keys = new Set<string>();
  for (const record of study.records) {
    for (const key of Object.keys(record.measurements)) {
      keys.add(key);
    }
  }
  return keys;
}

function matchesFilters(study: Study, filters: StudyFilters): boolean {
  const query = filters.query?.trim().toLowerCase();

  if (query) {
    const keys = studyPollutantKeys(study);

    const haystack = [
      study.title,
      study.author,
      study.source,
      study.journal,
      study.country,
      study.region,
      ...study.records.map((r) => r.studyArea),
      ...study.records.map((r) => r.description),
      ...study.records.map((r) => r.methodology),
      ...keys,
      ...study.records.flatMap((record) =>
        Object.values(record.measurements).flatMap((measurement) => [
          measurement.category ?? "",
          measurement.category
            ? API_CATEGORY_LABELS[measurement.category] ?? ""
            : "",
          measurement.subcategory ?? "",
        ]),
      ),
    ]
      .join(" \n ")
      .toLowerCase();

    if (!haystack.includes(query)) return false;
  }

  if (filters.countries?.length && !filters.countries.includes(study.country)) {
    return false;
  }

  if (filters.regions?.length && !filters.regions.includes(study.region)) {
    return false;
  }

  if (filters.pollutants?.length) {
    const keys = studyPollutantKeys(study);

    if (!filters.pollutants.some((key) => keys.has(key))) {
      return false;
    }
  }

  if (filters.categories?.length) {
    const categories = new Set(
      study.records.flatMap((record) =>
        Object.values(record.measurements).flatMap((measurement) => {
            if (!measurement.category) return [];
            return [
              measurement.category,
              API_CATEGORY_LABELS[measurement.category] ??
                measurement.category,
            ];
          }),
      ),
    );

    if (!filters.categories.some((category) => categories.has(category))) {
      return false;
    }
  }

  if (filters.settings?.length) {
    const ok = filters.settings.some((setting) =>
      study.records.some((record) =>
        record.description.toLowerCase().includes(setting.toLowerCase()),
      ),
    );

    if (!ok) return false;
  }

  if (filters.yearFrom !== undefined && study.yearTo !== null) {
    if (study.yearTo < filters.yearFrom) return false;
  }

  if (filters.yearTo !== undefined && study.yearFrom !== null) {
    if (study.yearFrom > filters.yearTo) return false;
  }

  if (
    filters.publicationYearFrom !== undefined ||
    filters.publicationYearTo !== undefined
  ) {
    const publicationYear = study.publicationYear;
    if (publicationYear === null || publicationYear === undefined) return false;
    if (
      filters.publicationYearFrom !== undefined &&
      publicationYear < filters.publicationYearFrom
    ) {
      return false;
    }
    if (
      filters.publicationYearTo !== undefined &&
      publicationYear > filters.publicationYearTo
    ) {
      return false;
    }
  }

  return true;
}

function sortStudies(items: Study[], sort: StudyQuery["sort"]): Study[] {
  const sorted = [...items];
  switch (sort) {
    case "yearDesc":
      sorted.sort(
        (a, b) => (b.publicationYear ?? -1) - (a.publicationYear ?? -1),
      );
      break;
    case "yearAsc":
      sorted.sort(
        (a, b) => (a.publicationYear ?? 9999) - (b.publicationYear ?? 9999),
      );
      break;
    case "titleAsc":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "countryAsc":
      sorted.sort((a, b) => a.country.localeCompare(b.country));
      break;
    default:
      break; // "relevance" keeps dataset order
  }
  return sorted;
}

/**
 * Query studies with filtering, sorting, and pagination.
 * Uses the public Map API as the source of truth.
 */
export async function queryStudies(
  query: StudyQuery = {},
): Promise<PagedResult<Study>> {
  const filters = query.filters ?? {};
  const data = await getPublicMapData();

  const studies: Study[] = [];

  for (const country of data.countries) {
    for (const city of country.cities) {
      for (const apiStudy of city.studies) {
        const { yearFrom, yearTo } = getStudyYears(apiStudy);

        studies.push({
          id: apiStudy.id,
          region: "",
          country: country.country,
          source: apiStudy.source,
          author: apiStudy.articles[0]?.author ?? "",
          journal: apiStudy.articles[0]?.journal ?? "",
          identifier: apiStudy.articles[0]?.identifier ?? "",
          title: apiStudy.title,
          dataProcessing: "",
          publicationYear: getPublicationYear(apiStudy.source),
          yearFrom,
          yearTo,
          records: getStudyRecords(apiStudy, city.study_area),
        });
      }
    }
  }

  const filtered = sortStudies(
    studies.filter((study) => matchesFilters(study, filters)),
    query.sort ?? "relevance",
  );

  const pageSize = query.pageSize ?? 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
  };
}
export async function getStudyById(id: string): Promise<Study | undefined> {
  const data = await getPublicMapData();

  for (const country of data.countries) {
    for (const city of country.cities) {
      const study = city.studies.find((item) => item.id === id);

      if (study) {
        const { yearFrom, yearTo } = getStudyYears(study);

        return {
          id: study.id,
          region: "",
          country: country.country,
          source: study.source,
          author: study.articles[0]?.author ?? "",
          journal: study.articles[0]?.journal ?? "",
          identifier: study.articles[0]?.identifier ?? "",
          title: study.title,
          dataProcessing: "",
          yearFrom,
          yearTo,
          records: getStudyRecords(study, city.study_area),
        };
      }
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Map aggregates
// ---------------------------------------------------------------------------

let countrySummariesCache: CountrySummary[] | null = null;

export async function getCountrySummaries(
  filters?: StudyFilters,
): Promise<CountrySummary[]> {
  const data = await getPublicMapData();
  const hasActiveFilters = Boolean(filters && Object.keys(filters).length > 0);
  const noPollutantsSelected =
    filters?.pollutants !== undefined && filters.pollutants.length === 0;

  const summaries: CountrySummary[] = data.countries.map((country) => {
    const countryName = canonicalCountryName(country.country);
    const cityStudies = country.cities.map((city) => {
      const areaName = canonicalAreaName(city.study_area);
      const preciseCoordinates =
        areaCoordinates(countryName, areaName) ??
        areaCoordinates(countryName, city.study_area);
      const coordinates =
        preciseCoordinates ?? countryCoordinates(countryName);

      const studies: Study[] = city.studies.map((study) => {
        const { yearFrom, yearTo } = getStudyYears(study);

        return {
          id: study.id,
          region: "",
          country: countryName,
          source: study.source,
          author: study.articles[0]?.author ?? "",
          journal: study.articles[0]?.journal ?? "",
          identifier: study.articles[0]?.identifier ?? "",
          title: study.title,
          dataProcessing: "",
          yearFrom,
          yearTo,
          records: getStudyRecords(study, city.study_area),
        };
      });
      const matchingStudies = noPollutantsSelected
        ? []
        : hasActiveFilters
          ? studies.filter((study) => matchesFilters(study, filters!))
          : studies;

      return {
        city,
        areaName,
        coordinates,
        hasPreciseCoordinates: preciseCoordinates !== null,
        matchingStudies,
      };
    });

    const studies = cityStudies.flatMap(({ matchingStudies }) => matchingStudies);
    const areas: AreaSummary[] = cityStudies
      .filter(({ matchingStudies }) =>
        hasActiveFilters ? matchingStudies.length > 0 : true,
      )
       .map(({ areaName, coordinates, hasPreciseCoordinates, matchingStudies }) => ({
        name: areaName,
        country: countryName,
        coordinates: coordinates ?? [0, 0],
        hasPreciseCoordinates,
        studyCount: matchingStudies.length,
        settings: [],
        studies: matchingStudies.map((study) => ({
          id: study.id,
          source: study.source,
          title: study.title,
        })),
      }));

    const years = studies
      .flatMap((study) => [study.yearFrom, study.yearTo])
      .filter((year): year is number => year !== null);

    return {
      topoId: COUNTRY_TOPO_ID[countryName] ?? null,
      name: countryName,
      region: "",
      studyCount: studies.length,
      totalStudyCount: country.study_count,
      recordCount: studies.length,
      yearFrom: years.length ? Math.min(...years) : null,
      yearTo: years.length ? Math.max(...years) : null,
      areas,
      studies,
    };
  });

  return summaries;
}

/** All mapped study areas across countries (for the "Cities" map mode). */
export async function getAllAreas(
  filters?: StudyFilters,
): Promise<AreaSummary[]> {
  const summaries = await getCountrySummaries(filters);
  return summaries.flatMap((c) => c.areas);
}
