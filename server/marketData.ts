import axios from "axios";
import { ENV } from "./_core/env";
import { cacheGet, cacheSet } from "./cache";

const FMP_BASE = "https://financialmodelingprep.com/api";

export interface OptionChain {
  symbol: string;
  calls: OptionContract[];
  puts: OptionContract[];
  lastUpdate: Date;
}

export interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  expirationDate: string;
  daysToExpiration: number;
}

export interface StockQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  marketCap: string;
  pe: number;
  dividend: number;
  lastUpdate: Date;
}

// ---------------------------------------------------------------------------
// FMP — primary data source
// ---------------------------------------------------------------------------

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = ENV.fmpApiKey;
  if (!key) return null;
  try {
    const response = await axios.get(`${FMP_BASE}${path}`, {
      params: { ...params, apikey: key },
      timeout: 6000,
    });
    return response.data as T;
  } catch (err) {
    console.error(`[FMP] ${path} failed:`, (err as any)?.message);
    return null;
  }
}

async function fmpQuote(symbol: string): Promise<StockQuote | null> {
  const data = await fmpGet<any[]>(`/v3/quote/${symbol}`);
  const q = data?.[0];
  if (!q) return null;
  return {
    symbol,
    price: q.price ?? 0,
    bid: q.price ?? 0,
    ask: q.price ?? 0,
    volume: q.volume ?? 0,
    marketCap: q.marketCap ? `$${(q.marketCap / 1e9).toFixed(1)}B` : "N/A",
    pe: q.pe ?? 0,
    dividend: 0,
    lastUpdate: new Date(),
  };
}

async function fmpOptionsChain(symbol: string, expirationDate?: string): Promise<OptionChain | null> {
  const params: Record<string, string> = {};
  if (expirationDate) params.expiration = expirationDate;

  const data = await fmpGet<any[]>(`/v4/options/${symbol}`, params);
  if (!data || data.length === 0) return null;

  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  for (const contract of data) {
    const mapped: OptionContract = {
      strike: contract.strike ?? 0,
      bid: contract.bid ?? 0,
      ask: contract.ask ?? 0,
      last: contract.last ?? contract.lastPrice ?? 0,
      volume: contract.volume ?? 0,
      openInterest: contract.openInterest ?? 0,
      impliedVolatility: contract.impliedVolatility ?? 0,
      delta: contract.delta ?? 0,
      gamma: contract.gamma ?? 0,
      theta: contract.theta ?? 0,
      vega: contract.vega ?? 0,
      rho: contract.rho ?? 0,
      expirationDate: contract.date ?? contract.expiration ?? "",
      daysToExpiration: contract.daysToExpiration ?? 0,
    };
    if (contract.type === "call" || contract.optionType === "call") {
      calls.push(mapped);
    } else {
      puts.push(mapped);
    }
  }

  return { symbol, calls, puts, lastUpdate: new Date() };
}

// ---------------------------------------------------------------------------
// Polygon.io — second-tier fallback for stock quotes only.
//
// Free tier gives 15-minute delayed US stock data via REST. No options chains
// on the free tier — that requires the paid Starter plan ($29/mo).
//
// Future upgrade path → Tradier ($10/mo):
//   Tradier offers real-time quotes + FULL options chains with exchange-sourced
//   Greeks for $10/month, cheaper than Polygon for options data. It also
//   exposes an order execution API, which would let users place trades
//   directly from PremiaOpts (a natural paid-tier feature). Tradier would
//   replace FMP as the primary data source once revenue supports it.
// ---------------------------------------------------------------------------

