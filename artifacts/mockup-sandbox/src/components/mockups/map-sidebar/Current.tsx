import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  X,
} from "lucide-react";
import "./_group.css";

type RecordItem = {
  studyArea: string;
  samplingPeriod: string;
  methodology: string;
  description: string;
  measurements: Record<string, number>;
};

type Study = {
  id: string;
  title: string;
  author: string;
  source: string;
  yearFrom: number;
  yearTo: number;
  publicationYear: number;
  identifier?: string;
  records: RecordItem[];
};

type City = {
  country: string;
  name: string;
  studyCount: number;
  settings: string[];
  studies: Study[];
};

type Country = {
  name: string;
  topoId: string;
  studyCount: number;
  totalStudyCount: number;
  cityCount: number;
  studies: Study[];
  areas: City[];
};

const makeStudy = (
  id: string,
  title: string,
  author: string,
  source: string,
  yearFrom: number,
  yearTo: number,
  studyArea: string,
  measurements: Record<string, number>,
): Study => ({
  id,
  title,
  author,
  source,
  yearFrom,
  yearTo,
  publicationYear: yearTo,
  identifier: "https://doi.org/10.1016/j.atmosenv.2022.119210",
  records: [
    {
      studyArea,
      samplingPeriod: `${yearFrom}–${yearTo}`,
      methodology:
        "Particulate matter was monitored at representative roadside and urban background sites using calibrated optical and gravimetric instruments.",
      description:
        "Measurements were collected during repeated sampling campaigns and compared with local meteorological conditions.",
      measurements,
    },
  ],
});

const moroccoStudies = [
  makeStudy(
    "ma-1",
    "Urban air quality and particulate matter in Marrakech",
    "A. El Hadi et al.",
    "Atmospheric Environment",
    2019,
    2022,
    "Marrakech — urban background",
    { PM25: 36, PM10: 72, NO2: 21 },
  ),
  makeStudy(
    "ma-2",
    "Traffic-related air pollution across central Marrakech",
    "L. Benjelloun et al.",
    "Environmental Monitoring and Assessment",
    2017,
    2020,
    "Gueliz and Medina",
    { PM25: 42, NO2: 28, O3: 18 },
  ),
  makeStudy(
    "ma-3",
    "Seasonal variation of urban aerosols in Morocco",
    "M. Ait Lahcen et al.",
    "Air Quality, Atmosphere & Health",
    2015,
    2018,
    "Marrakech city centre",
    { PM10: 64, PM25: 31, SO2: 8 },
  ),
  makeStudy(
    "ma-4",
    "Black carbon and roadside exposure in Marrakech",
    "S. Ouarzazi et al.",
    "Science of the Total Environment",
    2021,
    2023,
    "Bab Doukkala",
    { BC: 7, PM25: 39, NO2: 34 },
  ),
  makeStudy(
    "ma-5",
    "Air pollution levels in Casablanca and Rabat",
    "N. Chafi et al.",
    "Journal of Environmental Sciences",
    2018,
    2021,
    "Casablanca",
    { PM25: 33, PM10: 59, NO2: 26 },
  ),
  makeStudy(
    "ma-6",
    "Air quality assessment in northern Morocco",
    "R. El Amrani et al.",
    "Environmental Science and Pollution Research",
    2016,
    2019,
    "Tangier",
    { PM10: 52, SO2: 11, O3: 22 },
  ),
];

const cities: City[] = [
  {
    country: "Morocco",
    name: "Marrakech",
    studyCount: 4,
    settings: ["Urban", "Roadside"],
    studies: moroccoStudies.slice(0, 4),
  },
  {
    country: "Morocco",
    name: "Casablanca",
    studyCount: 2,
    settings: ["Urban", "Industrial"],
    studies: [moroccoStudies[4], moroccoStudies[1]],
  },
  {
    country: "Morocco",
    name: "Rabat",
    studyCount: 1,
    settings: ["Urban"],
    studies: [moroccoStudies[4]],
  },
  {
    country: "Morocco",
    name: "Tangier",
    studyCount: 1,
    settings: ["Urban", "Coastal"],
    studies: [moroccoStudies[5]],
  },
];

