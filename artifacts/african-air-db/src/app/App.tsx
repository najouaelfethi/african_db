import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import africaGeoJSON from "./data/africa-countries.json";
import reunionGeoJSON from "./data/reunion.json";
import arcairStudiesData from "./data/arcair-studies.json";
import arcairLogo from "../assets/arcair-logo.png";
import {
  Home,
  Info,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  SlidersHorizontal,
  Layers,
  MapPin,
  Minus,
  Plus,
  Map as MapIcon,
} from "lucide-react";
import {
  getCountrySummaries,
  getAllAreas,
  getDatasetStats,
  getPollutantsByCategory,
  getSettings,
  getStudyById,
} from "./services/studyService";
import type {
  CountrySummary,
  AreaSummary,
  StudyFilters,
  PollutantInfo,
} from "./types/arcair";
import { useAsync } from "./hooks/useData";
import SearchPage from "./SearchPage";
import StudyDetailPage from "./StudyDetailPage";
import HomePage from "./HomePage";
import { Chem, unitToHtml } from "./utils/chemFormat";
import AdminDashboard from "./AdminDashboard";
/*temporary adding this import*/
import { testMapApi } from "./services/studyService";


const MAP_CONFIG = {
  view: {
    center: [5, 20] as [number, number],
    zoom: 4,
    minZoom: 2.5,
    maxZoom: 12,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
  },
  colors: {
    selected: "#3D35F4",
    selectedStroke: "#FFFFFF",
    hasStudies: "#BFD5FF",
    noStudies: "#EEF1F5",
    hoverStudy: "#9FBCFF",
    hoverNoStudy: "#E2E8F0",
    clusterPrimary: "#256FA8",
    clusterSelected: "#3D35F4",
    choropleth: [
      "#EEF1F5",
      "#BFD5FF",
      "#9FBCFF",
      "#7AA3FF",
      "#5C8AFF",
      "#3D35F4",
    ],
  },
  cluster: {
    iconMinSize: 28,
    iconMaxSize: 54,
    iconBaseFactor: 5.5,
    thresholds: [8.5, 5, 0, 0, 0],
    zoomLevels: [3.25, 4, 4.75, 5.5],
  },
  animation: { countryMs: 140, hoverMs: 100, flyDuration: 0.35 },
};

const MOROCCO_ID = "504";

// Small islands use their real GeoJSON polygons and zoom in when selected.
const SMALL_ISLAND_IDS = new Set([
  "132",
  "678",
  "174",
  "690",
  "480",
  "reunion",
]);

const ADMIN_FAKE_USERS = [
  {
    id: 1,
    name: "Najoua",
    role: "Data Scientist",
    region: "Morocco",
    status: "Active",
    lastSeen: "12 min ago",
  },
  {
    id: 2,
    name: "Mohamed",
    role: "Data Scientist",
    region: "Morocco",
    status: "Active",
    lastSeen: "34 min ago",
  },
  {
    id: 3,
    name: "Salma",
    role: "Data Analyst",
    region: "Senegal",
    status: "Pending",
    lastSeen: "1h ago",
  },
];

const ADMIN_FAKE_TASKS = [
  {
    id: 1,
    title: "Approve new study submission",
    category: "Review",
    due: "Today",
  },
  {
    id: 2,
    title: "Verify air quality dataset",
    category: "Validation",
    due: "Tomorrow",
  },
  { id: 3, title: "Respond to user report", category: "Support", due: "2d" },
  {
    id: 4,
    title: "Publish admin announcement",
    category: "Content",
    due: "This week",
  },
];

const ADMIN_FAKE_ALERTS = [
  { id: 1, message: "3 new user signups awaiting approval", level: "info" },
  {
    id: 2,
    message: "Study upload queue has 7 pending files",
    level: "warning",
  },
  {
    id: 3,
    message: "Scheduled maintenance tonight at 23:00 UTC",
    level: "critical",
  },
];

// Auth: accept @um6p.ma emails or the legacy admin account.
const ADMIN_AUTH = {
  username: "admin",
  password: "admin123",
};
const isUM6PEmail = (v: string) => v.trim().toLowerCase().endsWith("@um6p.ma");
const UM6P_PASSWORD = "um6p2024";

const AFRICA_COUNTRY_IDS = new Set([
  "012",
  "024",
  "204",
  "072",
  "854",
  "108",
  "120",
  "132",
  "140",
  "148",
  "174",
  "178",
  "180",
  "384",
  "262",
  "818",
  "226",
  "232",
  "748",
  "231",
  "266",
  "270",
  "288",
  "324",
  "624",
  "404",
  "426",
  "430",
  "434",
  "450",
  "454",
  "466",
  "478",
  "480",
  "504",
  "508",
  "516",
  "562",
  "566",
  "646",
  "678",
  "686",
  "690",
  "694",
  "706",
  "710",
  "728",
  "729",
  "732",
  "834",
  "768",
  "788",
  "800",
  "894",
  "716",
]);

function normalizeCountryId(id: string | number | undefined) {
  return String(id ?? "").padStart(3, "0");
}

function getCountryStyle(
  rawId: string,
  selectedCountryId: string,
  useChoropleth: boolean,
  countriesWithStudies: Set<string>,
  countryStudyCounts: Map<string, number>,
): L.PathOptions {
  const countryId = rawId;
  const selected = countryId === selectedCountryId;
  const isMorocco = countryId === MOROCCO_ID;

  if (selected) {
    return {
      fillColor: MAP_CONFIG.colors.selected,
      fillOpacity: 0.94,
      color: isMorocco
        ? MAP_CONFIG.colors.selected
        : MAP_CONFIG.colors.selectedStroke,
      opacity: 1,
      weight: isMorocco ? 0.65 : 1.05,
    };
  }

  const studyCount = countryStudyCounts.get(countryId) ?? 0;
  const hasStudies = countriesWithStudies.has(countryId);

  if (useChoropleth && hasStudies) {
    const intensity = Math.min(1, Math.log(studyCount + 1) / Math.log(50));
    const r = Math.round(0xee + (0x3d - 0xee) * intensity);
    const g = Math.round(0xf1 + (0x35 - 0xf1) * intensity);
    const b = Math.round(0xf5 + (0xf4 - 0xf5) * intensity);
    const fillColor = `rgb(${r}, ${g}, ${b})`;
    return {
      fillColor,
      fillOpacity: 0.7 + intensity * 0.24,
      color: isMorocco ? fillColor : "#FFFFFF",
      opacity: 1,
      weight: 0.65,
    };
  }

  const fillColor = hasStudies
    ? MAP_CONFIG.colors.hasStudies
    : MAP_CONFIG.colors.noStudies;
  return {
    fillColor,
    fillOpacity: hasStudies ? 0.78 : 0.86,
    color: isMorocco ? fillColor : "#FFFFFF",
    opacity: 1,
    weight: 0.65,
  };
}

function distanceBetween(a: [number, number], b: [number, number]) {
  const lon = a[0] - b[0];
  const lat = a[1] - b[1];

  return Math.sqrt(lon * lon + lat * lat);
}