async function polygonQuote(symbol: string): Promise<StockQuote | null> {
  const key = ENV.polygonApiKey;
  if (!key) return null;
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`,
      { params: { apiKey: key }, timeout: 6000 }
    );
    const t = response.data?.ticker;
    if (!t) return null;
    const price = t.day?.c ?? t.lastTrade?.p ?? t.prevDay?.c ?? 0;
    return {
      symbol,
      price,
      bid: price,
      ask: price,
      volume: t.day?.v ?? 0,
      marketCap: "N/A",
      pe: 0,
      dividend: 0,
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Alpaca Markets — third-tier fallback for stock quotes.
//
// Free (paper) accounts: 15-minute delayed US stock data.
// Live brokerage accounts: real-time data automatically, no extra cost.
// No options chains on any Alpaca tier — stock quote fallback only.
//
// Auth: Basic base64(key:secret) — not a query param like FMP/Polygon.
// ---------------------------------------------------------------------------

async function alpacaQuote(symbol: string): Promise<StockQuote | null> {
  const key = ENV.alpacaApiKey;
  const secret = ENV.alpacaApiSecret;
  if (!key || !secret) return null;
  try {
    const token = Buffer.from(`${key}:${secret}`).toString("base64");
    const response = await axios.get(
      `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
      { headers: { Authorization: `Basic ${token}` }, timeout: 6000 }
    );
    const ask = response.data?.quote?.ap ?? 0;
    const bid = response.data?.quote?.bp ?? 0;
    const price = ask > 0 ? ask : bid;
    if (!price) return null;
    return {
      symbol,
      price,
      bid,
      ask,
      volume: 0,
      marketCap: "N/A",
      pe: 0,
      dividend: 0,
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — fourth-tier fallback when FMP, Polygon, and Alpaca are unavailable
// ---------------------------------------------------------------------------

async function yahooQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`,
      { params: { modules: "price,summaryDetail" }, timeout: 5000 }
    );
    const result = response.data.quoteSummary?.result?.[0];
    if (!result) return null;
    const price = result.price;
    const summary = result.summaryDetail;
    return {
      symbol,
      price: price?.regularMarketPrice?.raw ?? 0,
      bid: price?.bid?.raw ?? 0,
      ask: price?.ask?.raw ?? 0,
      volume: price?.regularMarketVolume?.raw ?? 0,
      marketCap: summary?.marketCap?.longFmt ?? "N/A",
      pe: summary?.trailingPE?.raw ?? 0,
      dividend: summary?.trailingAnnualDividendYield?.raw ?? 0,
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}

async function yahooOptionsChain(symbol: string, expirationDate?: string): Promise<OptionChain | null> {
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`,
      { params: { date: expirationDate }, timeout: 5000 }
    );
    const result = response.data.optionChain?.result?.[0];
    if (!result) return null;
    const options = result.options?.[0];
    if (!options) return null;

    const mapContract = (c: any): OptionContract => ({
      strike: c.strike,
      bid: c.bid ?? 0,
      ask: c.ask ?? 0,
      last: c.lastPrice ?? 0,
      volume: c.volume ?? 0,
      openInterest: c.openInterest ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      delta: c.greeks?.delta ?? 0,
      gamma: c.greeks?.gamma ?? 0,
      theta: c.greeks?.theta ?? 0,
      vega: c.greeks?.vega ?? 0,
      rho: c.greeks?.rho ?? 0,
      expirationDate: new Date(options.expirationDate * 1000).toISOString(),
      daysToExpiration: Math.floor((options.expirationDate * 1000 - Date.now()) / 86400000),
    });

    return {
      symbol,
      calls: (options.calls ?? []).map(mapContract),
      puts: (options.puts ?? []).map(mapContract),
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API — cached, with four-tier fallback: FMP → Polygon → Alpaca → Yahoo
//
// Cache TTLs (Supabase table — see server/cache.ts for Redis upgrade notes):
//   Stock quotes:   15 minutes  (balances freshness vs. FMP quota pressure)
//   Options chains: 30 minutes  (chains don't change tick-by-tick)
//
// During the daily cron (6:30 AM UTC), all users share the same cached
// prices so 100 users holding AAPL → 1 FMP call, not 100.
// ---------------------------------------------------------------------------

const QUOTE_TTL = 60 * 15;    // 15 minutes
const OPTIONS_TTL = 60 * 30;  // 30 minutes

export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  const key = `quote:${symbol}`;
  const cached = await cacheGet<StockQuote>(key);
  if (cached) return { ...cached, lastUpdate: new Date(cached.lastUpdate) };
  const result = (await fmpQuote(symbol)) ?? (await polygonQuote(symbol)) ?? (await alpacaQuote(symbol)) ?? (await yahooQuote(symbol));
  if (result) await cacheSet(key, result, QUOTE_TTL);
  return result;
}

export async function getOptionsChain(symbol: string, expirationDate?: string): Promise<OptionChain | null> {
  const key = `options:${symbol}:${expirationDate ?? "all"}`;
  const cached = await cacheGet<OptionChain>(key);
  if (cached) return { ...cached, lastUpdate: new Date(cached.lastUpdate) };
  const result = (await fmpOptionsChain(symbol, expirationDate)) ?? (await yahooOptionsChain(symbol, expirationDate));
  if (result) await cacheSet(key, result, OPTIONS_TTL);
  return result;
}