const countries: Country[] = [
  {
    name: "Morocco",
    topoId: "MAR",
    studyCount: 6,
    totalStudyCount: 8,
    cityCount: 4,
    studies: moroccoStudies,
    areas: cities,
  },
  {
    name: "South Africa",
    topoId: "ZAF",
    studyCount: 42,
    totalStudyCount: 42,
    cityCount: 12,
    studies: [],
    areas: [],
  },
  {
    name: "Nigeria",
    topoId: "NGA",
    studyCount: 31,
    totalStudyCount: 31,
    cityCount: 9,
    studies: [],
    areas: [],
  },
  {
    name: "Egypt",
    topoId: "EGY",
    studyCount: 27,
    totalStudyCount: 27,
    cityCount: 7,
    studies: [],
    areas: [],
  },
  {
    name: "Ghana",
    topoId: "GHA",
    studyCount: 18,
    totalStudyCount: 18,
    cityCount: 5,
    studies: [],
    areas: [],
  },
  {
    name: "Kenya",
    topoId: "KEN",
    studyCount: 15,
    totalStudyCount: 15,
    cityCount: 6,
    studies: [],
    areas: [],
  },
];

type Scenario = "africa" | "country" | "city" | "study";

export function Current() {
  const [scenario, setScenario] = useState<Scenario>("africa");
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedStudy, setSelectedStudy] = useState<Study>(moroccoStudies[0]);
  const selectedCountry = scenario === "africa" ? null : countries[0];
  const selectedCity = scenario === "city" || scenario === "study" ? cities[0] : null;
  const selectedMapStudy = scenario === "study" ? selectedStudy : null;
  const selectedCountryName = selectedCountry?.name ?? null;
  const selectedCityName = selectedCity?.name ?? null;
  const isAfricaView = !selectedCountryName;
  const searchTerm = searchQuery.trim().toLowerCase();

  const visibleAfricaCountries = useMemo(
    () =>
      countries.filter(
        (country) =>
          !searchTerm ||
          country.name.toLowerCase().includes(searchTerm) ||
          country.studies.some((study) =>
            `${study.title} ${study.author} ${study.source}`
              .toLowerCase()
              .includes(searchTerm),
          ),
      ),
    [searchTerm],
  );
  const visibleCountryCities = selectedCountry?.areas.filter(
    (city) =>
      !searchTerm ||
      city.name.toLowerCase().includes(searchTerm) ||
      city.studies.some((study) =>
        `${study.title} ${study.author} ${study.source}`
          .toLowerCase()
          .includes(searchTerm),
      ),
  ) ?? [];
  const selectedCityStudies = selectedCity?.studies ?? [];
  const visibleCityStudies = selectedCityStudies.filter((study) =>
    `${study.title} ${study.author} ${study.source}`
      .toLowerCase()
      .includes(searchTerm),
  );
  const sidebarStudyCount = isAfricaView
    ? 148
    : selectedCityName
      ? selectedCityStudies.length
      : selectedCountry?.studyCount ?? 0;
  const sidebarYearRange = isAfricaView ? "1998-2024" : selectedCityName ? "2015-2023" : "2015-2023";
  const isFiltering = Boolean(searchTerm);

  const focusAfrica = () => {
    setScenario("africa");
    setSearchQuery("");
  };
  const toggleCity = (name: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const openMapStudy = (study: Study) => {
    setSelectedStudy(study);
    setScenario("study");
  };
  const cityCategoryTags = (study: Study) => {
    const names: Record<string, string> = {
      PM25: "Particulate matter",
      PM10: "Particulate matter",
      NO2: "Nitrogen dioxide",
      O3: "Ozone",
      SO2: "Sulphur dioxide",
      BC: "Black carbon",
    };
    return [
      ...new Set(
        study.records.flatMap((record) =>
          Object.keys(record.measurements).map((key) => names[key] ?? key),
        ),
      ),
    ];
  };

  return (
    <main className="map-sidebar-extraction min-h-screen bg-background p-5">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Preview scenarios">
          {[
            ["africa", "Africa overview"],
            ["country", "Morocco country"],
            ["city", "Marrakech city"],
            ["study", "Selected study"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setScenario(value as Scenario);
                setSearchQuery("");
              }}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                scenario === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex h-[720px] w-80 min-h-[35dvh] max-h-[45dvh] shrink-0 flex-col overflow-hidden border border-border bg-white shadow-sm sm:max-h-none">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
            {!isAfricaView && (
              <button
                type="button"
                onClick={focusAfrica}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-border px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Back to Africa"
              >
                <ArrowLeft size={12} />
                Africa
              </button>
            )}
            <nav
              aria-label="Map navigation"
              className="flex min-w-0 items-center gap-1 overflow-hidden text-xs"
            >
              <button
                type="button"
                onClick={focusAfrica}
                className={`shrink-0 font-semibold hover:text-primary ${
                  isAfricaView ? "text-foreground" : "text-primary"
                }`}
              >
                Africa
              </button>
              {selectedCountryName && (
                <>
                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setScenario("country")}
                    className={`truncate font-medium hover:text-primary ${
                      !selectedCityName && !selectedMapStudy
                        ? "text-foreground"
                        : "text-primary"
                    }`}
                  >
                    {selectedCountryName}
                  </button>
                </>
              )}
              {selectedCityName && (
                <>
                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setScenario("city")}
                    className={`truncate font-medium hover:text-primary ${
                      !selectedMapStudy ? "text-foreground" : "text-primary"
                    }`}
                  >
                    {selectedCityName}
                  </button>
                </>
              )}
              {selectedMapStudy && (
                <>
                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">Study</span>
                </>
              )}
            </nav>
            {selectedMapStudy && (
              <button
                type="button"
                onClick={() => setScenario("city")}
                className="ml-auto shrink-0 rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-muted"
              >
                Back to city
              </button>
            )}
          </div>

          {selectedMapStudy ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 p-4">
                <section className="rounded-xl border border-border bg-white p-3.5 shadow-sm">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {selectedMapStudy.title || selectedMapStudy.source || "Untitled study"}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {selectedMapStudy.source}
                    {selectedMapStudy.yearFrom
                      ? ` · ${selectedMapStudy.yearFrom}${
                          selectedMapStudy.yearTo &&
                          selectedMapStudy.yearTo !== selectedMapStudy.yearFrom
                            ? `–${selectedMapStudy.yearTo}`
                            : ""
                        }`
                      : ""}
                  </p>
                  {selectedMapStudy.identifier && (
                    <a
                      href={selectedMapStudy.identifier}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[11px] font-medium text-primary hover:underline"
                    >
                      View publication
                    </a>
                  )}
                </section>

                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Methodologies</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {selectedMapStudy.records.length}
                  </span>
                </div>

                {selectedMapStudy.records.map((record, index) => {
                  const measurementKeys = Object.keys(record.measurements);
                  return (
                    <section
                      key={`${record.studyArea}-${record.samplingPeriod}-${index}`}
                      className="rounded-xl border border-border bg-white p-3.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">
                            {record.studyArea || `Methodology ${index + 1}`}
                          </h4>
                          {record.samplingPeriod && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {record.samplingPeriod}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          {index + 1} / {selectedMapStudy.records.length}
                        </span>
                      </div>
                      {record.methodology && (
                        <p className="mt-2 text-[11px] leading-relaxed text-foreground/80">
                          {record.methodology}
                        </p>
                      )}
                      {record.description && (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                          {record.description}
                        </p>
                      )}
                      {measurementKeys.length > 0 && (
                        <div className="mt-3 border-t border-border/70 pt-2.5">
                          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Measurements
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {measurementKeys.map((key) => (
                              <span
                                key={key}
                                className="rounded-md bg-primary/8 px-1.5 py-1 text-[10px] font-medium text-primary"
                              >
                                {key}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  {
                    val: isFiltering
                      ? isAfricaView
                        ? String(sidebarStudyCount)
                        : `${sidebarStudyCount}/${selectedCountry?.totalStudyCount ?? selectedCountry?.studyCount ?? 0}`
                      : String(sidebarStudyCount),
                    label: sidebarStudyCount === 1 ? "Study" : "Studies",
                  },
                  {
                    val: String(
                      isAfricaView
                        ? visibleAfricaCountries.length
                        : selectedCityName
                          ? selectedCityStudies.reduce(
                              (total, study) => total + study.records.length,
                              0,
                            )
                          : visibleCountryCities.length,
                    ),
                    label: isAfricaView
                      ? "Countries"
                      : selectedCityName
                        ? "Methodologies"
                        : "Cities",
                  },
                  { val: sidebarYearRange, label: "Years" },
                ].map((stat, index) => (
                  <div key={index} className="flex flex-col items-center py-3 px-1">
                    <span className="text-sm font-bold text-foreground leading-tight text-center">
                      {stat.val}
                    </span>
                    {stat.label && (
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        {stat.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {searchQuery && (
                <div className="px-4 py-2 border-b border-border bg-muted/20">
                  <span className="inline-flex flex-wrap gap-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                    Search: "
                    {searchQuery.length > 15
                      ? searchQuery.slice(0, 15) + "…"
                      : searchQuery}
                    "
                  </span>
                </div>
              )}

              <div className="px-4 py-3 border-b border-border">
                <div className="relative">
                  <Search
                    size={12}
                    className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${
                      searchQuery ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Search studies by title, author, keyword..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className={`w-full text-[11px] border rounded pl-7 pr-7 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60 transition-all duration-300 ${
                      searchQuery ? "search-active border-primary" : "border-border"
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-90"
                    >
                      <X size={12} className="text-primary" />
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {isAfricaView && (
                  <div className="divide-y divide-border/40">
                    {visibleAfricaCountries.map((country) => {
                      const density = Math.max(
                        4,
                        (country.studyCount /
                          Math.max(...countries.map((item) => item.studyCount))) *
                          100,
                      );
                      return (
                        <button
                          key={country.name}
                          type="button"
                          onClick={() => setScenario("country")}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs font-medium text-foreground">
                              {country.name}
                            </span>
                            <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {country.studyCount}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <span className="text-[10px] text-muted-foreground">
                              {country.cityCount} {country.cityCount === 1 ? "city" : "cities"}
                            </span>
                            <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${density}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isAfricaView && selectedCityName && (
                  <div className="divide-y divide-border/40">
                    {visibleCityStudies.map((study) => {
                      const tags = cityCategoryTags(study);
                      const year = study.publicationYear ?? study.yearFrom;
                      return (
                        <button
                          key={study.id}
                          type="button"
                          onClick={() => openMapStudy(study)}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <span className="block text-xs font-semibold leading-snug text-foreground">
                            {study.title || study.source}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {study.author || study.source}
                            {year ? ` · ${year}` : ""}
                          </span>
                          {tags.length > 0 && (
                            <span className="mt-2 flex flex-wrap gap-1">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {visibleCityStudies.length === 0 && (
                      <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                        No studies match this search.
                      </p>
                    )}
                  </div>
                )}
                {!isAfricaView && !selectedCityName && (
                  <>
                    {sidebarStudyCount === 0 && (
                      <div className="px-5 py-8 text-center">
                        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Info size={16} />
                        </div>
                        <div className="text-xs font-semibold text-foreground">
                          {isFiltering
                            ? "No studies match filters"
                            : isAfricaView
                              ? "No studies are available in the current data."
                              : "No studies mapped yet"}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {isFiltering
                            ? "Try clearing your filters or selecting a different country."
                            : isAfricaView
                              ? "No research studies are available in the current dataset."
                              : `${selectedCountryName} is selectable, but there are no research studies in the current dataset.`}
                        </p>
                      </div>
                    )}

                    {sidebarStudyCount > 0 && (
                      <div className="divide-y divide-border/40">
                        {visibleCountryCities.map((city, index) => (
                          <div
                            key={`${city.country}-${city.name}-${index}`}
                            id={`city-row-${city.country}-${city.name}`}
                          >
                            <button
                              type="button"
                              className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/40 transition-all duration-200"
                              onClick={() => {
                                toggleCity(city.name);
                                setScenario("city");
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`transition-transform duration-200 ${
                                    expanded.has(city.name) ? "rotate-0" : "-rotate-90"
                                  }`}
                                >
                                  <ChevronDown size={12} className="text-muted-foreground" />
                                </span>
                                <div className="text-left">
                                  <div className="text-xs font-medium text-foreground">
                                    {city.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground max-w-30 truncate">
                                    {city.settings.join(", ")}
                                  </div>
                                </div>
                              </div>
                              <span
                                className="text-[11px] font-semibold text-primary bg-primary/10 rounded px-2 py-0.5"
                                style={{ fontFamily: "'DM Mono', monospace" }}
                              >
                                {city.studyCount} {city.studyCount === 1 ? "study" : "studies"}
                              </span>
                            </button>
                            <div className={expanded.has(city.name) ? "block" : "hidden"}>
                              <div className="bg-muted/30 pl-10 pr-4 py-2 space-y-0.5">
                                {city.studies.length === 0 ? (
                                  <div className="text-[11px] text-muted-foreground py-1">
                                    No study details available
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 py-1">
                                    {city.studies.map((study, studyIndex) => {
                                      const pKeys = new Set(
                                        study.records.flatMap((record) =>
                                          Object.keys(record.measurements),
                                        ),
                                      );
                                      const pNames = Array.from(pKeys)
                                        .slice(0, 3)
                                        .map((key) => key);
                                      return (
                                        <button
                                          key={`${city.name}-${study.id}-${studyIndex}`}
                                          type="button"
                                          onClick={() => openMapStudy(study)}
                                          className="w-full text-left rounded-lg border border-border bg-white p-2.5 hover:border-primary/30 hover:shadow-sm transition-all duration-150"
                                        >
                                          <div className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">
                                            {study.title || study.source}
                                          </div>
                                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                                            {study.source}
                                          </div>
                                          {pNames.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              {pNames.map((name) => (
                                                <span
                                                  key={name}
                                                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                                                >
                                                  {name}
                                                </span>
                                              ))}
                                              {pKeys.size > 3 && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                                  +{pKeys.size - 3}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
