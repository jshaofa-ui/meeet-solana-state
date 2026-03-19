import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/runtime-client";
import WorldMapCanvas from "./WorldMapCanvas";
import WorldMapHUD from "./WorldMapHUD";
import WorldMapFilters from "./WorldMapFilters";

const CLASS_COLORS: Record<string, string> = {
  warrior: "#ff4444", trader: "#ffbb33", scout: "#44ff88",
  diplomat: "#4488ff", builder: "#bb66ff", hacker: "#ff66bb",
  president: "#ffdd00", oracle: "#ffcc44", miner: "#44ddff", banker: "#aa66ff",
};

const CLASS_ICONS: Record<string, string> = {
  warrior: "⚔️", trader: "💰", scout: "🔭", diplomat: "🤝",
  builder: "🏗️", hacker: "💻", president: "👑", oracle: "🔮",
  miner: "⛏️", banker: "🏦",
};

export const EVENT_TYPES = [
  { key: "conflict", label: "Conflicts", color: "#ff3333", icon: "⚔️" },
  { key: "disaster", label: "Disasters", color: "#ff8800", icon: "🌋" },
  { key: "discovery", label: "Discoveries", color: "#33aaff", icon: "🔬" },
  { key: "diplomacy", label: "Diplomacy", color: "#33ff88", icon: "🕊️" },
];

export interface Agent {
  id: string; name: string; class: string;
  lat: number | null; lng: number | null;
  reputation: number; balance_meeet: number;
  level: number; status: string; nation_code: string | null;
}

export interface WorldEvent {
  id: string; event_type: string; title: string;
  lat: number | null; lng: number | null;
  nation_codes: any; goldstein_scale: number | null; created_at: string;
}

interface WorldMapProps {
  height?: string; interactive?: boolean; showSidebar?: boolean;
  onEventClick?: (event: WorldEvent) => void;
}

// Stamen Toner for a very clean, retro-friendly base
const PIXEL_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; CARTO',
    },
  },
  layers: [{
    id: "base", type: "raster", source: "carto-dark",
    minzoom: 0, maxzoom: 20,
    paint: {
      "raster-brightness-max": 0.35,
      "raster-brightness-min": 0.02,
      "raster-contrast": 0.3,
      "raster-saturation": -0.7,
    },
  }],
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
};

const WorldMap = ({ height = "100vh", interactive = true, showSidebar = false, onEventClick }: WorldMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [classFilters, setClassFilters] = useState<Set<string>>(new Set(Object.keys(CLASS_COLORS)));
  const [eventFilters, setEventFilters] = useState<Set<string>>(new Set(EVENT_TYPES.map(e => e.key)));
  const [showAgents, setShowAgents] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; title: string; type: string; time: string }>>([]);

  const agentGeoData = useMemo(() => {
    return agents.filter(a => a.lat != null && a.lng != null && showAgents && classFilters.has(a.class)).map(a => ({
      lng: a.lng!, lat: a.lat!,
      color: CLASS_COLORS[a.class] || "#9945FF",
      rep: a.reputation ?? 0, name: a.name, cls: a.class,
    }));
  }, [agents, classFilters, showAgents]);

  const eventGeoData = useMemo(() => {
    const colors: Record<string, string> = { conflict: "#ff3333", disaster: "#ff8800", discovery: "#33aaff", diplomacy: "#33ff88" };
    return events.filter(e => e.lat != null && e.lng != null && showEvents && eventFilters.has(e.event_type)).map(e => ({
      lng: e.lng!, lat: e.lat!,
      color: colors[e.event_type] || "#ff44ff", type: e.event_type,
    }));
  }, [events, eventFilters, showEvents]);

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agents_public")
      .select("id, name, class, lat, lng, reputation, balance_meeet, level, status, nation_code")
      .not("lat", "is", null).not("lng", "is", null).limit(500);
    if (data) setAgents(data as Agent[]);
  }, []);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("world_events").select("*")
      .order("created_at", { ascending: false }).limit(50);
    if (data) setEvents(data);
  }, []);

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from("activity_feed").select("id, title, event_type, created_at")
      .order("created_at", { ascending: false }).limit(8);
    if (data) setRecentActivity(data.map(d => ({
      id: d.id, title: d.title, type: d.event_type,
      time: new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })));
  }, []);

  // Init map — very dark, minimal
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const container = mapContainer.current;

    const map = new maplibregl.Map({
      container, style: PIXEL_STYLE,
      center: [30, 20], zoom: 2.2, maxZoom: 10, minZoom: 1.5,
      interactive, pitchWithRotate: false, dragRotate: false,
    });

    requestAnimationFrame(() => map.resize());
    const delayedResize = window.setTimeout(() => { if (mapRef.current === map) map.resize(); }, 300);
    const ro = new ResizeObserver(() => { if (map && !(map as any)._removed) map.resize(); });
    ro.observe(container);

    map.on("load", () => {
      map.resize();
      setMapLoaded(true);
    });

    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");
    mapRef.current = map;

    return () => {
      clearTimeout(delayedResize); ro.disconnect(); map.remove();
      mapRef.current = null; setMapLoaded(false);
    };
  }, [interactive]);

  // Fetch data
  useEffect(() => {
    fetchAgents(); fetchEvents(); fetchActivity();
    const iv = setInterval(() => { fetchAgents(); fetchEvents(); fetchActivity(); }, 30000);
    return () => clearInterval(iv);
  }, [fetchAgents, fetchEvents, fetchActivity]);

  // Realtime
  useEffect(() => {
    let at: ReturnType<typeof setTimeout> | null = null;
    let et: ReturnType<typeof setTimeout> | null = null;
    const ch1 = supabase.channel("wm-agents")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => {
        if (at) clearTimeout(at); at = setTimeout(fetchAgents, 2000);
      }).subscribe();
    const ch2 = supabase.channel("wm-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "world_events" }, () => {
        if (et) clearTimeout(et); et = setTimeout(fetchEvents, 2000);
      }).subscribe();
    return () => {
      if (at) clearTimeout(at); if (et) clearTimeout(et);
      supabase.removeChannel(ch1); supabase.removeChannel(ch2);
    };
  }, [fetchAgents, fetchEvents]);

  const toggleClass = (cls: string) => setClassFilters(p => { const n = new Set(p); n.has(cls) ? n.delete(cls) : n.add(cls); return n; });
  const toggleEventType = (t: string) => setEventFilters(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div className="relative w-full h-full" style={{ height, minHeight: "320px" }}>
      {/* Map base — pixelated rendering */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Canvas pixel art overlay */}
      <WorldMapCanvas
        agentGeoData={agentGeoData}
        eventGeoData={eventGeoData}
        mapRef={mapRef}
      />

      {/* Atmospheric edges — darker for RPG feel */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12cc] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0a0a12cc] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0a0a12cc] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0a0a12cc] to-transparent pointer-events-none" />

      {/* HUD */}
      <WorldMapHUD
        agentCount={agents.length}
        eventCount={events.filter(e => showEvents && eventFilters.has(e.event_type)).length}
        recentActivity={recentActivity}
      />

      {/* Filters */}
      <WorldMapFilters
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        showAgents={showAgents}
        setShowAgents={setShowAgents}
        showEvents={showEvents}
        setShowEvents={setShowEvents}
        classFilters={classFilters}
        toggleClass={toggleClass}
        eventFilters={eventFilters}
        toggleEventType={toggleEventType}
        classColors={CLASS_COLORS}
      />
    </div>
  );
};

export default WorldMap;
