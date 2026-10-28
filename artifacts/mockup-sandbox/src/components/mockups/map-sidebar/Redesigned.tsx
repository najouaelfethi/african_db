import { useMemo, useState } from "react";
import {
  ArrowLeft,
  AudioLines,
  ChevronRight,
  CircleDot,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
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

type Scenario = "africa" | "country" | "city" | "study";

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

const pollutantNames: Record<string, string> = {
  PM25: "PM₂.₅",
  PM10: "PM₁₀",
  NO2: "NO₂",
  O3: "O₃",
  SO2: "SO₂",
  BC: "Black carbon",
};

const searchableStudy = (study: Study) =>
  `${study.title} ${study.author} ${study.source} ${study.records
    .map((record) => `${record.studyArea} ${record.methodology}`)
    .join(" ")}`.toLowerCase();

function MiniAfrica() {
  return (
    <svg
      aria-hidden="true"
      className="aa-map"
      viewBox="0 0 176 184"
      fill="none"
    >
      <path
        d="m82 9 19 5 15 11 19 5 9 14-2 17 12 14-7 12-2 18-13 11-7 18-15 7-3 14-13 9-12-12-8-18-13-7-4-19-13-13 4-13-10-12 7-18-4-13 12-14 17-4 9-12 18-7Z"
        fill="currentColor"
        fillOpacity=".1"
        stroke="currentColor"
        strokeOpacity=".31"
        strokeWidth="1.5"
      />
      <path
        d="m82 9 19 5 15 11 19 5 9 14-2 17 12 14-7 12-2 18-13 11-7 18-15 7-3 14-13 9-12-12-8-18-13-7-4-19-13-13 4-13-10-12 7-18-4-13 12-14 17-4 9-12 18-7Z"
        fill="url(#mapFill)"
      />
      <path
        d="m82 9 19 5 15 11 19 5 9 14-2 17 12 14-7 12-2 18-13 11-7 18-15 7-3 14-13 9-12-12-8-18-13-7-4-19-13-13 4-13-10-12 7-18-4-13 12-14 17-4 9-12 18-7Z"
        stroke="currentColor"
        strokeOpacity=".34"
        strokeWidth="1.5"
      />
      <path
        d="M71 46c15 2 31 1 47 8m-55 27c19 0 45 7 68 3m-60 30c16-6 37-5 53-13m-36 34c10-9 21-14 32-18"
        stroke="currentColor"
        strokeOpacity=".18"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      <circle cx="94" cy="42" r="4.5" fill="#bc723c" />
      <circle cx="94" cy="42" r="9" stroke="#bc723c" strokeOpacity=".34" />
      <text
        x="103"
        y="45"
        fill="currentColor"
        fillOpacity=".7"
        fontSize="7"
        fontFamily="DM Mono, monospace"
      >
        MAR
      </text>
      <defs>
        <linearGradient id="mapFill" x1="65" y1="20" x2="131" y2="158">
          <stop stopColor="#d4ded1" stopOpacity=".34" />
          <stop offset="1" stopColor="#d5c3a5" stopOpacity=".12" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Redesigned() {
  const [scenario, setScenario] = useState<Scenario>("africa");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryName, setSelectedCountryName] = useState("Morocco");
  const [selectedCityName, setSelectedCityName] = useState("Marrakech");
  const [selectedStudy, setSelectedStudy] = useState<Study>(moroccoStudies[0]);

  const selectedCountry =
    countries.find((country) => country.name === selectedCountryName) ??
    countries[0];
  const selectedCity =
    selectedCountry.areas.find((city) => city.name === selectedCityName) ??
    null;
  const searchTerm = searchQuery.trim().toLowerCase();

  const visibleCountries = useMemo(
    () =>
      countries.filter(
        (country) =>
          !searchTerm ||
          country.name.toLowerCase().includes(searchTerm) ||
          country.studies.some((study) => searchableStudy(study).includes(searchTerm)),
      ),
    [searchTerm],
  );
  const visibleCities = useMemo(
    () =>
      selectedCountry.areas.filter(
        (city) =>
          !searchTerm ||
          city.name.toLowerCase().includes(searchTerm) ||
          city.studies.some((study) => searchableStudy(study).includes(searchTerm)),
      ),
    [searchTerm, selectedCountry],
  );
  const visibleStudies = useMemo(
    () =>
      (selectedCity?.studies ?? []).filter((study) =>
        searchableStudy(study).includes(searchTerm),
      ),
    [searchTerm, selectedCity],
  );

  const goAfrica = () => {
    setScenario("africa");
    setSearchQuery("");
  };
  const goCountry = () => {
    setScenario("country");
    setSearchQuery("");
  };
  const goCity = () => {
    setScenario("city");
    setSearchQuery("");
  };
  const openCountry = (country: Country) => {
    setSelectedCountryName(country.name);
    setSelectedCityName(country.areas[0]?.name ?? "");
    setScenario("country");
    setSearchQuery("");
  };
  const openCity = (city: City) => {
    setSelectedCityName(city.name);
    setScenario("city");
    setSearchQuery("");
  };
  const openStudy = (study: Study) => {
    setSelectedStudy(study);
    setScenario("study");
    setSearchQuery("");
  };

  const stageSelect = (next: Scenario) => {
    if (next === "africa") goAfrica();
    if (next === "country") goCountry();
    if (next === "city") goCity();
    if (next === "study") {
      setSelectedStudy(moroccoStudies[0]);
      setScenario("study");
      setSearchQuery("");
    }
  };

  const isStudy = scenario === "study";
  const isAfrica = scenario === "africa";
  const isCountry = scenario === "country";
  const isCity = scenario === "city";
  const currentCity = isCity ? selectedCity : null;
  const currentStudiesCount = isAfrica
    ? 148
    : isCity
      ? currentCity?.studyCount ?? 0
      : selectedCountry.studyCount;
  const currentLocationsCount = isAfrica
    ? visibleCountries.length
    : isCity
      ? currentCity?.studies.reduce((sum, study) => sum + study.records.length, 0) ?? 0
      : visibleCities.length;

  return (
    <main className="air-discovery">
      <style>{`
        .air-discovery {
          --ink: #203532;
          --ink-soft: #526761;
          --muted: #788781;
          --line: #e2e8df;
          --paper: #fbfaf5;
          --panel: #fffefa;
          --green: #315e50;
          --green-dark: #21483f;
          --green-pale: #e8f0e9;
          --ochre: #b86f38;
          --sand: #f4eee1;
          min-height: 100dvh;
          padding: 28px clamp(16px, 4vw, 54px);
          color: var(--ink);
          font-family: "DM Sans", "Avenir Next", sans-serif;
          background:
            radial-gradient(ellipse at 78% 28%, rgba(220, 228, 213, .58), transparent 37%),
            linear-gradient(118deg, #f5f5ee 0%, #f3f4ed 54%, #e8eee6 100%);
          box-sizing: border-box;
        }
        .air-discovery * { box-sizing: border-box; }
        .air-topbar {
          max-width: 1100px;
          margin: 0 auto 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }
        .air-brand { display: flex; align-items: center; gap: 11px; }
        .air-brand-mark {
          width: 38px; height: 38px; border-radius: 12px;
          display: grid; place-items: center;
          color: #f9f8ef; background: var(--green-dark);
          box-shadow: 0 5px 12px rgba(39, 71, 59, .16);
        }
        .air-brand-name { font-size: 14px; letter-spacing: -.025em; font-weight: 700; }
        .air-brand-caption {
          margin-top: 2px; color: var(--muted);
          font-size: 10px; letter-spacing: .085em; text-transform: uppercase;
        }
        .air-top-note {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 11px; border: 1px solid rgba(62, 94, 76, .14);
          border-radius: 999px; color: #63746b; background: rgba(255,254,250,.65);
          font-size: 10px; letter-spacing: .025em;
        }
        .air-top-note i { width: 6px; height: 6px; border-radius: 50%; background: #9eaa73; }
        .air-workspace {
          position: relative; isolation: isolate;
          display: flex; align-items: stretch; justify-content: flex-start;
          max-width: 1100px; min-height: min(760px, calc(100dvh - 108px));
          margin: 0 auto; overflow: hidden;
          border: 1px solid rgba(47, 76, 59, .12); border-radius: 17px;
          background: linear-gradient(135deg, rgba(248,248,240,.7), rgba(227,235,224,.62));
          box-shadow: 0 22px 65px rgba(40, 57, 44, .1), 0 2px 6px rgba(40, 57, 44, .04);
        }
        .air-map-canvas {
          position: absolute; z-index: -1; inset: 0 0 0 390px;
          display: grid; place-items: center; overflow: hidden;
          background:
            radial-gradient(circle at 48% 44%, rgba(255,255,249,.9), transparent 46%),
            repeating-linear-gradient(0deg, transparent 0 47px, rgba(92,119,96,.055) 48px),
            repeating-linear-gradient(90deg, transparent 0 47px, rgba(92,119,96,.055) 48px),
            linear-gradient(135deg, #e9eee5, #f3f1e8);
        }
        .air-map-canvas::before, .air-map-canvas::after {
          position: absolute; content: ""; border: 1px solid rgba(83,116,91,.12);
          border-radius: 50%; transform: rotate(-17deg);
        }
        .air-map-canvas::before { width: 740px; height: 310px; }
        .air-map-canvas::after { width: 590px; height: 240px; }
        .air-map-graphic {
          position: relative; width: min(340px, 42vw); height: auto;
          color: #55725e; opacity: .9; transform: translate(34px, -4px);
        }
        .air-map-legend {
          position: absolute; right: 28px; bottom: 24px;
          display: flex; align-items: center; gap: 8px;
          color: #61746a; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
        }
        .air-map-legend span { width: 7px; height: 7px; border-radius: 50%; background: var(--ochre); box-shadow: 0 0 0 4px rgba(184,111,56,.12); }
        .air-preview {
          position: absolute; z-index: 2; top: 18px; left: 425px;
          display: flex; align-items: center; gap: 4px; padding: 4px;
          border: 1px solid rgba(54,78,62,.13); border-radius: 8px;
          background: rgba(255,254,250,.8); backdrop-filter: blur(12px);
        }
        .air-preview-label { padding: 0 7px; color: #88948a; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .air-preview button {
          border: 0; border-radius: 5px; padding: 6px 8px;
          color: #65766c; background: transparent; cursor: pointer;
          font: 600 9px/1 "DM Sans", sans-serif;
        }
        .air-preview button:hover { transform: translateY(-1px); }
        .air-preview button[aria-pressed="true"] { color: #fffdf7; background: var(--green); }
        .air-sidebar {
          width: 408px; min-height: min(760px, calc(100dvh - 108px));
          max-height: calc(100dvh - 108px); display: flex; flex-direction: column;
          overflow: hidden; border-right: 1px solid rgba(58,78,63,.13);
          background: var(--panel); box-shadow: 8px 0 30px rgba(39,55,41,.07);
          animation: air-enter .35s ease-out both;
        }
        @keyframes air-enter { from { opacity: .5; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .air-sidebar-head { padding: 20px 21px 14px; }
        .air-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .air-kicker {
          display: flex; align-items: center; gap: 6px; color: var(--green);
          font-size: 9px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
        }
        .air-heading {
          margin: 7px 0 0; font-family: "Newsreader", Georgia, serif;
          font-size: 25px; line-height: 1.06; font-weight: 500; letter-spacing: -.035em;
        }
        .air-subhead { margin: 6px 0 0; color: var(--ink-soft); font-size: 11px; line-height: 1.5; }
        .air-id {
          margin-top: 3px; padding: 5px 7px; border: 1px solid var(--line);
          border-radius: 5px; color: #829086; font: 9px/1 "DM Mono", monospace;
          letter-spacing: .06em;
        }
        .air-breadcrumb {
          display: flex; align-items: center; gap: 5px; min-width: 0;
          margin-top: 17px; padding-top: 12px; border-top: 1px solid #edf0e9;
          color: #7d8981; font-size: 10px;
        }
        .air-breadcrumb button {
          min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          padding: 2px 0; border: 0; color: var(--green); background: transparent;
          cursor: pointer; font: 600 10px/1.2 "DM Sans", sans-serif;
        }
        .air-breadcrumb button:hover { text-decoration: underline; text-underline-offset: 3px; }
        .air-breadcrumb .air-current { color: var(--ink); font-weight: 700; }
        .air-backline { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .air-back {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 0;
          border: 0; color: #64756b; background: none; cursor: pointer;
          font: 600 10px/1 "DM Sans", sans-serif;
        }
        .air-back:hover { color: var(--green); }
        .air-count-label { color: #8b958c; font: 9px/1 "DM Mono", monospace; }
        .air-stats {
          display: grid; grid-template-columns: 1fr 1fr 1.15fr;
          margin: 0 21px 14px; padding: 11px 0;
          border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
        }
        .air-stat { padding: 0 12px; border-right: 1px solid var(--line); }
        .air-stat:first-child { padding-left: 0; }
        .air-stat:last-child { border: 0; }
        .air-stat-value {
          color: var(--ink); font: 600 15px/1 "DM Mono", monospace;
          letter-spacing: -.06em;
        }
        .air-stat-label { margin-top: 5px; color: #849087; font-size: 9px; }
        .air-search-wrap { padding: 0 21px 13px; }
        .air-search {
          display: flex; align-items: center; gap: 8px; height: 38px;
          padding: 0 10px; border: 1px solid #dfe6de; border-radius: 7px;
          color: #728178; background: #fbfcf8;
          transition: transform .18s ease, border-color .18s ease;
        }
        .air-search:focus-within { border-color: #88a392; transform: translateY(-1px); }
        .air-search input {
          flex: 1; min-width: 0; border: 0; outline: 0; color: var(--ink);
          background: transparent; font: 11px/1.3 "DM Sans", sans-serif;
        }
        .air-search input::placeholder { color: #929c94; }
        .air-clear {
          display: grid; place-items: center; width: 22px; height: 22px; padding: 0;
          border: 0; border-radius: 50%; color: #738179; background: transparent; cursor: pointer;
        }
        .air-clear:hover { background: #e9efe8; }
        .air-list-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 9px 21px 8px; border-top: 1px solid #edf0e9;
          color: #89948b; font-size: 9px; letter-spacing: .105em; text-transform: uppercase;
        }
        .air-list-head strong { color: #6f7d74; font: 9px/1 "DM Mono", monospace; letter-spacing: 0; }
        .air-list {
          min-height: 0; flex: 1; overflow: auto; overscroll-behavior: contain;
          scrollbar-color: #c9d3c9 transparent; scrollbar-width: thin;
        }
        .air-list::-webkit-scrollbar { width: 5px; }
        .air-list::-webkit-scrollbar-thumb { border-radius: 10px; background: #c9d3c9; }
        .air-country-row {
          width: 100%; display: block; padding: 12px 21px;
          border: 0; border-top: 1px solid #f0f2eb; color: inherit; background: transparent;
          text-align: left; cursor: pointer;
        }
        .air-country-row:hover { background: #f7f8f2; }
        .air-row-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .air-row-title { font-size: 12px; font-weight: 700; letter-spacing: -.015em; }
        .air-row-count { padding: 4px 7px; border-radius: 4px; color: var(--green-dark); background: var(--green-pale); font: 600 10px/1 "DM Mono", monospace; }
        .air-row-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 7px; color: #89938a; font-size: 9px; }
        .air-density { width: 67px; height: 3px; overflow: hidden; border-radius: 10px; background: #e8ece4; }
        .air-density i { display: block; height: 100%; border-radius: inherit; background: #6b8c73; }
        .air-city-row {
          width: 100%; display: grid; grid-template-columns: 30px 1fr auto 14px;
          align-items: center; gap: 8px; padding: 13px 21px;
          border: 0; border-top: 1px solid #f0f2eb; color: inherit; background: transparent;
          text-align: left; cursor: pointer;
        }
        .air-city-row:hover { background: #f7f8f2; }
        .air-city-index { color: #a2aba2; font: 10px/1 "DM Mono", monospace; }
        .air-city-name { font-size: 12px; font-weight: 700; }
        .air-city-settings { margin-top: 4px; color: #89938a; font-size: 9px; }
        .air-city-count { color: #5a7465; font: 10px/1 "DM Mono", monospace; white-space: nowrap; }
        .air-study-row {
          width: 100%; display: block; padding: 14px 21px;
          border: 0; border-top: 1px solid #f0f2eb; color: inherit; background: transparent;
          text-align: left; cursor: pointer;
        }
        .air-study-row:hover { background: #f7f8f2; }
        .air-study-title { display: block; color: #293d37; font-family: "Newsreader", Georgia, serif; font-size: 16px; line-height: 1.2; font-weight: 500; letter-spacing: -.015em; }
        .air-study-meta { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: #7c8980; font-size: 9px; }
        .air-dot { width: 3px; height: 3px; border-radius: 50%; background: #a0aaa1; }
        .air-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
        .air-tag { padding: 4px 6px; border: 1px solid #dce6db; border-radius: 4px; color: #577264; background: #f1f6ef; font-size: 9px; line-height: 1; }
        .air-empty { padding: 34px 28px; text-align: center; }
        .air-empty-icon { display: grid; place-items: center; width: 36px; height: 36px; margin: 0 auto 11px; border: 1px solid #e2e8df; border-radius: 50%; color: #789081; background: #f7f8f1; }
        .air-empty strong { display: block; font-family: "Newsreader", Georgia, serif; font-size: 18px; font-weight: 500; }
        .air-empty p { margin: 6px 0 0; color: #78867c; font-size: 10px; line-height: 1.5; }
        .air-study-detail { min-height: 0; flex: 1; overflow: auto; padding: 0 21px 20px; }
        .air-detail-title {
          margin: 1px 0 0; color: #233b35; font-family: "Newsreader", Georgia, serif;
          font-size: 24px; line-height: 1.08; font-weight: 500; letter-spacing: -.035em;
        }
        .air-detail-author { margin: 10px 0 0; color: #5f7167; font-size: 11px; }
        .air-detail-source { margin: 4px 0 0; color: #89938a; font-size: 10px; }
        .air-publication {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 13px; padding: 8px 10px; border: 1px solid #d5e2d6; border-radius: 6px;
          color: #315e50; background: #f3f7f0; text-decoration: none;
          font-size: 10px; font-weight: 700;
        }
        .air-publication:hover { transform: translateY(-1px); }
        .air-detail-divider { height: 1px; margin: 17px 0; background: #e7ebe4; }
        .air-detail-kicker { margin: 0 0 9px; color: #88938a; font-size: 9px; letter-spacing: .11em; text-transform: uppercase; }
        .air-detail-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .air-fact { padding: 10px; border: 1px solid #e8ece5; border-radius: 6px; background: #fbfcf8; }
        .air-fact label { display: block; color: #90998f; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; }
        .air-fact span { display: block; margin-top: 5px; color: #42564c; font-size: 10px; line-height: 1.35; font-weight: 600; }
        .air-method {
          padding: 12px; border-left: 2px solid #a9b994; border-radius: 0 6px 6px 0;
          color: #596a60; background: #f7f7f0; font-size: 10px; line-height: 1.55;
        }
        .air-description { margin: 9px 0 0; color: #78847b; font-size: 9px; line-height: 1.55; }
        .air-measurements { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
        .air-measurement { padding: 10px 9px; border: 1px solid #e2e9df; border-radius: 6px; background: #f8faf5; }
        .air-measurement b { display: block; color: #365d4e; font: 600 12px/1.15 "DM Mono", monospace; }
        .air-measurement span { display: block; margin-top: 5px; color: #849087; font-size: 8px; line-height: 1.25; }
        .air-disclaimer {
          padding: 11px 21px; border-top: 1px solid #e8ece5;
          color: #879188; background: #fcfcf8; font-size: 9px; line-height: 1.45;
        }
        .air-disclaimer strong { color: #6d7d71; font-weight: 700; }
        .air-disclaimer-row { display: flex; align-items: flex-start; gap: 7px; }
        @media (max-width: 760px) {
          .air-discovery { padding: 14px; }
          .air-topbar { margin-bottom: 13px; }
          .air-top-note { display: none; }
          .air-workspace { min-height: calc(100dvh - 76px); border-radius: 12px; }
          .air-map-canvas { display: none; }
          .air-preview { top: 9px; left: 9px; right: 9px; justify-content: center; }
          .air-preview-label { display: none; }
          .air-sidebar { width: 100%; max-height: none; min-height: calc(100dvh - 94px); margin-top: 49px; border-right: 0; }
          .air-sidebar-head { padding-top: 17px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .air-sidebar { animation: none; }
          .air-discovery *, .air-discovery *::before, .air-discovery *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="air-topbar">
        <div className="air-brand">
          <div className="air-brand-mark"><AudioLines size={19} strokeWidth={1.8} /></div>
          <div>
            <div className="air-brand-name">African Air Database</div>
            <div className="air-brand-caption">Geographic research catalog</div>
          </div>
        </div>
        <div className="air-top-note"><i /> Research collection · illustrative preview</div>
      </header>

      <section className="air-workspace" aria-label="African air quality research explorer">
        <div className="air-map-canvas" aria-hidden="true">
          <div className="air-map-graphic"><MiniAfrica /></div>
          <div className="air-map-legend"><span /> Selected research region</div>
        </div>

        <nav className="air-preview" aria-label="Preview selection level">
          <span className="air-preview-label">Explore</span>
          {([
            ["africa", "Africa"],
            ["country", "Country"],
            ["city", "City"],
            ["study", "Study"],
          ] as [Scenario, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scenario === value}
              onClick={() => stageSelect(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <aside className="air-sidebar" aria-label="Research discovery sidebar">
          <div className="air-sidebar-head">
            <div className="air-title-row">
              <div>
                <div className="air-kicker"><Globe2 size={12} /> Discovery atlas</div>
                <h1 className="air-heading">
                  {isAfrica ? "Air research across Africa" : isCountry ? selectedCountry.name : isCity ? selectedCity?.name ?? selectedCountry.name : "Study record"}
                </h1>
                <p className="air-subhead">
                  {isAfrica
                    ? "Explore field studies by geography, from region to record."
                    : isCountry
                      ? "Cities and study coverage in this country."
                      : isCity
                        ? `${selectedCountry.name} · ${selectedCity?.settings.join(" / ") ?? "City research"}`
                        : "Methods, coverage and measured pollutants."}
                </p>
              </div>
              <span className="air-id">{isAfrica ? "AFR / 01" : isCountry ? selectedCountry.topoId : isCity ? "CITY / 01" : "RECORD"}</span>
            </div>

            <nav className="air-breadcrumb" aria-label="Selection hierarchy">
              <button type="button" className={isAfrica ? "air-current" : ""} onClick={goAfrica}>Africa</button>
              {!isAfrica && (
                <>
                  <ChevronRight size={11} />
                  <button type="button" className={isCountry ? "air-current" : ""} onClick={goCountry}>{selectedCountry.name}</button>
                </>
              )}
              {(isCity || isStudy) && (
                <>
                  <ChevronRight size={11} />
                  <button type="button" className={isCity ? "air-current" : ""} onClick={goCity}>{selectedCity?.name ?? selectedCityName}</button>
                </>
              )}
              {isStudy && (
                <>
                  <ChevronRight size={11} />
                  <span className="air-current">Study</span>
                </>
              )}
            </nav>

            {!isAfrica && (
              <div className="air-backline">
                <button className="air-back" type="button" onClick={isStudy ? goCity : goAfrica}>
                  <ArrowLeft size={13} /> {isStudy ? "Back to Marrakech" : "Back to Africa"}
                </button>
                <span className="air-count-label">{isStudy ? "RECORD DETAIL" : "GEOGRAPHIC VIEW"}</span>
              </div>
            )}
          </div>

          {!isStudy ? (
            <>
              <div className="air-stats" aria-label="Coverage summary">
                <div className="air-stat">
                  <div className="air-stat-value">{currentStudiesCount}</div>
                  <div className="air-stat-label">{isAfrica || currentStudiesCount !== 1 ? "Studies" : "Study"}</div>
                </div>
                <div className="air-stat">
                  <div className="air-stat-value">{currentLocationsCount}</div>
                  <div className="air-stat-label">{isAfrica ? "Countries" : isCity ? "Methods" : "Cities"}</div>
                </div>
                <div className="air-stat">
                  <div className="air-stat-value">{isAfrica ? "1998–24" : "2015–23"}</div>
                  <div className="air-stat-label">Study years</div>
                </div>
              </div>

              <div className="air-search-wrap">
                <label className="air-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search place, title, author, pollutant"
                    aria-label="Search places, studies, authors, or pollutants"
                  />
                  {searchQuery && (
                    <button
                      className="air-clear"
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
              </div>

              <div className="air-list-head">
                <span>{isAfrica ? "Country coverage" : isCity ? "Studies in this city" : "Cities in this country"}</span>
                <strong>
                  {isAfrica ? visibleCountries.length : isCity ? visibleStudies.length : visibleCities.length} results
                </strong>
              </div>
              <div className="air-list" key={scenario}>
                {isAfrica && visibleCountries.map((country) => {
                  const density = Math.max(5, country.studyCount / 42 * 100);
                  return (
                    <button
                      type="button"
                      key={country.topoId}
                      className="air-country-row"
                      onClick={() => openCountry(country)}
                    >
                      <span className="air-row-main">
                        <span className="air-row-title">{country.name}</span>
                        <span className="air-row-count">{country.studyCount} studies</span>
                      </span>
                      <span className="air-row-meta">
                        <span>{country.cityCount} mapped cities</span>
                        <span className="air-density"><i style={{ width: `${density}%` }} /></span>
                      </span>
                    </button>
                  );
                })}
                {isCountry && selectedCountry.areas.length > 0 && visibleCities.map((city, index) => (
                  <button
                    type="button"
                    key={city.name}
                    className="air-city-row"
                    onClick={() => openCity(city)}
                  >
                    <span className="air-city-index">0{index + 1}</span>
                    <span>
                      <span className="air-city-name">{city.name}</span>
                      <span className="air-city-settings">{city.settings.join(" · ")}</span>
                    </span>
                    <span className="air-city-count">{city.studyCount} {city.studyCount === 1 ? "study" : "studies"}</span>
                    <ChevronRight size={13} color="#8b988d" />
                  </button>
                ))}
                {isCountry && selectedCountry.areas.length > 0 && visibleCities.length === 0 && (
                  <div className="air-empty">
                    <span className="air-empty-icon"><Search size={16} /></span>
                    <strong>No cities match</strong>
                    <p>Try a different place name or clear the search.</p>
                  </div>
                )}
                {isCountry && selectedCountry.areas.length === 0 && (
                  <div className="air-empty">
                    <span className="air-empty-icon"><MapPin size={16} /></span>
                    <strong>City records are not in this preview</strong>
                    <p>{selectedCountry.name} is represented in the country index. City-level details are available for Morocco in this local demonstration.</p>
                  </div>
                )}
                {isCity && visibleStudies.map((study) => {
                  const pollutants = Array.from(new Set(study.records.flatMap((record) => Object.keys(record.measurements))));
                  return (
                    <button
                      type="button"
                      key={study.id}
                      className="air-study-row"
                      onClick={() => openStudy(study)}
                    >
                      <span className="air-study-title">{study.title}</span>
                      <span className="air-study-meta">
                        <span>{study.author}</span><i className="air-dot" /><span>{study.publicationYear}</span>
                      </span>
                      <span className="air-tags">
                        {pollutants.map((key) => <span className="air-tag" key={key}>{pollutantNames[key] ?? key}</span>)}
                        <span className="air-tag">{study.records.length} method</span>
                      </span>
                    </button>
                  );
                })}
                {isCity && visibleStudies.length === 0 && (
                  <div className="air-empty">
                    <span className="air-empty-icon"><Search size={16} /></span>
                    <strong>No studies match</strong>
                    <p>Search within titles, authors, sources, locations and methods.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="air-list-head">
                <span>Selected study</span>
                <strong>{selectedStudy.id.toUpperCase()}</strong>
              </div>
              <article className="air-study-detail">
                <h2 className="air-detail-title">{selectedStudy.title}</h2>
                <p className="air-detail-author">{selectedStudy.author}</p>
                <p className="air-detail-source">{selectedStudy.source} <span aria-hidden="true">·</span> Published {selectedStudy.publicationYear}</p>
                {selectedStudy.identifier && (
                  <a className="air-publication" href={selectedStudy.identifier} target="_blank" rel="noreferrer">
                    View publication <ExternalLink size={12} />
                  </a>
                )}

                <div className="air-detail-divider" />
                <p className="air-detail-kicker">Study record</p>
                <div className="air-detail-facts">
                  <div className="air-fact">
                    <label>Study years</label>
                    <span>{selectedStudy.yearFrom}–{selectedStudy.yearTo}</span>
                  </div>
                  <div className="air-fact">
                    <label>Sampling period</label>
                    <span>{selectedStudy.records[0]?.samplingPeriod}</span>
                  </div>
                  <div className="air-fact" style={{ gridColumn: "1 / -1" }}>
                    <label>Study location</label>
                    <span>{selectedStudy.records[0]?.studyArea}</span>
                  </div>
                </div>

                {selectedStudy.records.map((record, index) => (
                  <section key={`${record.studyArea}-${record.samplingPeriod}-${index}`}>
                    <div className="air-detail-divider" />
                    <p className="air-detail-kicker"><FileText size={10} style={{ verticalAlign: "-1px", marginRight: 5 }} /> Methodology · {index + 1} / {selectedStudy.records.length}</p>
                    <div className="air-method">{record.methodology}</div>
                    <p className="air-description">{record.description}</p>
                    <div className="air-detail-divider" />
                    <p className="air-detail-kicker"><Database size={10} style={{ verticalAlign: "-1px", marginRight: 5 }} /> Measured pollutants · illustrative values</p>
                    <div className="air-measurements">
                      {Object.entries(record.measurements).map(([key, value]) => (
                        <div className="air-measurement" key={key}>
                          <b>{pollutantNames[key] ?? key}</b>
                          <span>Example value · {value}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </article>
            </>
          )}

          <footer className="air-disclaimer">
            <div className="air-disclaimer-row">
              <CircleDot size={12} />
              <span><strong>Demonstration data.</strong> Values and coverage shown here mirror the extracted mockup fixture and are not authoritative research claims.</span>
            </div>
          </footer>
        </aside>
      </section>
    </main>
  );
}
