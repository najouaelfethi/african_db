/** One measured value cell: "Mean ( sd)" / Min / Max triple from the dataset. */
export interface Measurement {
  /** Raw cell text as it appears in the dataset, e.g. "43.4 ( 8.9)". */
  raw: string;
  mean: number | null;
  /** Standard deviation when reported alongside the mean. */
  sd: number | null;
  min: number | null;
  max: number | null;
}

/** Catalog entry describing one measured pollutant / parameter column. */
export interface PollutantInfo {
  /** Stable key used in `SamplingRecord.measurements`, e.g. "pm2_5". */
  key: string;
  /** Display name, e.g. "PM2.5", "Black carbon (BC)", "ΣPAHs". */
  name: string;
  /**
   * Dataset column group:
   * "Bulk PM" | "Carbonaceous aerosols" | "Water soluble inorganic aerosols" |
   * "Trace metals" | "Atmospheric gases" | organics groups
   */
  category: string;
  /** Reporting unit, e.g. "µg/m³", "ng/m³", "ppb". */
  unit: string;
}

/**
 * One sampling row of the dataset: a study can report several records
 * (different sites, site types, or campaigns).
 */
export interface SamplingRecord {
  id: number;
  /** "Study Area" column, e.g. "Agadir City", "Pretoria - Rosslyn". */
  studyArea: string;
  /** "Methodology" column, e.g. "Mobile Laboratory; PM10 and pollutant gases". */
  methodology: string;
  /** "Sampling period" column as reported, e.g. "2006 - 2015". */
  samplingPeriod: string;
  /** "Description" column (site setting), e.g. "Urban- Residential". */
  description: string;
  /** Measured values keyed by `PollutantInfo.key`; absent keys were not reported. */
  measurements: Record<string, Measurement>;
}

/** One publication (source article) in the ARC-Air database. */
export interface Study {
  id: string;
  /** Dataset region, e.g. "Northern Africa", "Western Africa". */
  region: string;
  /** "Country of Study" column. */
  country: string;
  /** "Source" column (short citation), e.g. "Chirmata et al. 2017". */
  source: string;
  /** "Author" column from Article details. */
  author: string;
  /** "Journal" column from Article details. */
  journal: string;
  /** "Identifier" column (DOI / URL). */
  identifier: string;
  /** "Title" column from Article details. */
  title: string;
  /** "Data processing" column, e.g. "Observations; Local Air Quality Management". */
  dataProcessing: string;
  /** Earliest sampling year parsed from the records' sampling periods. */
  yearFrom: number | null;
  /** Latest sampling year parsed from the records' sampling periods. */
  yearTo: number | null;
  records: SamplingRecord[];
}

/** Root shape of the local dataset file (and future API dataset endpoint). */
export interface ArcAirDataset {
  generatedAt: string;
  sourceFile: string;
  pollutants: PollutantInfo[];
  studies: Study[];
}

// ---------------------------------------------------------------------------
// Derived, UI-facing shapes (computed by the service layer)
// ---------------------------------------------------------------------------

/** Aggregated info for one study area (city/site), used by the map. */
export interface AreaSummary {
  /** Canonical area name, e.g. "Agadir", "Pretoria". */
  name: string;
  country: string;
  /** [longitude, latitude] to match Leaflet usage in the map component. */
  coordinates: [number, number];
  /** Number of studies with at least one record in this area. */
  studyCount: number;
  /** Site settings observed in this area, e.g. "Urban- Residential". */
  settings: string[];
  studies: { id: string; source: string; title: string }[];
}

/** Aggregated info for one country, used by the map side panel. */
export interface CountrySummary {
  /** ISO-3166 numeric id used by the world-atlas topology (e.g. "504"). */
  topoId: string | null;
  name: string;
  region: string;
  /** Number of studies matching the active filters. */
  studyCount: number;
  /** Unfiltered API total, retained for the map's denominator. */
  totalStudyCount: number;
  recordCount: number;
  yearFrom: number | null;
  yearTo: number | null;
  areas: AreaSummary[];
  studies: Study[];
}

/** Filters accepted by the study query service. */
export interface StudyFilters {
  /** Free-text query across title, author, country, area, journal, pollutants. */
  query?: string;
  countries?: string[];
  regions?: string[];
  /** Pollutant keys (see PollutantInfo.key). */
  pollutants?: string[];
  /** Pollutant categories (see PollutantInfo.category). */
  categories?: string[];
  /** Site setting substrings, e.g. "Urban", "Industrial", "Rural". */
  settings?: string[];
  yearFrom?: number;
  yearTo?: number;
}

export type StudySortKey =
  | "relevance"
  | "yearDesc"
  | "yearAsc"
  | "titleAsc"
  | "countryAsc";

export interface StudyQuery {
  filters?: StudyFilters;
  sort?: StudySortKey;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** High-level dataset stats for headers/analytics. */
export interface DatasetStats {
  studyCount: number;
  recordCount: number;
  countryCount: number;
  areaCount: number;
  yearFrom: number | null;
  yearTo: number | null;
  pollutantCount: number;
}