type CityCluster = {
  id: string;
  name: string;
  coordinates: [number, number];
  cities: AreaSummary[];
  total: number;
};

function clusterCities(cities: AreaSummary[], zoom: number): CityCluster[] {
  const levels = MAP_CONFIG.cluster.zoomLevels;
  const thresh = MAP_CONFIG.cluster.thresholds;
  const threshold =
    zoom < levels[0]
      ? thresh[0]
      : zoom < levels[1]
        ? thresh[1]
        : zoom < levels[2]
          ? thresh[2]
          : zoom < levels[3]
            ? thresh[3]
            : thresh[4];
  const clusters: CityCluster[] = [];

  cities.forEach((city) => {
    const match =
      threshold > 0
        ? clusters.find(
            (cluster) =>
              distanceBetween(cluster.coordinates, city.coordinates) <=
              threshold,
          )
        : undefined;

    if (!match) {
      clusters.push({
        id: `${city.country}-${city.name}`,
        name: city.name,
        coordinates: city.coordinates,
        cities: [city],
        total: city.studyCount,
      });
      return;
    }

    const nextCities = [...match.cities, city];
    const nextTotal = nextCities.reduce(
      (sum, item) => sum + item.studyCount,
      0,
    );
    match.cities = nextCities;
    match.total = nextTotal;
    match.coordinates = [
      nextCities.reduce(
        (sum, item) => sum + item.coordinates[0] * item.studyCount,
        0,
      ) / nextTotal,
      nextCities.reduce(
        (sum, item) => sum + item.coordinates[1] * item.studyCount,
        0,
      ) / nextTotal,
    ];
    match.id = nextCities
      .map((item) => `${item.country}-${item.name}`)
      .join("-");
    match.name = `${nextCities.length} areas`;
  });

  return clusters;
}

function toLatLng(coordinates: [number, number]): [number, number] {
  return [coordinates[1], coordinates[0]];
}

function createCityClusterIcon(
  cluster: CityCluster,
  selectedCountryName: string,
) {
  const selected = cluster.cities.some(
    (city) => city.country === selectedCountryName,
  );
  const size = Math.max(
    MAP_CONFIG.cluster.iconMinSize,
    Math.min(
      MAP_CONFIG.cluster.iconMaxSize,
      22 + Math.sqrt(cluster.total) * MAP_CONFIG.cluster.iconBaseFactor,
    ),
  );
  const color = selected
    ? MAP_CONFIG.colors.clusterSelected
    : MAP_CONFIG.colors.clusterPrimary;
  const label =
    cluster.cities.length > 1
      ? `${cluster.cities.length} areas`
      : cluster.cities[0].name;

  return L.divIcon({
    className: "city-study-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div class="city-study-cluster__halo" style="width:${size + 20}px;height:${size + 20}px;background:${color};"></div>
      <div class="city-study-cluster__bubble" style="width:${size}px;height:${size}px;background:${color};">
        <strong>${cluster.total}</strong>
      </div>
      <div class="city-study-cluster__label">${label}</div>
    `,
  });
}

// ISO 3166-1 alpha-2 codes for every African country + nearby territories.
// Keys must match the canonical names in the study dataset (geo.ts).
const COUNTRY_ISO2: Record<string, string> = {
  Algeria: "dz",
  Morocco: "ma",
  Tunisia: "tn",
  Libya: "ly",
  Egypt: "eg",
  Sudan: "sd",
  Mauritania: "mr",
  Mali: "ml",
  Senegal: "sn",
  "The Gambia": "gm",
  "Guinea-Bissau": "gw",
  Guinea: "gn",
  "Sierra Leone": "sl",
  Liberia: "lr",
  "Côte d'Ivoire": "ci",
  Ghana: "gh",
  Togo: "tg",
  Benin: "bj",
  Nigeria: "ng",
  Niger: "ne",
  "Burkina Faso": "bf",
  "Cape Verde": "cv",
  Chad: "td",
  Cameroon: "cm",
  "Central African Republic": "cf",
  "Equatorial Guinea": "gq",
  Gabon: "ga",
  "Congo Republic": "cg",
  "DR Congo": "cd",
  "São Tomé and Príncipe": "st",
  Ethiopia: "et",
  Eritrea: "er",
  Djibouti: "dj",
  Somalia: "so",
  Kenya: "ke",
  Uganda: "ug",
  Rwanda: "rw",
  Burundi: "bi",
  Tanzania: "tz",
  "South Sudan": "ss",
  Angola: "ao",
  Zambia: "zm",
  Zimbabwe: "zw",
  Malawi: "mw",
  Mozambique: "mz",
  Namibia: "na",
  Botswana: "bw",
  "South Africa": "za",
  Lesotho: "ls",
  Eswatini: "sz",
  Madagascar: "mg",
  Comoros: "km",
  Seychelles: "sc",
  Mauritius: "mu",
  Réunion: "re",
};

function CountryFlag({ country }: { country: string }) {
  const iso = COUNTRY_ISO2[country];
  return (
    <div className="w-6 h-4 rounded-sm overflow-hidden shrink-0 bg-muted">
      {iso ? (
        <img
          src={`https://flagcdn.com/32x24/${iso}.png`}
          srcSet={`https://flagcdn.com/64x48/${iso}.png 2x`}
          width={24}
          height={16}
          alt={country}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <svg viewBox="0 0 24 16" className="w-full h-full">
          <rect width="24" height="16" fill="#E0E0E0" />
        </svg>
      )}
    </div>
  );
}

type Page = "home" | "map" | "search" | "details" | "admin" | "login";

