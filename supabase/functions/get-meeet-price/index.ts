const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MEEET_CONTRACT = "EJgyptJK58M9AmJi1w8ivGBjeTm5JoTqFefoQ6JTpump";
const PUMP_FUN_URL = `https://frontend-api-v3.pump.fun/coins/${MEEET_CONTRACT}`;
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${MEEET_CONTRACT}`;
const SOL_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";
const CACHE_TTL_MS = 60_000;
const DEFAULT_SOL_USD = 130;
const BONDING_CURVE_TARGET_SOL = 85;

interface PriceData {
  priceUsd: number;
  priceSOL: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
  fetchedAt: number;
  bondingCurveProgress?: number;
  bondingCurveSol?: number;
  source?: string;
}

let cachedPrice: PriceData | null = null;

function fallback(now = Date.now(), extra: Record<string, unknown> = {}) {
  return {
    priceUsd: 0,
    priceSOL: 0,
    marketCap: 0,
    volume24h: 0,
    change24h: 0,
    liquidity: 0,
    fetchedAt: now,
    fallback: true,
    unavailable: true,
    ...extra,
  };
}

async function fetchJson<T>(url: string, ms = 1800): Promise<T | null> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "MEEET-Platform/1.0" },
      signal: ctrl.signal,
    });

    if (!res.ok) return null;
    return await res.json() as T;
  } catch (err) {
    console.warn("price upstream unavailable", url, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getSolPrice(): Promise<number> {
  const data = await fetchJson<{ solana?: { usd?: number } }>(SOL_PRICE_URL, 1200);
  const price = Number(data?.solana?.usd);
  return Number.isFinite(price) && price > 0 ? price : DEFAULT_SOL_USD;
}

async function fetchFromPumpFun(solPrice: number): Promise<PriceData | null> {
  const data = await fetchJson<Record<string, unknown>>(PUMP_FUN_URL, 1800);
  if (!data) return null;

  const virtualSolReserves = Number(data.virtual_sol_reserves || 0) / 1e9;
  const virtualTokenReserves = Number(data.virtual_token_reserves || 0) / 1e6;
  const priceSOL = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
  const priceUsd = priceSOL * solPrice;
  const marketCapRaw = Number(data.usd_market_cap || 0);
  const marketCap = marketCapRaw > 0
    ? marketCapRaw
    : Number(data.market_cap || 0) > 0
      ? Number(data.market_cap) * solPrice / 1e9
      : priceUsd * 1e9;
  const bondingCurveSol = Math.max(0, virtualSolReserves - 30);
  const bondingCurveProgress = Math.min(100, (bondingCurveSol / BONDING_CURVE_TARGET_SOL) * 100);

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    priceUsd,
    priceSOL,
    marketCap,
    volume24h: 0,
    change24h: 0,
    liquidity: 0,
    fetchedAt: Date.now(),
    bondingCurveProgress,
    bondingCurveSol,
    source: "pump.fun",
  };
}

async function fetchFromDexScreener(): Promise<PriceData | null> {
  const data = await fetchJson<{ pairs?: Array<Record<string, any>> }>(DEXSCREENER_URL, 1800);
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  const bestPair = pairs.reduce<Record<string, any> | null>((best, pair) => {
    return Number(pair?.liquidity?.usd || 0) > Number(best?.liquidity?.usd || 0) ? pair : best;
  }, null);

  const priceUsd = Number.parseFloat(String(bestPair?.priceUsd || "0"));
  if (!bestPair || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  return {
    priceUsd,
    priceSOL: Number.parseFloat(String(bestPair.priceNative || "0")) || 0,
    marketCap: Number(bestPair.marketCap || bestPair.fdv || 0),
    volume24h: Number(bestPair.volume?.h24 || 0),
    change24h: Number(bestPair.priceChange?.h24 || 0),
    liquidity: Number(bestPair.liquidity?.usd || 0),
    fetchedAt: Date.now(),
    source: "dexscreener",
  };
}

async function storePriceHistory(priceData: PriceData) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/token_price_history`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        price_usd: priceData.priceUsd,
        price_sol: priceData.priceSOL,
        market_cap: priceData.marketCap,
        volume_24h: priceData.volume24h,
        liquidity_usd: priceData.liquidity,
      }),
    });
  } catch (err) {
    console.warn("price history write skipped", err instanceof Error ? err.message : err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const now = Date.now();

  try {
    if (cachedPrice && now - cachedPrice.fetchedAt < CACHE_TTL_MS) {
      return json({ ...cachedPrice, cached: true });
    }

    const solPrice = await getSolPrice();
    let priceData = await fetchFromPumpFun(solPrice);
    if (!priceData) priceData = await fetchFromDexScreener();

    if (!priceData) {
      if (cachedPrice) return json({ ...cachedPrice, cached: true, stale: true });
      return json(fallback(now));
    }

    cachedPrice = priceData;
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (typeof edgeRuntime?.waitUntil === "function") {
      edgeRuntime.waitUntil(storePriceHistory(priceData));
    } else {
      void storePriceHistory(priceData);
    }

    return json({ ...priceData, cached: false });
  } catch (err) {
    console.error("get-meeet-price error:", err);
    if (cachedPrice) return json({ ...cachedPrice, cached: true, stale: true });
    return json(fallback(now, { error: err instanceof Error ? err.message : "Unknown error" }));
  }
});
