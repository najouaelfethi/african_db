import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import africaGeoJSON from "./data/africa-countries.json";
import reunionGeoJSON from "./data/reunion.json";
import arcairLogo from "../assets/arcair-logo.png";
import {
  Home,
  Info,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  X,
  SlidersHorizontal,
  Layers,
  Mail,
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
  getStudyById,
} from "./services/studyService";
import type {
  CountrySummary,
  AreaSummary,
  Study,
  StudyFilters,
  PollutantInfo,
} from "./types/arcair";
import { useAsync } from "./hooks/useData";
import SearchPage from "./SearchPage";
import StudyDetailPage from "./StudyDetailPage";
import HomePage from "./HomePage";
import ContactPage from "./ContactPage";
import { Chem, unitToHtml } from "./utils/chemFormat";
import AdminDashboard from "./AdminDashboard";
import MeasureFilterControls, {
  getSelectedPollutantKeysForMap,
  updateSelectedMeasures,
} from "./components/MeasureFilterControls";
/*temporary adding this import*/

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

type Page =
  "home" | "map" | "search" | "details" | "contact" | "admin" | "login";
type InternalPage = Exclude<Page, "admin" | "login">;

interface AppHistoryEntry {
  page: InternalPage;
  selectedStudyId: string | null;
  detailReturnPage: InternalPage;
}

const APP_HISTORY_KEY = "arcAirDatabasePage";
const INTERNAL_PAGES = new Set<InternalPage>([
  "home",
  "map",
  "search",
  "details",
]);

function readAppHistoryEntry(state: unknown): AppHistoryEntry | null {
  if (typeof state !== "object" || state === null) return null;
  const entry = (state as Record<string, unknown>)[APP_HISTORY_KEY];
  if (typeof entry !== "object" || entry === null) return null;

  const candidate = entry as Record<string, unknown>;
  if (
    !INTERNAL_PAGES.has(candidate.page as InternalPage) ||
    !INTERNAL_PAGES.has(candidate.detailReturnPage as InternalPage)
  ) {
    return null;
  }

  return {
    page: candidate.page as InternalPage,
    selectedStudyId:
      typeof candidate.selectedStudyId === "string"
        ? candidate.selectedStudyId
        : null,
    detailReturnPage: candidate.detailReturnPage as InternalPage,
  };
}

function handleTabKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  currentIndex: number,
  tabCount: number,
  onSelect: (index: number) => void,
) {
  if (tabCount === 0) return;

  let nextIndex: number;
  switch (event.key) {
    case "ArrowRight":
      nextIndex = (currentIndex + 1) % tabCount;
      break;
    case "ArrowLeft":
      nextIndex = (currentIndex - 1 + tabCount) % tabCount;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabCount - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  onSelect(nextIndex);
  event.currentTarget
    .closest('[role="tablist"]')
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [nextIndex]?.focus();
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const cityLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedCountryIdRef = useRef("504");
  const initialHistoryEntry = readAppHistoryEntry(
    typeof window === "undefined" ? null : window.history.state,
  );
  const [page, setPage] = useState<Page>(initialHistoryEntry?.page ?? "home");
  const [activeTab, setActiveTab] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Fez"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriesRetry, setCategoriesRetry] = useState(0);

  // Real datasets hooks
  const { data: stats } = useAsync(getDatasetStats);
  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
  } = useAsync(getPollutantsByCategory, [categoriesRetry]);
  const { data: allAreasData } = useAsync(getAllAreas);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);

  const [selectedCountryId, setSelectedCountryId] = useState("504");
  const [selectedCountryName, setSelectedCountryName] = useState("Morocco");
  const [choroplethMode, setChoroplethMode] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(
    initialHistoryEntry?.selectedStudyId ?? null,
  );
  const [selectedMapStudy, setSelectedMapStudy] = useState<Study | null>(null);
  const detailReturnPageRef = useRef<Page>(
    initialHistoryEntry?.detailReturnPage ?? "map",
  );
  const [mapZoom, setMapZoom] = useState(MAP_CONFIG.view.zoom);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const choroplethModeRef = useRef(choroplethMode);

  useEffect(() => {
    if (!readAppHistoryEntry(window.history.state)) {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.replaceState(
        {
          ...currentState,
          [APP_HISTORY_KEY]: {
            page,
            selectedStudyId,
            detailReturnPage: detailReturnPageRef.current as InternalPage,
          },
        },
        "",
        window.location.href,
      );
    }

    const restorePageFromHistory = (event: PopStateEvent) => {
      const entry = readAppHistoryEntry(event.state);
      if (!entry) return;
      setPage(entry.page);
      setSelectedStudyId(
        entry.page === "details" ? entry.selectedStudyId : null,
      );
      detailReturnPageRef.current = entry.detailReturnPage;
    };

    window.addEventListener("popstate", restorePageFromHistory);
    return () => window.removeEventListener("popstate", restorePageFromHistory);
  }, []);

  const pushInternalPage = (
    nextPage: InternalPage,
    nextStudyId: string | null = null,
  ) => {
    const currentState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    const entry: AppHistoryEntry = {
      page: nextPage,
      selectedStudyId: nextPage === "details" ? nextStudyId : null,
      detailReturnPage: detailReturnPageRef.current as InternalPage,
    };
    window.history.pushState(
      { ...currentState, [APP_HISTORY_KEY]: entry },
      "",
      window.location.href,
    );
    setPage(nextPage);
    setSelectedStudyId(entry.selectedStudyId);
  };

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

        return {
          label,
          category: datasetCategory,
          items: [...items, ...extraOrganicItems],
        };
      })
      .filter((tab) => tab.items.length > 0);

    return [
      {
        label: "Observations",
        source: "static",
        subTabs: partSubTabs,
        keys: partSubTabs.flatMap((tab) => tab.items.map((item) => item.key)),
      },
      {
        label: "Campaigns",
        source: "static",
        unit: "",
        items: [],
        keys: [],
      },
    ];
  }, [categoriesData]);

  const TABS = STATIC_RESEARCH_TABS;

  // Handle active tab pollutant filtering
  const [selectedPollutants, setSelectedPollutants] = useState<Set<string>>(
    new Set(),
  );
  const [hasUserChangedPollutants, setHasUserChangedPollutants] =
    useState(false);
  const [activeSubTab, setActiveSubTab] = useState(-1);
  const [selectedMapCategory, setSelectedMapCategory] = useState<string | null>(
    null,
  );

  // Initialize selected pollutants when tab changes
  useEffect(() => {
    if (TABS.length > 0 && TABS[activeTab]) {
      setSelectedPollutants(new Set(TABS[activeTab].keys));
    }
  }, [activeTab, TABS]);

  const selectResearchTab = (index: number) => {
    const tab = TABS[index];
    if (!tab) return;
    setActiveTab(index);
    setActiveSubTab(0);
    setSelectedPollutants(new Set(tab.keys));
    setHasUserChangedPollutants(true);
    setSelectedMapCategory(null);
  };

  const selectResearchSubTab = (index: number) => {
    const subTab = TABS[activeTab]?.subTabs?.[index];
    const items = subTab?.items ?? [];
    setActiveSubTab(index);
    setSelectedPollutants(new Set(items.map((item) => item.key)));
    setHasUserChangedPollutants(true);
    setSelectedMapCategory(subTab?.category ?? null);
  };

  const selectAllCategories = () => {
    setActiveSubTab(-1);
    setSelectedPollutants(new Set(TABS.flatMap((tab) => tab.keys)));
    setHasUserChangedPollutants(false);
    setSelectedMapCategory(null);
  };

  const activeMeasureItems =
    TABS[activeTab]?.source === "static"
      ? (TABS[activeTab].subTabs?.[activeSubTab]?.items ?? [])
      : [];

  const activeFilters = useMemo<StudyFilters>(() => {
    const f: StudyFilters = {};
    if (searchQuery) f.query = searchQuery;
    if (selectedMapCategory) f.categories = [selectedMapCategory];
    const activeTabConfig = TABS[activeTab];

    const selectedPollutantKeys = getSelectedPollutantKeysForMap(
      selectedPollutants,
      activeTabConfig.keys,
      hasUserChangedPollutants,
    );

    if (selectedPollutantKeys !== undefined) {
      f.pollutants = selectedPollutantKeys;
    }
    return f;
  }, [
    searchQuery,
    selectedPollutants,
    hasUserChangedPollutants,
    selectedMapCategory,
    activeTab,
    TABS,
  ]);

  const { data: countrySummariesData, error: countrySummariesError } = useAsync(
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
          .filter((country) => country.studyCount > 0)
          .map((c) => c.topoId)
          .filter((topoId): topoId is string => Boolean(topoId)),
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
  const isAfricaView = !selectedCountryName;
  const africaStudies = useMemo(() => {
    const studiesById = new Map<string, Study>();
    (countrySummariesData ?? []).forEach((country) => {
      country.studies.forEach((study) => studiesById.set(study.id, study));
    });
    return [...studiesById.values()];
  }, [countrySummariesData]);
  const africaCities = useMemo(() => {
    const areasByCountryAndName = new Map<string, AreaSummary>();
    (countrySummariesData ?? []).forEach((country) => {
      country.areas.forEach((area) => {
        const key = `${area.country}\u0000${area.name}`;
        const existing = areasByCountryAndName.get(key);
        if (!existing) {
          const studies = [
            ...new Map(area.studies.map((study) => [study.id, study])).values(),
          ];
          areasByCountryAndName.set(key, {
            ...area,
            studyCount: studies.length,
            studies,
          });
          return;
        }

        const studiesById = new Map(
          existing.studies.map((study) => [study.id, study]),
        );
        area.studies.forEach((study) => studiesById.set(study.id, study));
        existing.studies = [...studiesById.values()];
        existing.studyCount = existing.studies.length;
        existing.settings = [...new Set([...existing.settings, ...area.settings])];
        if (!existing.hasPreciseCoordinates && area.hasPreciseCoordinates) {
          existing.coordinates = area.coordinates;
          existing.hasPreciseCoordinates = true;
        }
      });
    });
    return [...areasByCountryAndName.values()];
  }, [countrySummariesData]);
  const africaCountrySummaries = useMemo(() => {
    const countriesByName = new Map<string, Map<string, Study>>();
    (countrySummariesData ?? []).forEach((country) => {
      const studies = countriesByName.get(country.name) ?? new Map<string, Study>();
      country.studies.forEach((study) => studies.set(study.id, study));
      countriesByName.set(country.name, studies);
    });
    return [...countriesByName.entries()]
      .map(([name, studies]) => ({
        name,
        studyCount: studies.size,
        cityCount: new Set(
          africaCities
            .filter((city) => city.country === name)
            .map((city) => city.name),
        ).size,
        studies: [...studies.values()],
      }))
      .sort(
        (a, b) =>
          b.studyCount - a.studyCount || a.name.localeCompare(b.name),
      );
  }, [africaCities, countrySummariesData]);
  const selectedCity = selectedCountry?.areas.find(
    (city) => city.name === selectedCityName,
  );
  const selectedCityStudies = useMemo(() => {
    if (!selectedCity) return [];
    const studyIds = new Set(selectedCity.studies.map((study) => study.id));
    return (selectedCountry?.studies ?? []).filter((study) =>
      studyIds.has(study.id),
    );
  }, [selectedCity, selectedCountry]);
  const countryStudyCount = selectedCountry?.studyCount ?? 0;
  const countryCities = selectedCountry?.areas ?? [];
  const countryStudies = selectedCountry?.studies ?? [];
  const sidebarStudies = isAfricaView
    ? africaStudies
    : selectedCityName
      ? selectedCityStudies
      : countryStudies;
  const sidebarStudyCount = sidebarStudies.length;
  const sidebarCities = isAfricaView ? africaCities : countryCities;
  const validCountryYears = sidebarStudies
    .flatMap((study) => [study.yearFrom, study.yearTo])
    .filter((year): year is number => year !== null && year > 0);
  const countryYearFrom =
    validCountryYears.length > 0 ? Math.min(...validCountryYears) : null;
  const countryYearTo =
    validCountryYears.length > 0 ? Math.max(...validCountryYears) : null;
  const sidebarYearRange =
    countryYearFrom !== null && countryYearTo !== null
      ? `${countryYearFrom}-${countryYearTo}`
      : "No data";
  const searchTerm = searchQuery.trim().toLowerCase();
  const matchesStudySearch = (study: Study) =>
    !searchTerm ||
    `${study.title} ${study.author} ${study.source}`.toLowerCase().includes(searchTerm);
  const visibleAfricaCountries = africaCountrySummaries.filter(
    (country) =>
      !searchTerm ||
      country.name.toLowerCase().includes(searchTerm) ||
      country.studies.some(matchesStudySearch),
  );
  const visibleCountryCities = [...countryCities]
    .filter(
      (city) =>
        !searchTerm ||
        city.name.toLowerCase().includes(searchTerm) ||
        city.studies.some((summary) =>
          countryStudies.some(
            (study) =>
              study.id === summary.id && matchesStudySearch(study),
          ),
        ),
    )
    .sort(
      (a, b) => b.studyCount - a.studyCount || a.name.localeCompare(b.name),
    );
  const visibleCityStudies = selectedCityStudies.filter(matchesStudySearch);
  const maxCountryStudyCount = Math.max(
    1,
    ...africaCountrySummaries.map((country) => country.studyCount),
  );
  const maxCityStudyCount = Math.max(
    1,
    ...countryCities.map((city) => city.studyCount),
  );
  const cityCategoryTags = (study: Study) => {
    const pollutants = categoriesData?.flatMap((group) => group.pollutants) ?? [];
    const keys = new Set(
      study.records.flatMap((record) => Object.keys(record.measurements)),
    );
    return [
      ...new Set(
        [...keys]
          .map(
            (key) =>
              pollutants.find((pollutant) => pollutant.key === key)?.category,
          )
          .filter((category): category is string => Boolean(category)),
      ),
    ];
  };
  const visibleMapCities =
    countrySummariesData
      ?.flatMap((c) => c.areas)
      .filter((area) => area.hasPreciseCoordinates) ?? [];

  const yearRange =
    stats && stats.yearFrom && stats.yearTo
      ? `${stats.yearFrom}-${stats.yearTo}`
      : "No data";
  const cityClusters = useMemo(
    () => clusterCities(visibleMapCities, mapZoom),
    [visibleMapCities, mapZoom],
  );

  const navigateToPage = (id: Page) => {
    if (id === "admin") {
      setPage(isAdminAuthenticated ? "admin" : "login");
      return;
    }
    if (id === "map" && isCardOnlyResearchTab) {
      const observationsTab = TABS[0];
      setActiveTab(0);
      setActiveSubTab(observationsTab?.subTabs?.length ? 0 : -1);
      setSelectedPollutants(new Set(observationsTab?.keys ?? []));
      setHasUserChangedPollutants(false);
      setSelectedMapCategory(null);
    }
    if (id === "login" || id === page) return;
    if (id === "contact") {
      setPage("contact");
      return;
    }
    pushInternalPage(id);
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

  const isCardOnlyResearchTab = TABS[activeTab]?.label === "Campaigns";

  const shouldRenderMap = page === "map";

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
            setSelectedMapStudy(null);
            setSelectedCityName(null);
            setSelectedCountryId(countryId);
            setSelectedCountryName(
              countryNameByTopoIdRef.current.get(countryId) ?? countryName,
            );

            const countryBounds = (layer as L.Polygon).getBounds();
            map.flyToBounds(
              countryBounds.pad(SMALL_ISLAND_IDS.has(countryId) ? 1.5 : 0.08),
              { duration: 0.7, maxZoom: MAP_CONFIG.view.maxZoom },
            );
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
  }, [page]);

  useEffect(() => {
    if (!shouldRenderMap || isCardOnlyResearchTab) return;

    const frame = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ pan: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCardOnlyResearchTab, shouldRenderMap]);

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
        setSelectedMapStudy(null);
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
        setSelectedCityName(
          cluster.cities.length === 1 ? leadCity.name : null,
        );

        // Open the city in the sidebar.
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(leadCity.name);
          return next;
        });

        // Scroll the selected city into view when the marker is not clustered.
        if (cluster.cities.length === 1) {
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

        const bounds = L.latLngBounds(
          cluster.cities.map((city) => toLatLng(city.coordinates)),
        ).pad(0.15);
        map.flyToBounds(bounds, {
          duration: 0.7,
          maxZoom: cluster.cities.length === 1 ? 9 : map.getZoom() + 1,
        });
      });

      layer.addLayer(marker);
    });
  }, [cityClusters, selectedCountryName, showClusters]);

  const focusAfrica = () => {
    const map = mapRef.current;

    if (!map) return;

    setSelectedCountryId("");
    setSelectedCountryName("");
    selectedCountryIdRef.current = "";
    setSelectedCityName(null);
    setSelectedStudyId(null);
    setSelectedMapStudy(null);
    setMapZoom(MAP_CONFIG.view.zoom);
    map.flyTo(MAP_CONFIG.view.center, MAP_CONFIG.view.zoom, {
      duration: MAP_CONFIG.animation.flyDuration,
    });
  };

  const zoomToCountry = (country: CountrySummary) => {
    const map = mapRef.current;
    if (!map || !country.topoId) return;
    const countryLayer = countryLayerRef.current
      ?.getLayers()
      .find(
        (item) =>
          normalizeCountryId(
            (item as L.Layer & { feature?: GeoJSON.Feature }).feature?.id as
              | string
              | number
              | undefined,
          ) === country.topoId,
      );
    if (!(countryLayer instanceof L.Polygon)) return;
    map.flyToBounds(countryLayer.getBounds().pad(0.08), {
      duration: 0.7,
      maxZoom: MAP_CONFIG.view.maxZoom,
    });
  };

  const zoomToCity = (city: AreaSummary) => {
    const map = mapRef.current;
    if (!map) return;
    const [longitude, latitude] = city.coordinates;
    map.flyToBounds(
      L.latLngBounds(
        [latitude - 0.35, longitude - 0.35],
        [latitude + 0.35, longitude + 0.35],
      ),
      { duration: 0.7, maxZoom: 9 },
    );
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
    detailReturnPageRef.current = page === "search" ? "search" : "map";
    pushInternalPage("details", study.id);
  };

  const openMapStudy = (study: Study) => {
    setSelectedMapStudy(study);
  };

  const closeStudyDetail = () => {
    window.history.back();
  };

  const navigateToCountry = (country: string) => {
    setSelectedMapStudy(null);
    const countrySum = countrySummariesData?.find((c) => c.name === country);
    const id = countrySum?.topoId;
    if (id) {
      setSelectedCountryId(id);
      setSelectedCountryName(country);
    }
    navigateToPage("map");
  };

  const NAV = [
    { id: "home" as Page, icon: Home, label: "Home" },
    { id: "map" as Page, icon: MapIcon, label: "Explore Map" },
    {
      id: "search" as Page,
      icon: SlidersHorizontal,
      label: "Advanced Search",
    },
    { id: "contact" as Page, icon: Mail, label: "Contact" },
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
      default:
        return [];
    }
  }, [TABS, activeTab]);

  return (
    <div
      className="flex h-dvh min-h-svh w-full flex-col overflow-hidden bg-background xl:flex-row"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* SIDEBAR: hidden on admin/login pages which have their own chrome */}
      <aside
        className={`sidebar w-56 min-w-56 shrink-0 flex-col text-white z-20 ${page === "admin" || page === "login" ? "hidden" : "hidden xl:flex"}`}
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
        <nav
          aria-label="Primary navigation"
          className="px-3 flex flex-col gap-0.5 mt-1"
        >
          <div className="text-[10px] font-semibold tracking-widest text-white/30 uppercase px-2 mb-1.5">
            Navigate
          </div>
          {NAV.map(({ id, icon: Icon, label }) => {
            const isActive =
              page === id || (id === "map" && page === "details");
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateToPage(id)}
                aria-current={isActive ? "page" : undefined}
                className={`sidebar-nav-item group relative flex min-h-11 items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150 text-left focus-visible:outline2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8AB7FF]
                  ${
                    isActive
                      ? "bg-white/12 text-white font-medium shadow-sm"
                      : "text-white/55 hover:text-white/90 hover:bg-white/7"
                  }
                `}
              >
                {isActive && <div className="sidebar-nav-pill" />}
                <Icon
                  size={15}
                  className={`shrink-0 transition-colors duration-150 ${isActive ? "text-[#6EA8FF]" : "text-white/40 group-hover:text-white/70"}`}
                />
                <span className="truncate">{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6EA8FF] shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Map controls (context panel) ── */}
        {page === "map" && !isCardOnlyResearchTab && (
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

      {page !== "admin" && page !== "login" && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-white/95 px-1 pt-1 pb-[env(safe-area-inset-bottom)] shadow-sm backdrop-blur xl:hidden"
          aria-label="Primary navigation"
        >
          {NAV.map(({ id, icon: Icon, label }) => {
            const isActive =
              page === id || (id === "map" && page === "details");
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateToPage(id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-w-0 min-h-12 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-[10px] leading-none transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── CONTENT ── */}
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          page === "admin" || page === "login"
            ? ""
            : "pb-[calc(3.5rem+env(safe-area-inset-bottom))] xl:pb-0"
        }`}
      >
        {page === "home" ? (
          <HomePage
            stats={stats}
            onGoHome={() => navigateToPage("home")}
            onExploreMap={() => navigateToPage("map")}
            onBrowseResearch={() => navigateToPage("search")}
            onAdmin={() => setPage("login")}
          />
        ) : page === "search" ||
          (page === "details" && detailReturnPageRef.current === "search") ? (
          <>
            <div
              className={`flex-1 min-w-0 min-h-0 ${
                page === "search" ? "flex" : "hidden"
              }`}
            >
              <SearchPage onOpenStudy={(id) => openStudyDetail({ id })} />
            </div>
            {page === "details" && selectedStudyId && (
              <StudyDetailPage
                studyId={selectedStudyId}
                onBack={closeStudyDetail}
                onNavigateToCountry={navigateToCountry}
              />
            )}
          </>
        ) : page === "details" && selectedStudyId ? (
          <StudyDetailPage
            studyId={selectedStudyId}
            onBack={closeStudyDetail}
            onNavigateToCountry={navigateToCountry}
          />
        ) : page === "contact" ? (
          <ContactPage onBack={() => navigateToPage("home")} />
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
                  <span className="font-semibold text-foreground">
                    @um6p.ma
                  </span>{" "}
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
                  {/* UM6P branding 
                <span className="font-semibold text-foreground">Admin:</span>{" "}
                <code>admin</code> · <code>admin123</code>
                */}
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Research category tabs and their filters */}
            <nav
              aria-label="Research categories and filters"
              className="z-10 shrink-0 border-b border-border bg-white"
            >
              <div className="flex items-center justify-between gap-2 px-2 sm:px-3">
                <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
                  <div
                    role="tablist"
                    aria-label="Research categories"
                    className="flex w-max min-w-full flex-nowrap"
                  >
                    {TABS.map((tab, i) => (
                      <button
                        key={tab.label}
                        id={`research-category-tab-${i}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === i}
                        aria-controls={
                          activeTab === i
                            ? "research-category-panel"
                            : undefined
                        }
                        tabIndex={
                          activeTab === i || (activeTab === -1 && i === 0)
                            ? 0
                            : -1
                        }
                        onClick={() => selectResearchTab(i)}
                        onKeyDown={(event) =>
                          handleTabKeyDown(
                            event,
                            i,
                            TABS.length,
                            selectResearchTab,
                          )
                        }
                        className={`relative flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium transition-colors focus-visible:z-10 focus-visible:outline2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                        ${
                          activeTab === i
                            ? "border-primary bg-primary/4 text-primary"
                            : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
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
                      </button>
                    ))}
                  </div>
                </div>
                {activeTab === 0 && (
                  <button
                    type="button"
                    aria-pressed={!hasUserChangedPollutants}
                    onClick={selectAllCategories}
                    className={`min-h-8 shrink-0 rounded border px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      hasUserChangedPollutants
                        ? "border-border bg-white text-muted-foreground hover:bg-muted/50"
                        : "border-primary bg-primary text-white"
                    }`}
                  >
                    All categories
                  </button>
                )}
              </div>

              {TABS[activeTab] && (
                <div
                  id="research-category-panel"
                  role="tabpanel"
                  aria-labelledby={`research-category-tab-${activeTab}`}
                  tabIndex={0}
                  className="border-t border-border/60 bg-[#F5F8FF] px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary sm:px-4"
                >
                  {activeTab === 0 && categoriesError ? (
                    <div
                      className="flex flex-wrap items-center gap-2 py-2 text-sm text-destructive"
                      role="alert"
                    >
                      <span>
                        Pollutant filters could not be loaded:{" "}
                        {categoriesError.message}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoriesRetry((retry) => retry + 1)}
                        className="rounded border border-destructive/30 px-2 py-1 text-xs font-medium hover:bg-destructive/5"
                      >
                        Retry
                      </button>
                    </div>
                  ) : activeTab === 0 && categoriesLoading ? (
                    <p
                      className="py-2 text-sm text-muted-foreground"
                      role="status"
                    >
                      Loading pollutant filters…
                    </p>
                  ) : activeTab === 0 &&
                    categoriesData !== null &&
                    categoriesData.length === 0 ? (
                    <p
                      className="py-2 text-sm text-muted-foreground"
                      role="status"
                    >
                      No pollutant filters were returned by the API.
                    </p>
                  ) : TABS[activeTab].source === "static" &&
                    (TABS[activeTab].subTabs?.length ?? 0) > 0 ? (
                    <>
                      <div className="min-w-0 @container">
                        <div
                          role="tablist"
                          aria-label={`${TABS[activeTab].label} subcategories`}
                          className="flex w-full flex-nowrap items-center gap-1"
                        >
                          {TABS[activeTab].subTabs?.map((subTab, idx) => (
                            <button
                              key={subTab.label}
                              id={`research-subcategory-tab-${idx}`}
                              type="button"
                              role="tab"
                              aria-selected={activeSubTab === idx}
                              aria-controls={
                                activeSubTab >= 0
                                  ? "research-subcategory-panel"
                                  : undefined
                              }
                              tabIndex={
                                activeSubTab === idx ||
                                (activeSubTab < 0 && idx === 0)
                                  ? 0
                                  : -1
                              }
                              onClick={() => selectResearchSubTab(idx)}
                              onKeyDown={(event) =>
                                handleTabKeyDown(
                                  event,
                                  idx,
                                  TABS[activeTab].subTabs?.length ?? 0,
                                  selectResearchSubTab,
                                )
                              }
                              className={`min-h-8 shrink-0 whitespace-nowrap rounded-md border px-0.5 py-1 text-[clamp(9px,1.2cqw,14px)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                activeSubTab === idx
                                  ? "border-primary bg-primary text-white shadow-sm"
                                  : "border-slate-300/70 bg-white/55 text-slate-700 hover:border-primary/25 hover:bg-white hover:text-foreground"
                              }`}
                            >
                              {subTab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        id="research-subcategory-panel"
                        role="tabpanel"
                        aria-labelledby={`research-subcategory-tab-${activeSubTab}`}
                        tabIndex={0}
                        className="mt-1.5 border-t border-border/60 pt-1.5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
                      >
                        {activeSubTab >= 0 ? (
                          <MeasureFilterControls
                            items={activeMeasureItems}
                            selectedPollutants={selectedPollutants}
                            setSelectedPollutants={setSelectedPollutants}
                            onUserChange={() =>
                              setHasUserChangedPollutants(true)
                            }
                          />
                        ) : (
                          <p className="py-2 text-sm text-muted-foreground">
                            Select a measurement category above to view its
                            filters.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground"></p>
                  )}
                </div>
              )}
            </nav>

            {/* Map + right panel */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
              {/* Map or placeholder cards */}
              <div className="map-view-canvas relative min-h-[42dvh] shrink-0 overflow-hidden bg-[#F7F9FC] xl:min-h-0 xl:flex-1 xl:shrink">
                <div
                  ref={mapContainerRef}
                  aria-hidden={isCardOnlyResearchTab}
                  className={`absolute inset-0 z-0 africa-vector-map ${
                    isCardOnlyResearchTab ? "invisible pointer-events-none" : ""
                  }`}
                />

                {isCardOnlyResearchTab ? (
                  TABS[activeTab]?.label === "Campaigns" ? (
                    <div className="relative z-10 h-full w-full bg-white">
                      <iframe
                        src="/observatories-map/index.html"
                        title="African Observatories Map"
                        className="h-full w-full border-0"
                      />
                    </div>
                  ) : (
                    <div className="h-full overflow-auto p-5">
                      <div className="mx-auto max-w-3xl">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              {TABS[activeTab]?.label}
                            </div>
                            <h3 className="mt-1 text-xl font-semibold text-foreground">
                              Analytical workflows
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
                  )
                ) : (
                  <>
                    {countrySummariesError && (
                      <div
                        className="absolute left-4 right-4 top-16 z-20 rounded-lg border border-destructive/30 bg-white/95 p-3 text-sm text-destructive shadow-sm"
                        role="alert"
                      >
                        Map data could not be loaded:{" "}
                        {countrySummariesError.message}
                      </div>
                    )}

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
                            <span className="text-foreground/70">
                              No Studies
                            </span>
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
                <div className="map-selection-panel">
                  <div className="map-selection-header">
                    <div className="map-selection-overline">
                      <span className="map-selection-indicator" />
                      <span>
                        {selectedMapStudy
                          ? "Study record"
                          : selectedCityName
                            ? "City research"
                            : isAfricaView
                              ? "Continental overview"
                              : "Country coverage"}
                      </span>
                      <span className="map-selection-context">
                        {selectedMapStudy
                          ? "FIELD METHODS"
                          : selectedCityName
                            ? "CITY LEVEL"
                            : isAfricaView
                              ? "AFRICA"
                              : "COUNTRY LEVEL"}
                      </span>
                    </div>
                    <h2 className="map-selection-title">
                      {selectedMapStudy
                        ? "Study details"
                        : selectedCityName
                          ? selectedCityName
                          : isAfricaView
                            ? "Air research across Africa"
                            : selectedCountryName || "Country research"}
                    </h2>
                    <p className="map-selection-subtitle">
                      {selectedMapStudy
                        ? "Publication, sampling context and measured pollutants."
                        : selectedCityName
                          ? `${selectedCountryName} · studies recorded in this city`
                          : isAfricaView
                            ? "Explore field studies by country, then follow the evidence to a city or study."
                            : "Study coverage and mapped research locations in this country."}
                    </p>
                    <nav
                      aria-label="Map navigation"
                      className="map-selection-breadcrumb"
                    >
                      <button
                        type="button"
                        onClick={focusAfrica}
                        aria-current={isAfricaView ? "page" : undefined}
                        className={isAfricaView ? "is-current" : ""}
                      >
                        Africa
                      </button>
                      {selectedCountryName && (
                        <>
                          <ChevronRight size={13} aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCityName(null);
                              setSelectedMapStudy(null);
                              if (selectedCountry) zoomToCountry(selectedCountry);
                            }}
                            aria-current={
                              !isAfricaView && !selectedCityName && !selectedMapStudy
                                ? "page"
                                : undefined
                            }
                            className={
                              !isAfricaView && !selectedCityName && !selectedMapStudy
                                ? "is-current"
                                : ""
                            }
                          >
                            {selectedCountryName}
                          </button>
                        </>
                      )}
                      {selectedCityName && (
                        <>
                          <ChevronRight size={13} aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMapStudy(null);
                              if (selectedCity) zoomToCity(selectedCity);
                            }}
                            aria-current={!selectedMapStudy ? "page" : undefined}
                            className={!selectedMapStudy ? "is-current" : ""}
                          >
                            {selectedCityName}
                          </button>
                        </>
                      )}
                      {selectedMapStudy && (
                        <>
                          <ChevronRight size={13} aria-hidden="true" />
                          <span aria-current="page" className="is-current">
                            Study
                          </span>
                        </>
                      )}
                    </nav>
                    {!isAfricaView && (
                      <div className="map-selection-backline">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMapStudy) {
                              setSelectedMapStudy(null);
                            } else {
                              focusAfrica();
                            }
                          }}
                        >
                          <ArrowLeft size={14} aria-hidden="true" />
                          {selectedMapStudy
                            ? `Back to ${selectedCityName || "city"}`
                            : "Back to Africa"}
                        </button>
                        <span>
                          {selectedMapStudy ? "RECORD DETAIL" : "GEOGRAPHIC VIEW"}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedMapStudy ? (
                    <div className="map-selection-scroll map-study-detail">
                      <section className="map-study-publication">
                        <div className="map-section-label">Selected publication</div>
                        <h3>
                          {selectedMapStudy.title ||
                            selectedMapStudy.source ||
                            "Untitled study"}
                        </h3>
                        <p className="map-study-author">
                          {selectedMapStudy.author || "Author not specified"}
                        </p>
                        <p className="map-study-citation">
                          {selectedMapStudy.source || selectedMapStudy.journal}
                          {selectedMapStudy.publicationYear
                            ? ` · Published ${selectedMapStudy.publicationYear}`
                            : ""}
                        </p>
                        {selectedMapStudy.identifier && (
                          <a
                            href={selectedMapStudy.identifier}
                            target="_blank"
                            rel="noreferrer"
                            className="map-publication-link"
                          >
                            View publication
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        )}
                      </section>

                      <section className="map-study-record-section">
                        <div className="map-study-section-heading">
                          <div>
                            <span className="map-section-label">Study record</span>
                            <h3>Methods &amp; measurements</h3>
                          </div>
                          <span className="map-study-record-count">
                            {selectedMapStudy.records.length}{" "}
                            {selectedMapStudy.records.length === 1
                              ? "record"
                              : "records"}
                          </span>
                        </div>
                        <div className="map-study-records">
                          {selectedMapStudy.records.map((record, index) => {
                            const measurementKeys = Object.keys(
                              record.measurements,
                            );
                            return (
                              <article
                                key={`${record.studyArea}-${record.samplingPeriod}-${index}`}
                                className="map-method-card"
                              >
                                <div className="map-method-card-head">
                                  <div>
                                    <span className="map-section-label">
                                      Methodology {index + 1}
                                    </span>
                                    <h4>
                                      {record.studyArea || "Study location"}
                                    </h4>
                                  </div>
                                  <span className="map-method-index">
                                    {index + 1} / {selectedMapStudy.records.length}
                                  </span>
                                </div>
                                <dl className="map-study-facts">
                                  <div>
                                    <dt>Location</dt>
                                    <dd>
                                      {[record.studyArea, selectedMapStudy.country]
                                        .filter(Boolean)
                                        .join(", ") || "Not specified"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Sampling period</dt>
                                    <dd>{record.samplingPeriod || "Not specified"}</dd>
                                  </div>
                                  {(selectedMapStudy.yearFrom ||
                                    selectedMapStudy.yearTo) && (
                                    <div>
                                      <dt>Study years</dt>
                                      <dd>
                                        {selectedMapStudy.yearFrom ?? "—"}
                                        {selectedMapStudy.yearTo &&
                                        selectedMapStudy.yearTo !==
                                          selectedMapStudy.yearFrom
                                          ? `–${selectedMapStudy.yearTo}`
                                          : ""}
                                      </dd>
                                    </div>
                                  )}
                                </dl>
                                {record.methodology && (
                                  <div className="map-method-description">
                                    <span className="map-section-label">
                                      Method
                                    </span>
                                    <p>{record.methodology}</p>
                                  </div>
                                )}
                                {record.description && (
                                  <p className="map-study-description">
                                    {record.description}
                                  </p>
                                )}
                                {measurementKeys.length > 0 && (
                                  <div className="map-measurements">
                                    <span className="map-section-label">
                                      Measured pollutants
                                    </span>
                                    <div className="map-pollutant-tags">
                                      {measurementKeys.map((key) => {
                                        const item = categoriesData
                                          ?.flatMap((group) => group.pollutants)
                                          .find(
                                            (pollutant) => pollutant.key === key,
                                          );
                                        return (
                                          <span key={key}>
                                            <Chem name={item?.name ?? key} />
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <>
                      <div
                        className="map-selection-stats"
                        aria-label="Coverage summary"
                      >
                        {[
                          {
                            val: isFiltering
                              ? isAfricaView
                                ? String(sidebarStudyCount)
                                : `${sidebarStudyCount}/${selectedCountry?.totalStudyCount ?? selectedCountry?.studyCount ?? 0}`
                              : String(sidebarStudyCount),
                            label:
                              sidebarStudyCount === 1 ? "Study" : "Studies",
                          },
                          {
                            val: String(
                              isAfricaView
                                ? visibleAfricaCountries.length
                                : selectedCityName
                                  ? selectedCityStudies.reduce(
                                      (total, study) =>
                                        total + study.records.length,
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
                          { val: sidebarYearRange, label: "Study years" },
                        ].map((stat) => (
                          <div key={stat.label} className="map-selection-stat">
                            <span>{stat.val}</span>
                            <small>{stat.label}</small>
                          </div>
                        ))}
                      </div>

                      {searchQuery && (
                        <div className="map-search-status" role="status">
                          Results refined by{" "}
                          <strong>
                            “
                            {searchQuery.length > 22
                              ? `${searchQuery.slice(0, 22)}…`
                              : searchQuery}
                            ”
                          </strong>
                        </div>
                      )}

                      <div className="map-selection-search">
                        <div className="map-search-field">
                          <Search
                            size={15}
                            aria-hidden="true"
                            className={searchQuery ? "is-active" : ""}
                          />
                          <input
                            type="search"
                            placeholder="Search places, titles, authors…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search places, studies, or authors"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              aria-label="Clear search"
                            >
                              <X size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="map-selection-list-heading">
                        <span>
                          {isAfricaView
                            ? "Country coverage"
                            : selectedCityName
                              ? "Studies in this city"
                              : "Cities in this country"}
                        </span>
                        <span>
                          {isAfricaView
                            ? `${visibleAfricaCountries.length} results`
                            : selectedCityName
                              ? `${visibleCityStudies.length} results`
                              : `${visibleCountryCities.length} results`}
                        </span>
                      </div>

                      <div className="map-selection-scroll map-selection-list">
                        {isAfricaView && (
                          <div className="map-selection-rows">
                            {visibleAfricaCountries.map((country) => {
                              const summary = countrySummariesData?.find(
                                (item) => item.name === country.name,
                              );
                              const density = Math.max(
                                4,
                                (country.studyCount / maxCountryStudyCount) * 100,
                              );
                              return (
                                <button
                                  key={country.name}
                                  type="button"
                                  onClick={() => {
                                    if (!summary) return;
                                    setSelectedMapStudy(null);
                                    setSelectedCityName(null);
                                    setSelectedCountryId(summary.topoId ?? "");
                                    setSelectedCountryName(summary.name);
                                    zoomToCountry(summary);
                                  }}
                                  className="map-country-row"
                                  aria-label={`${country.name}, ${country.studyCount} ${country.studyCount === 1 ? "study" : "studies"}, ${country.cityCount} mapped ${country.cityCount === 1 ? "city" : "cities"}`}
                                >
                                  <span className="map-row-main">
                                    <span className="map-row-title">
                                      {country.name}
                                    </span>
                                    <span className="map-row-count">
                                      {country.studyCount}{" "}
                                      {country.studyCount === 1
                                        ? "study"
                                        : "studies"}
                                    </span>
                                  </span>
                                  <span className="map-row-meta">
                                    <span>
                                      {country.cityCount} mapped{" "}
                                      {country.cityCount === 1 ? "city" : "cities"}
                                    </span>
                                    <span
                                      className="map-density"
                                      aria-hidden="true"
                                    >
                                      <i style={{ width: `${density}%` }} />
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                            {visibleAfricaCountries.length === 0 && (
                              <div className="map-selection-empty">
                                <Search size={18} aria-hidden="true" />
                                <strong>No countries match</strong>
                                <p>Try another place name or clear your search.</p>
                              </div>
                            )}
                          </div>
                        )}
                        {!isAfricaView && selectedCityName && (
                          <div className="map-selection-rows">
                            {visibleCityStudies.map((study) => {
                              const tags = cityCategoryTags(study);
                              const year =
                                study.publicationYear ?? study.yearFrom;
                              return (
                                <button
                                  key={study.id}
                                  type="button"
                                  onClick={() => openMapStudy(study)}
                                  className="map-study-row"
                                >
                                  <span className="map-study-row-title">
                                    {study.title || study.source}
                                  </span>
                                  <span className="map-study-row-meta">
                                    {study.author || study.source}
                                    {year ? ` · ${year}` : ""}
                                  </span>
                                  {tags.length > 0 && (
                                    <span className="map-study-row-tags">
                                      {tags.map((tag) => (
                                        <span key={tag}>{tag}</span>
                                      ))}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                            {visibleCityStudies.length === 0 && (
                              <div className="map-selection-empty">
                                <Search size={18} aria-hidden="true" />
                                <strong>No studies match</strong>
                                <p>
                                  Try a different title, author, or clear your
                                  search.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {!isAfricaView && !selectedCityName && (
                          <>
                            {sidebarStudyCount === 0 && (
                              <div className="map-selection-empty">
                                <Info size={18} aria-hidden="true" />
                                <strong>
                                  {isFiltering
                                    ? "No studies match filters"
                                    : "No studies mapped yet"}
                                </strong>
                                <p>
                                  {isFiltering
                                    ? "Try clearing your filters or selecting a different country."
                                    : `${selectedCountryName} is selectable, but has no research studies in the current dataset.`}
                                </p>
                              </div>
                            )}
                            {sidebarStudyCount > 0 && (
                              <div className="map-selection-rows">
                                {visibleCountryCities.map((city, idx) => (
                                  <div
                                    key={`${city.country}-${city.name}-${idx}`}
                                    id={`city-row-${city.country}-${city.name}`}
                                    className="map-city-group"
                                  >
                                    <button
                                      type="button"
                                      className="map-city-row"
                                      onClick={() => {
                                        toggleCity(city.name);
                                        setSelectedCityName(city.name);
                                      }}
                                      aria-expanded={expanded.has(city.name)}
                                      aria-label={`${city.name}, ${city.studyCount} ${city.studyCount === 1 ? "study" : "studies"}`}
                                    >
                                      <span className="map-city-chevron">
                                        <ChevronDown
                                          size={15}
                                          aria-hidden="true"
                                        />
                                      </span>
                                      <span className="map-city-copy">
                                        <strong>{city.name}</strong>
                                        <small>
                                          {city.settings?.join(", ") ||
                                            "Study location"}
                                        </small>
                                      </span>
                                      <span className="map-city-count">
                                        {city.studyCount}{" "}
                                        {city.studyCount === 1
                                          ? "study"
                                          : "studies"}
                                      </span>
                                    </button>
                                    <div
                                      className={
                                        expanded.has(city.name)
                                          ? "map-city-expanded is-expanded"
                                          : "map-city-expanded"
                                      }
                                    >
                                      {city.studies.length === 0 ? (
                                        <div className="map-city-empty">
                                          No study details available
                                        </div>
                                      ) : (
                                        <div className="map-city-study-list">
                                          {city.studies.map((s, studyIndex) => {
                                            const pKeys = new Set(
                                              (
                                                sidebarStudies.find(
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
                                                key={`${city.name}-${s.id}-${studyIndex}`}
                                                type="button"
                                                onClick={() => {
                                                  const study =
                                                    sidebarStudies.find(
                                                      (item) =>
                                                        item.id === s.id,
                                                    );
                                                  if (study)
                                                    openMapStudy(study);
                                                }}
                                                className="map-city-study"
                                              >
                                                <strong>
                                                  {s.title || s.source}
                                                </strong>
                                                <span>{s.source}</span>
                                                {pNames.length > 0 && (
                                                  <span className="map-study-row-tags">
                                                    {pNames.map((name) => (
                                                      <span key={name}>
                                                        {name}
                                                      </span>
                                                    ))}
                                                    {pKeys.size > 3 && (
                                                      <span>
                                                        +{pKeys.size - 3}
                                                      </span>
                                                    )}
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {visibleCountryCities.length === 0 && (
                                  <div className="map-selection-empty">
                                    <Search size={18} aria-hidden="true" />
                                    <strong>No cities match</strong>
                                    <p>
                                      Try another place name or clear your
                                      search.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