export async function getImpliedVolatility(symbol: string): Promise<number | null> {
  const chain = await getOptionsChain(symbol);
  if (!chain || chain.calls.length === 0) return null;
  const sum = chain.calls.reduce((acc, c) => acc + c.impliedVolatility, 0);
  return sum / chain.calls.length;
}

export async function getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];

  const normalized = symbols.map((s) => s.toUpperCase());

  // Check cache for each symbol first
  const cached = await Promise.all(normalized.map((s) => cacheGet<StockQuote>(`quote:${s}`)));
  const misses = normalized.filter((_, i) => cached[i] === null);
  const hits = cached
    .filter((q): q is StockQuote => q !== null)
    .map((q) => ({ ...q, lastUpdate: new Date(q.lastUpdate) }));

  if (misses.length === 0) return hits;

  // FMP batch endpoint for cache misses — one API call for N symbols
  let fetched: StockQuote[] = [];
  const key = ENV.fmpApiKey;
  if (key) {
    const data = await fmpGet<any[]>(`/v3/quote/${misses.join(",")}`);
    if (data && data.length > 0) {
      fetched = data.map((q: any) => ({
        symbol: q.symbol,
        price: q.price ?? 0,
        bid: q.price ?? 0,
        ask: q.price ?? 0,
        volume: q.volume ?? 0,
        marketCap: q.marketCap ? `$${(q.marketCap / 1e9).toFixed(1)}B` : "N/A",
        pe: q.pe ?? 0,
        dividend: 0,
        lastUpdate: new Date(),
      }));
    }
  }

  // Fallback: Polygon then Yahoo for any still-missing symbols
  if (fetched.length < misses.length) {
    const fetchedSymbols = new Set(fetched.map((q) => q.symbol));
    const stillMissing = misses.filter((s) => !fetchedSymbols.has(s));
    const fallback = await Promise.all(
      stillMissing.map((s) => polygonQuote(s).then((q) => q ?? alpacaQuote(s)).then((q) => q ?? yahooQuote(s)))
    );
    fetched.push(...fallback.filter((q): q is StockQuote => q !== null));
  }

  // Write fetched results to cache
  await Promise.all(fetched.map((q) => cacheSet(`quote:${q.symbol}`, q, QUOTE_TTL)));

  return [...hits, ...fetched];
}

/**
 * Get available options expiration dates for a symbol (FMP only).
 */
export async function getExpirationDates(symbol: string): Promise<string[]> {
  const data = await fmpGet<string[]>(`/v4/options/expirations/${symbol}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Black-Scholes Greeks (local fallback if API doesn't return Greeks)
// ---------------------------------------------------------------------------

export function calculateGreeks(
  stockPrice: number,
  strikePrice: number,
  timeToExpiration: number,
  riskFreeRate: number,
  volatility: number,
  optionType: "call" | "put"
) {
  const d1 =
    (Math.log(stockPrice / strikePrice) +
      (riskFreeRate + (volatility * volatility) / 2) * timeToExpiration) /
    (volatility * Math.sqrt(timeToExpiration));
  const d2 = d1 - volatility * Math.sqrt(timeToExpiration);
  const Nd1 = normalCdf(d1);
  const Nd2 = normalCdf(d2);
  const nd1 = Math.exp((-d1 * d1) / 2) / Math.sqrt(2 * Math.PI);

  if (optionType === "call") {
    return {
      delta: Nd1,
      gamma: nd1 / (stockPrice * volatility * Math.sqrt(timeToExpiration)),
      theta:
        (-stockPrice * nd1 * volatility) / (2 * Math.sqrt(timeToExpiration)) -
        riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiration) * Nd2,
      vega: stockPrice * nd1 * Math.sqrt(timeToExpiration) * 0.01,
      rho: strikePrice * timeToExpiration * Math.exp(-riskFreeRate * timeToExpiration) * Nd2 * 0.01,
    };
  } else {
    return {
      delta: Nd1 - 1,
      gamma: nd1 / (stockPrice * volatility * Math.sqrt(timeToExpiration)),
      theta:
        (-stockPrice * nd1 * volatility) / (2 * Math.sqrt(timeToExpiration)) +
        riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiration) * (1 - Nd2),
      vega: stockPrice * nd1 * Math.sqrt(timeToExpiration) * 0.01,
      rho: -strikePrice * timeToExpiration * Math.exp(-riskFreeRate * timeToExpiration) * (1 - Nd2) * 0.01,
    };
  }
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(x: number): number {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}
