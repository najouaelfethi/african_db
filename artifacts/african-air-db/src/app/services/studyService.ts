import {
  AREA_COORDINATES,
  COUNTRY_CENTROIDS,
  COUNTRY_NAME_ALIASES,
  COUNTRY_TOPO_ID,
} from "../data/geo";
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

const PUBLIC_API_BASE = "/api/v1/public";

async function fetchMapData() {
  const response = await fetch(`${PUBLIC_API_BASE}/filters`);

  if (!response.ok) {
    throw new Error(`Map API error: ${response.status}`);
  }

  return response.json();
}
interface PublicApiMeasurement {
  id?: string;
  item_name: string;
  item_unit: string;
  category?: string | null;
  mean_value: number | null;
  sd_value?: number | null;
  min_value: number | null;
  max_value: number | null;
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
  methodology: string;
  start_year: number | null;
  end_year: number | null;
  site_description: string;
  source: string;
  sampling_period_raw: string;

  articles: PublicApiArticle[];

  measurements: PublicApiMeasurement[];
}
function getStudyYears(study: PublicApiStudy): {
  yearFrom: number | null;
  yearTo: number | null;
} {
  // Extract years from the sampling period, not from the publication source.
  const years = (study.sampling_period_raw ?? "").match(/\b(?:19|20)\d{2}\b/g);

  if (years && years.length > 0) {
    const parsedYears = years.map(Number);

    return {
      yearFrom: Math.min(...parsedYears),
      yearTo: Math.max(...parsedYears),
    };
  }

  // Fallback to API year fields if sampling_period_raw has no year.
  return {
    yearFrom: study.start_year,
    yearTo: study.end_year,
  };
}
function createMeasurements(
  measurements: PublicApiMeasurement[],
): Record<string, Measurement> {
  const result: Record<string, Measurement> = {};

  for (const measurement of measurements) {
    result[measurement.item_name] = {
      raw:
        measurement.mean_value !== null ? String(measurement.mean_value) : "",
      mean: measurement.mean_value,
      sd: measurement.sd_value ?? null,
      min: measurement.min_value,
      max: measurement.max_value,
    };
  }

  return result;
}