export default function App() {
  /**temporary adding this */
  useEffect(() => {
    testMapApi().catch(console.error);
  }, []);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const cityLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedCountryIdRef = useRef("504");
  const [page, setPage] = useState<Page>("home");
  const [activeTab, setActiveTab] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Fez"]));
  const [searchQuery, setSearchQuery] = useState("");

  // Real datasets hooks
  const { data: stats } = useAsync(getDatasetStats);
  const { data: categoriesData } = useAsync(getPollutantsByCategory);
  const { data: allAreasData } = useAsync(getAllAreas);
  const { data: settingsList } = useAsync(getSettings);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);

  // Year buckets derived from the dataset's real sampling-year range.
  const yearOptions = useMemo(() => {
    if (!stats?.yearFrom || !stats?.yearTo) return ["All years"];
    const opts: string[] = ["All years"];
    for (let to = stats.yearTo; to >= stats.yearFrom; to -= 5) {
      const from = Math.max(stats.yearFrom, to - 4);
      opts.push(`${from}-${to}`);
    }
    return opts;
  }, [stats]);

  // Setting keywords derived from real record descriptions (e.g. "Urban- Residential").
  const settingOptions = useMemo(() => {
    const tokens = new Set<string>();
    (settingsList || []).forEach((s) => {
      const head = s.split(/[-–;,]/)[0].trim();
      if (head) tokens.add(head);
    });
    return ["All settings", ...[...tokens].sort()];
  }, [settingsList]);

  const [yearFilter, setYearFilter] = useState("All years");
  const [topicFilter, setTopicFilter] = useState("All Topics");
  const [designFilter, setDesignFilter] = useState("All settings");

  const [selectedCountryId, setSelectedCountryId] = useState("504");
  const [selectedCountryName, setSelectedCountryName] = useState("Morocco");
  const [choroplethMode, setChoroplethMode] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(MAP_CONFIG.view.zoom);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const choroplethModeRef = useRef(choroplethMode);

  const STATIC_RESEARCH_TABS = useMemo(() => {
    const organicCompoundKeys = new Set([
      "naphtalene",
      "acenaphthylene",
      "acenaphthene",
      "fluorene",
      "phenanthrene",
      "anthracene",
      "fluoranthene",
      "pyrene",
      "benzo_a_anthracene",
      "benzo_a_pyrene",
      "benzo_e_pyrene",
      "benzo_b_fluoranthene",
      "benzo_k_fluoranthene",
      "benzo_ghi_perylene",
      "chrysene",
      "dibenzo_a_h_anthracene",
      "indeno_1_2_3_cd_pyrene",
    ]);

    const partSubTabs = [
      {
        datasetCategory: "Bulk PM",
        label: "Bulk PM (µg.m⁻³)",
      },
      {
        datasetCategory: "Carbonaceous aerosols",
        label: "Carbonaceous aerosols (µg.m⁻³)",
      },
      {
        datasetCategory: "Water soluble inorganic aerosols",
        label: "Water soluble inorganic aerosols (µg.m⁻³)",
      },
      {
        datasetCategory: "Trace metals",
        label: "Trace metals (ng.m⁻³)",
        filter: (pollutant: { key: string; name: string }) =>
          !organicCompoundKeys.has(pollutant.key),
      },
      {
        datasetCategory: "Organic pollutants",
        label: "Organic Pollutants",
      },
      {
        datasetCategory: "Atmospheric Gases",
        label: "Atmospheric Gases (ppb) (*ppm)",
      },
    ]
      .map(({ datasetCategory, label, filter }) => {
        const items = (
          (categoriesData ?? []).find(
            (group) => group.category === datasetCategory,
          )?.pollutants ?? []
        )
          .filter((pollutant) => (filter ? filter(pollutant) : true))
          .map((p) => ({
            name: p.name,
            key: p.key,
          }));

        const extraOrganicItems =
          datasetCategory === "Organic pollutants"
            ? (
                (categoriesData ?? [])
                  .find((group) => group.category === "Trace metals")
                  ?.pollutants.filter((pollutant) =>
                    organicCompoundKeys.has(pollutant.key),
                  ) ?? []
              ).map((p) => ({ name: p.name, key: p.key }))
            : [];

        return { label, items: [...items, ...extraOrganicItems] };
      })
      .filter((tab) => tab.items.length > 0);

    return [
      {
        label: "Particulate Matter",
        source: "static",
        unit: "µg/m³",
        subTabs: partSubTabs,
        keys: partSubTabs.flatMap((tab) => tab.items.map((item) => item.key)),
      },
      {
        label: "Campaigns",
        source: "static",
        unit: "",
        items: [
          { name: "Field campaigns", key: "campaign-field" },
          { name: "Urban monitoring", key: "campaign-urban" },
          { name: "Intensive observations", key: "campaign-intensive" },
          { name: "Rural background studies", key: "campaign-rural" },
        ],
        keys: [
          "campaign-field",
          "campaign-urban",
          "campaign-intensive",
          "campaign-rural",
        ],
      },
      {
        label: "Modeling & Remote Sensing",
        source: "static",
        unit: "",
        items: [
          { name: "AOD retrieval", key: "model-aod" },
          { name: "Satellite estimates", key: "model-satellite" },
          { name: "Chemical transport", key: "model-ctm" },
          { name: "Emission inventories", key: "model-emissions" },
        ],
        keys: ["model-aod", "model-satellite", "model-ctm", "model-emissions"],
      },
      {
        label: "Observations",
        source: "static",
        unit: "",
        items: [
          { name: "Ground stations", key: "obs-ground" },
          { name: "Air quality networks", key: "obs-network" },
          { name: "Observatory records", key: "obs-observatory" },
          { name: "Long-term monitoring", key: "obs-longterm" },
        ],
        keys: ["obs-ground", "obs-network", "obs-observatory", "obs-longterm"],
      },
    ];
  }, [categoriesData]);

  const TABS = STATIC_RESEARCH_TABS;

  // Handle active tab pollutant filtering
  const [selectedPollutants, setSelectedPollutants] = useState<Set<string>>(
    new Set(),
  );
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Initialize selected pollutants when tab changes
  useEffect(() => {
    if (TABS.length > 0 && TABS[activeTab]) {
      setSelectedPollutants(new Set(TABS[activeTab].keys));
      setActiveSubTab(0);
    }
  }, [activeTab, TABS]);

  const togglePollutant = (key: string) => {
    setSelectedPollutants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeFilters = useMemo<StudyFilters>(() => {
    const f: StudyFilters = {};
    if (searchQuery) f.query = searchQuery;
    if (yearFilter !== "All years") {
      const [from, to] = yearFilter.split("-").map(Number);
      f.yearFrom = from;
      f.yearTo = to;
    }
    if (topicFilter !== "All Topics") {
      // Find the key for the topic
      const p = categoriesData
        ?.flatMap((c) => c.pollutants)
        .find((p) => p.name === topicFilter);
      if (p) f.pollutants = [p.key];
    }
    if (designFilter !== "All settings") {
      f.settings = [designFilter];
    }
    const activeTabConfig = TABS[activeTab];

    if (
      activeTabConfig &&
      selectedPollutants.size > 0 &&
      selectedPollutants.size < activeTabConfig.keys.length
    ) {
      // Send the selected API pollutant keys to the study filter.
      f.pollutants = Array.from(selectedPollutants);
    }
    return f;
  }, [
    searchQuery,
    yearFilter,
    topicFilter,
    designFilter,
    selectedPollutants,
    activeTab,
    TABS,
    categoriesData,
  ]);

  const { data: countrySummariesData } = useAsync(
    () => getCountrySummaries(activeFilters),
    [activeFilters],
  );

  // Derived state
  const isFiltering =
    Object.keys(activeFilters).length > 0 &&
    (!activeFilters.categories ||
      activeFilters.categories.length === 0 ||
      Object.keys(activeFilters).length > 1 ||
      (activeFilters.pollutants && activeFilters.pollutants.length > 0));

  const countriesWithStudies = useMemo(
    () =>
      new Set(
        (countrySummariesData || [])
          .map((c) => c.topoId)
          .filter(Boolean) as string[],
      ),
    [countrySummariesData],
  );
  const countryStudyCounts = useMemo(() => {
    const m = new Map<string, number>();
    (countrySummariesData || []).forEach((c) => {
      if (c.topoId) m.set(c.topoId, c.studyCount);
    });
    return m;
  }, [countrySummariesData]);

  // Dataset country name per topo id (dataset names can differ from
  // the world-atlas feature names, e.g. "DR Congo" vs "Dem. Rep. Congo").
  const countryNameByTopoId = useMemo(() => {
    const m = new Map<string, string>();
    (countrySummariesData || []).forEach((c) => {
      if (c.topoId) m.set(c.topoId, c.name);
    });
    return m;
  }, [countrySummariesData]);

  // Refs so Leaflet event handlers (bound once) always see fresh data.
  const countriesWithStudiesRef = useRef(countriesWithStudies);
  const countryStudyCountsRef = useRef(countryStudyCounts);
  const countryNameByTopoIdRef = useRef(countryNameByTopoId);
  useEffect(() => {
    countriesWithStudiesRef.current = countriesWithStudies;
    countryStudyCountsRef.current = countryStudyCounts;
    countryNameByTopoIdRef.current = countryNameByTopoId;
  }, [countriesWithStudies, countryStudyCounts, countryNameByTopoId]);

  const selectedCountry = useMemo(
    () =>
      (countrySummariesData || []).find((c) => c.name === selectedCountryName),
    [countrySummariesData, selectedCountryName],
  );
  const countryStudyCount = selectedCountry?.studyCount ?? 0;
  const countryCities = selectedCountry?.areas ?? [];
  const countryStudies = selectedCountry?.studies ?? [];
  const validCountryYears = countryStudies
    .flatMap((study) => [study.yearFrom, study.yearTo])
    .filter((year): year is number => year !== null && year > 0);
  const countryYearFrom =
    validCountryYears.length > 0 ? Math.min(...validCountryYears) : null;
  const countryYearTo =
    validCountryYears.length > 0 ? Math.max(...validCountryYears) : null;
  const countryYearRange =
    countryYearFrom !== null && countryYearTo !== null
      ? `${countryYearFrom}-${countryYearTo}`
      : "No data";
  const allFilteredStudiesCount =
    countrySummariesData?.reduce((acc, c) => acc + c.studyCount, 0) ?? 0;
  const visibleMapCities = countrySummariesData?.flatMap((c) => c.areas) ?? [];

  const yearRange =
    stats && stats.yearFrom && stats.yearTo
      ? `${stats.yearFrom}-${stats.yearTo}`
      : "No data";
  const totalStudies = stats?.studyCount ?? 0;

  const cityClusters = useMemo(
    () => clusterCities(visibleMapCities, mapZoom),
    [visibleMapCities, mapZoom],
  );

  const navigateToPage = (id: Page) => {
    if (id === "admin" && !isAdminAuthenticated) {
      setPage("login");
      return;
    }
    setPage(id);
  };

  const handleAdminLogin = () => {
    const isLegacy =
      adminUsername.trim() === ADMIN_AUTH.username &&
      adminPassword === ADMIN_AUTH.password;
    const isUM6P =
      isUM6PEmail(adminUsername) && adminPassword === UM6P_PASSWORD;
    if (isLegacy || isUM6P) {
      setIsAdminAuthenticated(true);
      setAuthError("");
      setAdminPassword("");
      setPage("admin");
    } else {
      setAuthError(
        isUM6PEmail(adminUsername)
          ? "Incorrect password for this UM6P account."
          : "Use your @um6p.ma email or the admin account.",
      );
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setAdminUsername("");
    setAdminPassword("");
    setAuthError("");
    setPage("map");
  };

  useEffect(() => {
    choroplethModeRef.current = choroplethMode;
  }, [choroplethMode]);

  // GeoJSON is pre-processed at build time (see src/app/data/README.md):
  // Africa subset of Natural Earth 50m, Morocco+WS dissolved into one polygon.
  const africaCountries = {
    ...africaGeoJSON,
    features: [...africaGeoJSON.features, reunionGeoJSON],
  } as unknown as GeoJSON.FeatureCollection;

  useEffect(() => {
    selectedCountryIdRef.current = selectedCountryId;
  }, [selectedCountryId]);

  const isCardOnlyResearchTab =
    TABS[activeTab]?.label === "Campaigns" ||
    TABS[activeTab]?.label === "Modeling & Remote Sensing" ||
    TABS[activeTab]?.label === "Observations";

  const particulateMatterItems = useMemo(() => {
    if (TABS[activeTab]?.label !== "Particulate Matter") return [];
    return TABS[activeTab].subTabs?.flatMap((subTab) => subTab.items) ?? [];
  }, [TABS, activeTab]);

  const shouldRenderMap = page === "map" && !isCardOnlyResearchTab;

  useEffect(() => {
    if (!shouldRenderMap) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        countryLayerRef.current = null;
        cityLayerRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      attributionControl: false,
      zoomControl: false,
      zoomSnap: MAP_CONFIG.view.zoomSnap,
      zoomDelta: MAP_CONFIG.view.zoomDelta,
      minZoom: MAP_CONFIG.view.minZoom,
      maxZoom: MAP_CONFIG.view.maxZoom,
      maxBoundsViscosity: 1,
      preferCanvas: true,
    });

    map.setView(MAP_CONFIG.view.center, MAP_CONFIG.view.zoom);

    const countryLayer = L.geoJSON(africaCountries, {
      style: (item) =>
        getCountryStyle(
          normalizeCountryId(item?.id as string | number),
          selectedCountryId,
          choroplethMode,
          countriesWithStudies,
          countryStudyCounts,
        ),
      onEachFeature: (item, layer) => {
        const countryId = normalizeCountryId(item.id as string | number);
        const countryName = item.properties?.name ?? "Country";

        layer.bindTooltip(countryName, {
          direction: "top",
          opacity: 0.92,
          sticky: true,
        });
        layer.on({
          click: () => {
            setSelectedCountryId(countryId);
            setSelectedCountryName(
              countryNameByTopoIdRef.current.get(countryId) ?? countryName,
            );

            if (SMALL_ISLAND_IDS.has(countryId)) {
              const islandBounds = (layer as L.Polygon).getBounds();
              map.flyToBounds(islandBounds.pad(1.5), {
                duration: MAP_CONFIG.animation.flyDuration,
                maxZoom: MAP_CONFIG.view.maxZoom,
              });
            }
          },
          mouseover: (event) => {
            const target = event.target as L.Path;
            const isSelected = countryId === selectedCountryIdRef.current;
            target.setStyle({
              fillColor: isSelected
                ? MAP_CONFIG.colors.selected
                : countriesWithStudiesRef.current.has(countryId)
                  ? MAP_CONFIG.colors.hoverStudy
                  : MAP_CONFIG.colors.hoverNoStudy,
              weight: 1.1,
            });
            target.bringToFront();
          },
          mouseout: (event) => {
            const target = event.target as L.Path;
            target.setStyle(
              getCountryStyle(
                countryId,
                selectedCountryIdRef.current,
                choroplethModeRef.current,
                countriesWithStudiesRef.current,
                countryStudyCountsRef.current,
              ),
            );
          },
        });
      },
    }).addTo(map);

    countryLayerRef.current = countryLayer;
    cityLayerRef.current = L.layerGroup().addTo(map);

    const africaBounds = countryLayer.getBounds().pad(0.03);
    map.fitBounds(africaBounds, { animate: false });
    map.setMaxBounds(africaBounds.pad(0.02));
    map.setMinZoom(map.getBoundsZoom(africaBounds, false));
    setMapZoom(map.getZoom());

    const syncZoom = () => setMapZoom(map.getZoom());
    map.on("zoomend", syncZoom);
    mapRef.current = map;

    return () => {
      map.off("zoomend", syncZoom);
      map.remove();
      mapRef.current = null;
      countryLayerRef.current = null;
      cityLayerRef.current = null;
    };
  }, [page, shouldRenderMap]);

  useEffect(() => {
    countryLayerRef.current?.setStyle((item) =>
      getCountryStyle(
        normalizeCountryId(item?.id as string | number),
        selectedCountryId,
        choroplethMode,
        countriesWithStudies,
        countryStudyCounts,
      ),
    );
  }, [
    selectedCountryId,
    choroplethMode,
    countriesWithStudies,
    countryStudyCounts,
  ]);

  useEffect(() => {
    const layer = cityLayerRef.current;
    const map = mapRef.current;

    if (!layer || !map) return;

    layer.clearLayers();

    if (!showClusters) return;

    cityClusters.forEach((cluster) => {
      const label =
        cluster.cities.length > 1
          ? `${cluster.cities.length} cities`
          : cluster.cities[0].name;

      const marker = L.marker(toLatLng(cluster.coordinates), {
        icon: createCityClusterIcon(cluster, selectedCountryName),
        keyboard: true,
        riseOnHover: true,
      });

      marker.bindTooltip(`${label}: ${cluster.total} research studies`, {
        direction: "top",
        offset: [0, -16],
        opacity: 0.95,
      });

      marker.on("click", () => {
        const leadCity = cluster.cities.reduce(
          (largest, city) =>
            city.studyCount > largest.studyCount ? city : largest,
          cluster.cities[0],
        );

        const countrySum = countrySummariesData?.find(
          (c) => c.name === leadCity.country,
        );

        const countryId = countrySum?.topoId;

        if (countryId) {
          setSelectedCountryId(countryId);
          setSelectedCountryName(leadCity.country);
        }

        // Open the city in the sidebar.
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(leadCity.name);
          return next;
        });

        // Select the city and scroll to it.
        if (cluster.cities.length === 1) {
          setSelectedCityName(leadCity.name);

          setTimeout(() => {
            const cityRow = document.getElementById(
              `city-row-${leadCity.country}-${leadCity.name}`,
            );

            cityRow?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 150);
        }

        // Zoom in when the marker represents multiple cities.
        if (cluster.cities.length > 1) {
          map.flyTo(
            toLatLng(cluster.coordinates),
            Math.min(map.getZoom() + 1, 10),
            { duration: 0.35 },
          );
        }
      });

      layer.addLayer(marker);
    });
  }, [cityClusters, selectedCountryName, showClusters]);

  const focusAfrica = () => {
    const layer = countryLayerRef.current;
    if (!layer) return;
    mapRef.current?.flyToBounds(layer.getBounds().pad(0.04), {
      duration: 0.35,
    });
  };

  const toggleCity = (cityName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cityName) ? next.delete(cityName) : next.add(cityName);
      return next;
    });
  };

  const zoomIn = () => mapRef.current?.zoomIn(0.75);
  const zoomOut = () => mapRef.current?.zoomOut(0.75);

  const openStudyDetail = (study: { id: string }) => {
    setSelectedStudyId(study.id);
    setPage("details");
  };

  const closeStudyDetail = () => {
    setSelectedStudyId(null);
    setPage("map");
  };

  const navigateToCountry = (country: string) => {
    const countrySum = countrySummariesData?.find((c) => c.name === country);
    const id = countrySum?.topoId;
    if (id) {
      setSelectedCountryId(id);
      setSelectedCountryName(country);
    }
    setPage("map");
  };

  const NAV = [
    { id: "home" as Page, icon: Home, label: "Home" },
    { id: "map" as Page, icon: MapIcon, label: "Explore Map" },
    { id: "search" as Page, icon: SlidersHorizontal, label: "Research" },
    { id: "admin" as Page, icon: Info, label: "Admin" },
  ];

  const activeSectionCards = useMemo(() => {
    switch (TABS[activeTab]?.label) {
      case "Campaigns":
        return [
          {
            title: "North Africa Urban PM Campaign",
            meta: "Morocco · 2024 · 12 sites",
            body: "Dense seasonal monitoring of PM2.5 and black carbon across major urban corridors.",
          },
          {
            title: "West Africa Mobile Sampling Network",
            meta: "Senegal · 2023 · 8 routes",
            body: "Roadside and residential measurements across transit corridors and peri-urban settlements.",
          },
          {
            title: "Coastal Emissions Intensive Study",
            meta: "Ghana · 2025 · 6 weeks",
            body: "High-frequency observations for particulate matter, NOx, and VOCs during coastal flows.",
          },
        ];
      case "Modeling & Remote Sensing":
        return [
          {
            title: "Satellite AOD Retrieval",
            meta: "MODIS + Sentinel-3",
            body: "Regional aerosol optical depth inversion and trend estimation over the Sahel and coastal Africa.",
          },
          {
            title: "Chemical Transport Modelling",
            meta: "WRF-Chem · 10 km grid",
            body: "Source attribution for dust, biomass burning, and urban emissions under seasonal forecast scenarios.",
          },
          {
            title: "Emission Inventory Fusion",
            meta: "Road + industry + biomass",
            body: "Merged activity data to compare emissions intensities across North, West, and East Africa.",
          },
        ];
      case "Observations":
        return [
          {
            title: "Urban Background Station",
            meta: "Cairo · Active",
            body: "PM10, NO2 and O3 time series from a representative city background site.",
          },
          {
            title: "Industrial Monitoring Station",
            meta: "Johannesburg · Active",
            body: "Routine measurements for SO2, CO, PM2.5, and trace metal deposition near industrial zones.",
          },
          {
            title: "High-Altitude Observatory",
            meta: "Addis Ababa · Seasonal",
            body: "Long-term aerosol and gas observations across elevated transport and dust plume periods.",
          },
        ];
      default:
        return [];
    }
  }, [TABS, activeTab]);

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* SIDEBAR: hidden on admin/login pages which have their own chrome */}
      <aside
        className={`sidebar flex flex-col w-56 min-w-56 text-white z-20 shrink-0 ${page === "admin" || page === "login" ? "hidden" : ""}`}
      >
        {/* ── Brand header ── */}
        <div className="px-4 pt-5 pb-4">
          <img
            src={arcairLogo}
            alt="UM6P ARCAIR, African Research Center on Air Quality and Climate"
            className="w-full h-auto mb-3"
          />
          <div className="sidebar-divider mb-3" />
          <div className="text-[13px] font-semibold text-white/90 leading-snug">
            African Air Database
          </div>
        </div>

        {/* ── Primary navigation ── */}
        <nav className="px-3 flex flex-col gap-0.5 mt-1">
          <div className="text-[10px] font-semibold tracking-widest text-white/30 uppercase px-2 mb-1.5">
            Navigate
          </div>
          {NAV.map(({ id, icon: Icon, label }) => {
            const isActive =
              page === id || (id === "map" && page === "details");
            const navActive = page === id;
            return (
              <button
                key={id}
                onClick={() => navigateToPage(id)}
                className={`sidebar-nav-item group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150 text-left
                  ${
                    navActive
                      ? "bg-white/12 text-white font-medium shadow-sm"
                      : "text-white/55 hover:text-white/90 hover:bg-white/7"
                  }
                `}
              >
                {navActive && <div className="sidebar-nav-pill" />}
                <Icon
                  size={15}
                  className={`shrink-0 transition-colors duration-150 ${navActive ? "text-[#6EA8FF]" : "text-white/40 group-hover:text-white/70"}`}
                />
                <span className="truncate">{label}</span>
                {navActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6EA8FF] shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Map controls (context panel) ── */}
        {page === "map" && (
          <div className="mx-3 mt-4 rounded-lg sidebar-controls-panel px-3 py-3">
            <div className="text-[10px] font-semibold tracking-widest text-white/35 uppercase mb-2.5">
              Map Display
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setChoroplethMode((m) => !m)}
                className="flex items-center justify-between gap-2 w-full text-left group"
              >
                <span className="text-[12px] text-white/65 group-hover:text-white/85 transition-colors leading-tight">
                  Density coloring
                </span>
                <div
                  className={`relative w-8 h-4.5 rounded-full shrink-0 toggle-track ${choroplethMode ? "bg-[#2E6BE6]" : "bg-white/15"}`}
                  style={{ height: "18px", width: "32px" }}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white toggle-thumb shadow-sm ${choroplethMode ? "left-3.5" : "left-0.5"}`}
                    style={{ width: "14px", height: "14px" }}
                  />
                </div>
              </button>
              <button
                onClick={() => setShowClusters((c) => !c)}
                className="flex items-center justify-between gap-2 w-full text-left group"
              >
                <span className="text-[12px] text-white/65 group-hover:text-white/85 transition-colors leading-tight">
                  City clusters
                </span>
                <div
                  className={`relative rounded-full shrink-0 toggle-track ${showClusters ? "bg-[#2E6BE6]" : "bg-white/15"}`}
                  style={{ height: "18px", width: "32px" }}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white toggle-thumb shadow-sm ${showClusters ? "left-3.5" : "left-0.5"}`}
                    style={{ width: "14px", height: "14px" }}
                  />
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1" />
      </aside>

      {/* ── CONTENT ── */}
      {page === "home" ? (
        <HomePage
          stats={stats}
          onGoHome={() => setPage("home")}
          onExploreMap={() => setPage("map")}
          onBrowseResearch={() => setPage("search")}
          onAdmin={() => setPage("login")}
        />
      ) : page === "search" ? (
        <SearchPage
          onOpenStudy={(id) => {
            setSelectedStudyId(id);
            setPage("details");
          }}
        />
      ) : page === "details" && selectedStudyId ? (
        <StudyDetailPage
          studyId={selectedStudyId}
          onBack={closeStudyDetail}
          onNavigateToCountry={navigateToCountry}
        />
      ) : page === "login" ? (
        <div className="flex flex-col flex-1 items-center justify-center bg-[#FCFDFF] p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-white px-8 py-10 shadow-sm">
            {/* UM6P branding */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-[#0F1724] px-4 py-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-semibold text-white tracking-wide">
                  ARC-Air Admin Console
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Sign in
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Use your{" "}
                <span className="font-semibold text-foreground">@um6p.ma</span>{" "}
                email to access the admin dashboard.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-[11px] font-medium text-foreground">
                UM6P Email
                <input
                  type="email"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                  placeholder="firstname.lastname@um6p.ma"
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  autoComplete="email"
                />
              </label>
              <label className="block text-[11px] font-medium text-foreground">
                Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                  autoComplete="current-password"
                />
              </label>
            </div>

            {authError && (
              <p className="mt-4 text-sm text-destructive">{authError}</p>
            )}

            <button
              onClick={handleAdminLogin}
              className="mt-6 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Sign in with UM6P
            </button>

            <div className="mt-5 rounded-2xl bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground space-y-1">
              <div>
                <span className="font-semibold text-foreground">Admin:</span>{" "}
                <code>admin</code> · <code>admin123</code>
              </div>
            </div>
          </div>
        </div>
      ) : page === "admin" ? (
        <AdminDashboard
          onLogout={handleAdminLogout}
          userEmail={adminUsername || ADMIN_AUTH.username}
        />
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top tabs */}
          <nav className="shrink-0 bg-white border-b border-border">
            <div className="flex flex-wrap 2xl:flex-nowrap">
              {TABS.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(i)}
                  className={`relative flex shrink-0 items-center gap-1.5 px-4 2xl:px-2.5 py-3 text-xs font-medium transition-colors whitespace-nowrap
                    ${activeTab === i ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"}`}
                >
                  <span className="flex items-baseline gap-0.5">
                    {tab.label}
                    {tab.unit && (
                      <span
                        className="text-[9px] font-normal opacity-50"
                        dangerouslySetInnerHTML={{
                          __html: `(${unitToHtml(tab.unit)})`,
                        }}
                      />
                    )}
                  </span>
                  {tab.items && tab.items.length > 0 && (
                    <ChevronDown size={11} />
                  )}
                </button>
              ))}
            </div>

            {TABS[activeTab]?.source === "static" && TABS[activeTab].subTabs ? (
              <div className="border-t border-border/50 bg-[#F5F8FF] px-4 py-2.5">
                <div className="flex flex-wrap gap-2">
                  {TABS[activeTab].subTabs.map((subTab, idx) => (
                    <button
                      key={subTab.label}
                      type="button"
                      onClick={() => setActiveSubTab(idx)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                        activeSubTab === idx
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-border bg-white text-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 pt-2">
                  {(TABS[activeTab].subTabs?.[activeSubTab]?.items ?? []).map(
                    (item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1.5 cursor-pointer hover:border-primary/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary w-3.5 h-3.5"
                          checked={selectedPollutants.has(item.key)}
                          onChange={() => togglePollutant(item.key)}
                        />
                        <span className="text-[11px] text-foreground/80">
                          <Chem name={item.name} />
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>
            ) : TABS[activeTab]?.items && TABS[activeTab].items.length > 0 ? (
              <div className="flex flex-wrap gap-0 px-4 py-2 bg-[#F0F5FF] border-t border-border/50">
                {TABS[activeTab].items.map((item, idx) => (
                  <label
                    key={String(item.key ?? item)}
                    className="flex items-center gap-1.5 mr-5 py-0.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary w-3 h-3"
                      checked={selectedPollutants.has(String(item.key ?? item))}
                      onChange={() => togglePollutant(String(item.key ?? item))}
                    />
                    <span className="text-[11px] text-foreground/70">
                      <Chem name={String(item.name ?? item)} />
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </nav>

          {/* Map + right panel */}
          <div className="flex flex-1 overflow-hidden">
            {/* Map or placeholder cards */}
            <div className="relative flex-1 overflow-hidden bg-[#F7F9FC]">
              {isCardOnlyResearchTab ? (
                <div className="h-full overflow-auto p-5">
                  <div className="mx-auto max-w-3xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {TABS[activeTab]?.label}
                        </div>
                        <h3 className="mt-1 text-xl font-semibold text-foreground">
                          {TABS[activeTab]?.label === "Campaigns"
                            ? "Field initiatives"
                            : TABS[activeTab]?.label ===
                                "Modeling & Remote Sensing"
                              ? "Analytical workflows"
                              : "Monitoring network"}
                        </h3>
                      </div>
                      <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary">
                        Placeholder data
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {activeSectionCards.map((card) => (
                        <div
                          key={card.title}
                          className="rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">
                                {card.title}
                              </h4>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {card.meta}
                              </p>
                            </div>
                            <span className="mt-0.5 rounded-full bg-[#EEF3FF] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
                              Active
                            </span>
                          </div>
                          <p className="mt-3 text-[12px] leading-6 text-foreground/75">
                            {card.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    ref={mapContainerRef}
                    className="absolute inset-0 z-0 africa-vector-map"
                  />

                  <div className="absolute right-4 top-4 z-10 rounded-full bg-white/95 px-2 py-2 shadow-sm">
                    <div className="flex flex-col gap-2">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D9E1FF] text-[#3D35F4] hover:bg-[#F4F6FF]"
                        title="Hydrogen sulfide layer"
                      >
                        <span className="text-[8px] font-bold">H₂S</span>
                      </button>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D9E1FF] text-[#3D35F4] hover:bg-[#F4F6FF]"
                        title="Carbon monoxide layer"
                      >
                        <span className="text-[8px] font-bold">CO</span>
                      </button>
                    </div>
                  </div>

                  <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded bg-white/95 p-1 shadow-sm">
                    <button
                      onClick={focusAfrica}
                      title="Show all Africa"
                      className="flex h-8 items-center gap-1.5 rounded bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors"
                    >
                      <Layers size={13} />
                      Africa
                    </button>
                    <button
                      onClick={() => setShowClusters((c) => !c)}
                      title={
                        showClusters
                          ? "Hide city clusters"
                          : "Show city clusters"
                      }
                      className={`flex h-8 items-center gap-1.5 rounded px-2.5 text-[11px] font-medium transition-colors ${
                        showClusters
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/50 hover:text-foreground/70"
                      }`}
                    >
                      <MapPin size={13} />
                      Cities
                    </button>
                  </div>

                  <div className="absolute right-4 top-24 z-10 rounded bg-white/95 px-3 py-2 text-[10px] text-foreground/70 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {selectedCountryName}
                      </span>
                      <span>selected</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {countryStudyCount}
                      </span>
                      <span>
                        {countryStudyCount === 1 ? "study" : "studies"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {cityClusters.length}
                      </span>
                      <span>
                        {cityClusters.length === 1
                          ? "city cluster"
                          : "city clusters"}
                      </span>
                    </div>
                    {activeFilters && (
                      <div className="mt-1 text-primary">filtered map</div>
                    )}
                  </div>

                  <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-white/90 px-3 py-2.5 text-[10px] shadow-md backdrop-blur-sm">
                    {choroplethMode ? (
                      <div className="mb-1.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="font-semibold text-foreground">
                            Study Density
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {MAP_CONFIG.colors.choropleth.map((c, i) => (
                            <div
                              key={i}
                              className="h-3 w-3 rounded-sm first:rounded-l-sm last:rounded-r-sm"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                          <span>Fewer</span>
                          <span>More studies</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-3 w-3 rounded-sm"
                            style={{
                              backgroundColor: MAP_CONFIG.colors.selected,
                            }}
                          />
                          <span className="text-foreground/70">
                            Selected Country
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-3 w-3 rounded-sm"
                            style={{
                              backgroundColor: MAP_CONFIG.colors.hasStudies,
                            }}
                          />
                          <span className="text-foreground/70">
                            Has Studies
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-sm"
                            style={{
                              backgroundColor: MAP_CONFIG.colors.noStudies,
                            }}
                          />
                          <span className="text-foreground/70">No Studies</span>
                        </div>
                      </>
                    )}
                    <div className="mt-1.5 pt-1.5 border-t border-border/40">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-4 w-4 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: MAP_CONFIG.colors.clusterPrimary,
                          }}
                        >
                          <span className="text-[7px] font-bold text-white">
                            {Math.min(cityClusters.length, 99)}
                          </span>
                        </div>
                        <span className="text-foreground/70">
                          City clusters
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setChoroplethMode((m) => !m)}
                      className="mt-1.5 text-[9px] text-primary font-medium hover:underline"
                    >
                      {choroplethMode
                        ? "Switch to binary"
                        : "Switch to density"}
                    </button>
                  </div>

                  <div className="absolute bottom-4 right-4 flex flex-col gap-1">
                    <button
                      onClick={zoomIn}
                      title="Zoom in"
                      className="flex h-8 w-8 items-center justify-center rounded bg-white text-foreground/70 shadow hover:text-foreground"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={zoomOut}
                      title="Zoom out"
                      className="flex h-8 w-8 items-center justify-center rounded bg-white text-foreground/70 shadow hover:text-foreground"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {!isCardOnlyResearchTab && (
              <div className="w-80 xl:w-96 flex flex-col bg-white border-l border-border overflow-hidden shrink-0">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <CountryFlag country={selectedCountryName} />
                    <h2 className="font-semibold text-sm text-foreground">
                      {selectedCountryName}
                    </h2>
                  </div>
                  <button
                    onClick={focusAfrica}
                    className="text-[11px] text-primary font-medium hover:underline whitespace-nowrap"
                  >
                    Reset Africa View
                  </button>
                </div>

                <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
                  {[
                    {
                      val: isFiltering
                        ? `${countryStudies.length}/${countrySummariesData?.find((c) => c.name === selectedCountryName)?.studyCount ?? 0}`
                        : String(countryStudyCount),
                      label: "Studies",
                    },
                    { val: String(countryCities.length), label: "Areas" },
                    { val: countryYearRange, label: "Overall Years" },
                    { val: String(totalStudies), label: "Total in DB" },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center py-3 px-1"
                    >
                      <span className="text-sm font-bold text-foreground leading-tight text-center">
                        {s.val}
                      </span>
                      {s.label && (
                        <span className="text-[9px] text-muted-foreground mt-0.5">
                          {s.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      Filters
                      {activeFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setYearFilter("All years");
                        setTopicFilter("All Topics");
                        setDesignFilter("All settings");
                      }}
                      className={`text-[10px] font-medium transition-all duration-300 ${
                        isFiltering
                          ? "text-primary hover:underline clear-pulse"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isFiltering ? "Clear Filters" : "Clear"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        val: yearFilter,
                        set: setYearFilter,
                        opts: yearOptions,
                        defaults: "All years",
                      },
                      {
                        val: topicFilter,
                        set: setTopicFilter,
                        opts: [
                          "All Topics",
                          ...(categoriesData
                            ?.flatMap((c) => c.pollutants)
                            .map((p) => p.name) || []),
                        ],
                        defaults: "All Topics",
                      },
                      {
                        val: designFilter,
                        set: setDesignFilter,
                        opts: settingOptions,
                        defaults: "All settings",
                      },
                    ].map(({ val, set, opts, defaults }, i) => {
                      const isActive = val !== defaults;
                      return (
                        <div key={i} className="relative">
                          <select
                            value={val}
                            onChange={(e) => set(e.target.value)}
                            className={`w-full text-[10px] border rounded px-2 py-1.5 bg-background text-foreground appearance-none pr-5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all duration-300 ${
                              isActive
                                ? "filter-active border-primary"
                                : "border-border"
                            }`}
                          >
                            {opts.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                          <ChevronDown
                            size={10}
                            className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300 ${
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isFiltering && (
                  <div className="px-4 py-2 border-b border-border bg-muted/20">
                    <div className="flex flex-wrap gap-1.5">
                      {yearFilter !== "All years" && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          Year: {yearFilter}
                        </span>
                      )}
                      {topicFilter !== "All Topics" && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          Topic: {topicFilter}
                        </span>
                      )}
                      {designFilter !== "All settings" && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          Setting: {designFilter}
                        </span>
                      )}
                      {selectedPollutants.size > 0 &&
                        selectedPollutants.size <
                          (TABS[activeTab]?.keys.length || 0) && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                            {selectedPollutants.size} Pollutants filtered
                          </span>
                        )}
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          Search: "
                          {searchQuery.length > 15
                            ? searchQuery.slice(0, 15) + "…"
                            : searchQuery}
                          "
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      {allFilteredStudiesCount} of {totalStudies} studies match
                      across Africa
                    </div>
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
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full text-[11px] border rounded pl-7 pr-7 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60 transition-all duration-300 ${
                        searchQuery
                          ? "search-active border-primary"
                          : "border-border"
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-90"
                      >
                        <X size={12} className="text-primary" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {countryStudyCount === 0 && (
                    <div className="px-5 py-8 text-center">
                      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Info size={16} />
                      </div>
                      <div className="text-xs font-semibold text-foreground">
                        {isFiltering
                          ? "No studies match filters"
                          : "No studies mapped yet"}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {isFiltering
                          ? "Try clearing your filters or selecting a different country."
                          : `${selectedCountryName} is selectable, but there are no research studies in the current dataset.`}
                      </p>
                    </div>
                  )}

                  {countryStudyCount > 0 && (
                    <>
                      <div className="divide-y divide-border/40">
                        {countryCities.map((city, idx) => (
                          <div
                            key={`${city.country}-${city.name}-${idx}`}
                            id={`city-row-${city.country}-${city.name}`}
                            className={idx === 0 ? "" : ""}
                          >
                            <button
                              className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/40 transition-all duration-200"
                              onClick={() => {
                                toggleCity(city.name);
                                setSelectedCityName(city.name);
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`transition-transform duration-200 ${expanded.has(city.name) ? "rotate-0" : "-rotate-90"}`}
                                >
                                  <ChevronDown
                                    size={12}
                                    className="text-muted-foreground"
                                  />
                                </span>
                                <div className="text-left">
                                  <div className="text-xs font-medium text-foreground">
                                    {city.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground max-w-30 truncate">
                                    {city.settings?.join(", ")}
                                  </div>
                                </div>
                              </div>
                              <span
                                className="text-[11px] font-semibold text-primary bg-primary/10 rounded px-2 py-0.5"
                                style={{ fontFamily: "'DM Mono', monospace" }}
                              >
                                {city.studyCount} studies
                              </span>
                            </button>
                            <div
                              className={`overflow-hidden transition-all duration-250 ease-in-out ${
                                expanded.has(city.name)
                                  ? "max-h-96 opacity-100"
                                  : "max-h-0 opacity-0"
                              }`}
                            >
                              <div className="bg-muted/30 pl-10 pr-4 py-2 space-y-0.5">
                                {city.studies.length === 0 ? (
                                  <div className="text-[11px] text-muted-foreground py-1">
                                    No study details available
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 py-1">
                                    {city.studies.map((s) => {
                                      const pKeys = new Set(
                                        (
                                          countryStudies.find(
                                            (cs) => cs.id === s.id,
                                          )?.records ?? []
                                        ).flatMap((r) =>
                                          Object.keys(r.measurements),
                                        ),
                                      );
                                      const pNames = Array.from(pKeys)
                                        .slice(0, 3)
                                        .map((k) => {
                                          const p = categoriesData
                                            ?.flatMap((c) => c.pollutants)
                                            .find((p) => p.key === k);
                                          return p ? p.name : k;
                                        });
                                      return (
                                        <button
                                          key={s.id}
                                          onClick={() => openStudyDetail(s)}
                                          className="w-full text-left rounded-lg border border-border bg-white p-2.5 hover:border-primary/30 hover:shadow-sm transition-all duration-150"
                                        >
                                          <div className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">
                                            {s.title || s.source}
                                          </div>
                                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                                            {s.source}
                                          </div>
                                          {pNames.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              {pNames.map((n) => (
                                                <span
                                                  key={n}
                                                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                                                >
                                                  {n}
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

                      <div className="px-4 py-4">
                        <div className="mb-3 text-xs font-semibold text-foreground">
                          Study Records
                        </div>
                        {countryStudies.length === 0 ? (
                          <div className="rounded-lg border border-border bg-muted/20 px-3 py-5 text-center text-[11px] text-muted-foreground">
                            No studies match the current search.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {countryStudies.map((study) => {
                              const pKeys = new Set(
                                study.records.flatMap((r) =>
                                  Object.keys(r.measurements),
                                ),
                              );
                              const pNames = Array.from(pKeys)
                                .slice(0, 3)
                                .map((k) => {
                                  const p = categoriesData
                                    ?.flatMap((c) => c.pollutants)
                                    .find((p) => p.key === k);
                                  return p ? p.name : k;
                                });
                              return (
                                <div
                                  key={study.id}
                                  onClick={() => openStudyDetail(study)}
                                  className="rounded-lg border border-border bg-white p-3 transition-all duration-200 hover:shadow-sm hover:border-primary/20 cursor-pointer"
                                >
                                  <div className="text-xs font-semibold leading-snug text-foreground">
                                    {study.title}
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    {study.source} ({study.yearFrom}
                                    {study.yearTo &&
                                    study.yearTo !== study.yearFrom
                                      ? `-${study.yearTo}`
                                      : ""}
                                    )
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {pNames.map((item) => (
                                      <span
                                        key={item}
                                        className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
