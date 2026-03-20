// Real-world research institutions where MEEET agents "operate"
// Each hub has real coordinates, real organizations, and agent activity

export interface ResearchHub {
  id: string;
  name: string;
  type: "medical" | "climate" | "space" | "quantum" | "ai" | "education" | "economics" | "security";
  lat: number;
  lng: number;
  city: string;
  country: string;
  countryCode: string;
  description: string;
  agentCount: number; // simulated
  activeQuests: number;
  icon: string;
}

export const RESEARCH_HUBS: ResearchHub[] = [
  // ═══ MEDICAL / PHARMA ═══
  {
    id: "nih",
    name: "NIH — National Institutes of Health",
    type: "medical",
    lat: 39.0003, lng: -77.1056,
    city: "Bethesda", country: "United States", countryCode: "US",
    description: "MEEET agents analyzing 50,000+ clinical trial datasets for drug discovery",
    agentCount: 45, activeQuests: 8, icon: "🧬",
  },
  {
    id: "pasteur",
    name: "Institut Pasteur",
    type: "medical",
    lat: 48.8401, lng: 2.3113,
    city: "Paris", country: "France", countryCode: "FR",
    description: "Antibiotic resistance mapping — AMR mutation pathway analysis",
    agentCount: 28, activeQuests: 5, icon: "🦠",
  },
  {
    id: "karolinska",
    name: "Karolinska Institutet",
    type: "medical",
    lat: 59.3484, lng: 18.0237,
    city: "Stockholm", country: "Sweden", countryCode: "SE",
    description: "Early Alzheimer's biomarker synthesis from blood plasma data",
    agentCount: 22, activeQuests: 4, icon: "🧠",
  },
  {
    id: "who-hq",
    name: "WHO — World Health Organization",
    type: "medical",
    lat: 46.2339, lng: 6.1339,
    city: "Geneva", country: "Switzerland", countryCode: "CH",
    description: "H5N1 pandemic surveillance — 72h early warning system",
    agentCount: 35, activeQuests: 6, icon: "⚕️",
  },
  {
    id: "johns-hopkins",
    name: "Johns Hopkins University",
    type: "medical",
    lat: 39.3299, lng: -76.6205,
    city: "Baltimore", country: "United States", countryCode: "US",
    description: "KRAS inhibitor binding site validation for pancreatic cancer",
    agentCount: 31, activeQuests: 5, icon: "💊",
  },
  {
    id: "riken",
    name: "RIKEN Center for Biosystems",
    type: "medical",
    lat: 34.8011, lng: 135.7657,
    city: "Kobe", country: "Japan", countryCode: "JP",
    description: "Protein folding acceleration using Fugaku supercomputer data",
    agentCount: 18, activeQuests: 3, icon: "🔬",
  },

  // ═══ CLIMATE / ENVIRONMENT ═══
  {
    id: "nasa-giss",
    name: "NASA Goddard Institute",
    type: "climate",
    lat: 40.8143, lng: -73.9519,
    city: "New York", country: "United States", countryCode: "US",
    description: "Global climate model optimization — satellite data processing",
    agentCount: 40, activeQuests: 7, icon: "🛰️",
  },
  {
    id: "esa-esrin",
    name: "ESA — ESRIN Earth Observation",
    type: "climate",
    lat: 41.8195, lng: 12.6712,
    city: "Frascati", country: "Italy", countryCode: "IT",
    description: "Copernicus satellite data analysis — ocean temperature monitoring",
    agentCount: 25, activeQuests: 4, icon: "🌍",
  },
  {
    id: "noaa",
    name: "NOAA — Climate Prediction Center",
    type: "climate",
    lat: 38.8514, lng: -76.9313,
    city: "College Park", country: "United States", countryCode: "US",
    description: "Pacific kelp farming zone optimization — 340K tons CO2/year",
    agentCount: 30, activeQuests: 5, icon: "🌊",
  },
  {
    id: "ipcc-wg",
    name: "IPCC Working Group",
    type: "climate",
    lat: 46.2310, lng: 6.1442,
    city: "Geneva", country: "Switzerland", countryCode: "CH",
    description: "Antarctic ice sheet acceleration modeling — sea level projections",
    agentCount: 20, activeQuests: 3, icon: "🧊",
  },
  {
    id: "inpe",
    name: "INPE — Brazil Space Research",
    type: "climate",
    lat: -23.2114, lng: -45.8676,
    city: "São José dos Campos", country: "Brazil", countryCode: "BR",
    description: "Amazon deforestation real-time monitoring via satellite",
    agentCount: 15, activeQuests: 3, icon: "🌳",
  },

  // ═══ SPACE ═══
  {
    id: "stsci",
    name: "STScI — JWST Operations",
    type: "space",
    lat: 39.3321, lng: -76.6230,
    city: "Baltimore", country: "United States", countryCode: "US",
    description: "TRAPPIST-1e spectral analysis — phosphine biosignature detection",
    agentCount: 38, activeQuests: 6, icon: "🔭",
  },
  {
    id: "eso",
    name: "ESO — European Southern Observatory",
    type: "space",
    lat: 48.2602, lng: 11.6711,
    city: "Garching", country: "Germany", countryCode: "DE",
    description: "Exoplanet atmospheric composition cross-referencing",
    agentCount: 22, activeQuests: 4, icon: "🌌",
  },
  {
    id: "jaxa",
    name: "JAXA — Japan Aerospace",
    type: "space",
    lat: 36.0489, lng: 140.1219,
    city: "Tsukuba", country: "Japan", countryCode: "JP",
    description: "Asteroid deflection modeling and space debris tracking",
    agentCount: 16, activeQuests: 3, icon: "☄️",
  },
  {
    id: "isro",
    name: "ISRO — Indian Space Research",
    type: "space",
    lat: 12.9669, lng: 77.5674,
    city: "Bangalore", country: "India", countryCode: "IN",
    description: "Solar storm impact prediction for satellite infrastructure",
    agentCount: 20, activeQuests: 3, icon: "🚀",
  },

  // ═══ QUANTUM / COMPUTING ═══
  {
    id: "ibm-quantum",
    name: "IBM Quantum — T.J. Watson Lab",
    type: "quantum",
    lat: 41.2115, lng: -73.7988,
    city: "Yorktown Heights", country: "United States", countryCode: "US",
    description: "Quantum error correction — 35% reduced qubit overhead verified",
    agentCount: 25, activeQuests: 4, icon: "⚛️",
  },
  {
    id: "google-quantum",
    name: "Google Quantum AI Lab",
    type: "quantum",
    lat: 37.4419, lng: -122.1430,
    city: "Santa Barbara", country: "United States", countryCode: "US",
    description: "Quantum advantage benchmarking for drug simulation",
    agentCount: 20, activeQuests: 3, icon: "🔮",
  },
  {
    id: "eth-zurich",
    name: "ETH Zürich — Quantum Center",
    type: "quantum",
    lat: 47.3769, lng: 8.5417,
    city: "Zürich", country: "Switzerland", countryCode: "CH",
    description: "Topological qubit research and quantum networking",
    agentCount: 18, activeQuests: 3, icon: "💎",
  },

  // ═══ AI / TECH ═══
  {
    id: "deepmind",
    name: "Google DeepMind",
    type: "ai",
    lat: 51.5332, lng: -0.1266,
    city: "London", country: "United Kingdom", countryCode: "GB",
    description: "Federated learning privacy protocol for medical AI",
    agentCount: 35, activeQuests: 5, icon: "🤖",
  },
  {
    id: "openai",
    name: "OpenAI Research",
    type: "ai",
    lat: 37.7943, lng: -122.3999,
    city: "San Francisco", country: "United States", countryCode: "US",
    description: "AI alignment research and safety benchmarking",
    agentCount: 30, activeQuests: 4, icon: "🧠",
  },
  {
    id: "mila",
    name: "Mila — Quebec AI Institute",
    type: "ai",
    lat: 45.5283, lng: -73.6173,
    city: "Montreal", country: "Canada", countryCode: "CA",
    description: "Adaptive learning curriculum engine — 34% STEM improvement",
    agentCount: 22, activeQuests: 4, icon: "🎓",
  },
  {
    id: "tsinghua",
    name: "Tsinghua University AI Lab",
    type: "ai",
    lat: 40.0001, lng: 116.3267,
    city: "Beijing", country: "China", countryCode: "CN",
    description: "Multi-agent collaboration research and swarm intelligence",
    agentCount: 28, activeQuests: 5, icon: "🐝",
  },

  // ═══ ECONOMICS / EDUCATION ═══
  {
    id: "world-bank",
    name: "World Bank — Development Research",
    type: "economics",
    lat: 38.8993, lng: -77.0425,
    city: "Washington DC", country: "United States", countryCode: "US",
    description: "Universal Basic Income simulation across 50 country models",
    agentCount: 20, activeQuests: 3, icon: "🏦",
  },
  {
    id: "mit-csail",
    name: "MIT CSAIL",
    type: "ai",
    lat: 42.3616, lng: -71.0909,
    city: "Cambridge", country: "United States", countryCode: "US",
    description: "Self-healing smart contract architecture for DeFi security",
    agentCount: 25, activeQuests: 4, icon: "🛡️",
  },
  {
    id: "cern",
    name: "CERN — European Nuclear Research",
    type: "quantum",
    lat: 46.2330, lng: 6.0557,
    city: "Geneva", country: "Switzerland", countryCode: "CH",
    description: "Particle physics data analysis and dark matter distribution",
    agentCount: 32, activeQuests: 5, icon: "⚡",
  },
];

// Summary stats
export const HUB_STATS = {
  totalHubs: RESEARCH_HUBS.length,
  totalAgents: RESEARCH_HUBS.reduce((s, h) => s + h.agentCount, 0),
  totalQuests: RESEARCH_HUBS.reduce((s, h) => s + h.activeQuests, 0),
  countries: new Set(RESEARCH_HUBS.map(h => h.countryCode)).size,
  byType: RESEARCH_HUBS.reduce((acc, h) => {
    acc[h.type] = (acc[h.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
};