function createStudyRecord(
  study: PublicApiStudy,
  studyArea: string,
): SamplingRecord {
  return {
    id: 0,
    studyArea,
    methodology: study.methodology,
    samplingPeriod: study.sampling_period_raw,
    description: study.site_description,
    measurements: createMeasurements(study.measurements),
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

async function getPublicMapData(): Promise<PublicApiResponse> {
  return fetchMapData();
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
  return (
    AREA_COORDINATES[`${country}|${area}`] ?? COUNTRY_CENTROIDS[country] ?? null
  );
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
function isParticulateMatter(itemName: string): boolean {
  const name = itemName.trim().toUpperCase();

  return (
    name === "PM1" ||
    name === "PM2.5" ||
    name === "PM10" ||
    name === "PM2.5-10" ||
    name === "PM10-2.5" ||
    name === "TSP(TOTAL SUSPENDED PARTICLES)"
  );
}


export async function getPollutants(): Promise<PollutantInfo[]> {
  const response = await fetch(`${PUBLIC_API_BASE}/filters`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pollutants: ${response.status}`);
  }

  const data: PublicApiResponse = await response.json();

  const pollutants = new Map<string, PollutantInfo>();

  const categoryLabels: Record<string, string> = {
    bulk_pm: "Bulk PM",
    carbonaceous: "Carbonaceous aerosols",
    wsia: "Water soluble inorganic aerosols",
    trace_metals: "Trace metals",
    organic: "Organic pollutants",
    gas: "Atmospheric Gases",
  };

  // Use the API's category as the source of truth, with name-based fallback
  // for older or incomplete API records.
  const getCategory = (itemName: string): string => {
    // Bulk particulate matter
    if (["PM10", "PM2.5", "PM1", "Total Suspended Particles (TSP)"].includes(itemName)) {
      return "Bulk PM";
    }

    // Carbonaceous aerosols
    if (
      ["Black carbon (BC)","Organic carbon (OC)"].includes(
        itemName,
      )
    ) {
      return "Carbonaceous aerosols";
    }

    // Water soluble inorganic aerosols
    if (
      [
        "NO3-",
        "SO42-",
        "Cl-",
        "F-",
        "PO43-",
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

    // Trace metals
    if (
      [
        "∑Trace metals",
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
      ].includes(itemName)
    ) {
      return "Trace metals";
    }

    // Organic pollutants
    if (
      [
        "∑Alkanes",
        "∑PAHs",
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
      ].includes(itemName)
    ) {
      return "Organic pollutants";
    }

    // Atmospheric gases
    if (
      ["NO2", "NO", "SO2", "CH4", "NMHC", "NH3", "O3", "CO"].includes(itemName)
    ) {
      return "Atmospheric Gases";
    }

    // Keep unknown API variables visible instead of silently dropping them.
    return "Other";
  };

  for (const country of data.countries) {
    for (const city of country.cities) {
      for (const study of city.studies) {
        for (const measurement of study.measurements) {
          const category =
            (measurement.category && categoryLabels[measurement.category]) ||
            getCategory(measurement.item_name);
          const name =
            measurement.item_name === "TSP"
              ? "Total Suspended Particles (TSP)"
              : measurement.item_name;

          // Keep the API item_name as the key.
          if (!pollutants.has(measurement.item_name)) {
            pollutants.set(measurement.item_name, {
              key: measurement.item_name,
              name,
              category,
              unit: measurement.item_unit,
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
        for (const measurement of study.measurements) {
          pollutantNames.add(measurement.item_name);
        }
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
        if (study.site_description) {
          settings.add(study.site_description);
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
  for (const r of study.records)
    for (const k of Object.keys(r.measurements)) keys.add(k);
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

  // Category filtering will be handled from the API measurement type.
  // The old POLLUTANT_BY_KEY lookup is no longer used here.

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

  return true;
}

function sortStudies(items: Study[], sort: StudyQuery["sort"]): Study[] {
  const sorted = [...items];
  switch (sort) {
    case "yearDesc":
      sorted.sort((a, b) => (b.yearTo ?? -1) - (a.yearTo ?? -1));
      break;
    case "yearAsc":
      sorted.sort((a, b) => (a.yearFrom ?? 9999) - (b.yearFrom ?? 9999));
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
          yearFrom,
          yearTo,
          records: [createStudyRecord(apiStudy, city.study_area)],
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
          yearFrom: study.start_year,
          yearTo: study.end_year,
          records: [createStudyRecord(study, city.study_area)],
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

  const summaries: CountrySummary[] = data.countries.map((country) => {
    const countryName = canonicalCountryName(country.country);
    const areas: AreaSummary[] = country.cities.map((city) => {
      const areaName = canonicalAreaName(city.study_area);
      const coordinates =
        areaCoordinates(countryName, areaName) ??
        areaCoordinates(countryName, city.study_area) ??
        countryCoordinates(countryName);

      return {
        name: areaName,
        country: countryName,
        coordinates: coordinates ?? [0, 0],
        studyCount: city.study_count,
        settings: [],
        studies: city.studies.map((study) => {
          const { yearFrom, yearTo } = getStudyYears(study);

          return {
            id: study.id,
            source: study.source,
            title: study.title,
            yearFrom,
            yearTo,
          };
        }),
      };
    });

    const studies: Study[] = country.cities.flatMap((city) =>
      city.studies.map((study) => {
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
          records: [createStudyRecord(study, city.study_area)],
        };
      }),
    );

    const years = studies
      .flatMap((study) => [study.yearFrom, study.yearTo])
      .filter((year): year is number => year !== null);

    return {
      topoId: COUNTRY_TOPO_ID[countryName] ?? null,
      name: countryName,
      region: "",
      studyCount: country.study_count,
      recordCount: country.study_count,
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
