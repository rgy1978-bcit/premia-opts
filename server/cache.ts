/**
 * Supabase-backed market data cache.
 *
 * Why Supabase instead of Redis?
 * ─────────────────────────────────────────────────────────────────────────────
 * For the current scale (<500 users, single Railway instance) a PostgreSQL
 * table cache is the right choice:
 *   • Zero additional cost — Supabase free tier DB is already running.
 *   • A cache read (Supabase query) takes ~20–50 ms; the API call it avoids
 *     takes 200–2000 ms. That is a 10–100× latency win.
 *   • Cache data persists across server restarts and Railway deploys.
 *
 * When to switch to Redis:
 * ─────────────────────────────────────────────────────────────────────────────
 * Redis becomes worth it (≈$5–10/month extra on Railway or Upstash free tier)
 * when any of these are true:
 *   • >500 concurrent users hitting cache simultaneously — Redis reads are
 *     <1 ms (in-memory) vs Supabase's ~30 ms (network + DB query).
 *   • Multiple Railway instances (horizontal scaling) — an in-process JS Map
 *     would be inconsistent across instances; Redis is the shared source.
 *   • Sub-second freshness matters — e.g., real-time streaming quotes.
 *
 * Railway's $5/month plan does NOT bundle Redis. Redis is a separate Railway
 * plugin that starts at ~$5/month on top of your app plan. Upstash Redis has
 * a free tier (10 k commands/day) that works well for this cache volume.
 */

import { eq, and, gt } from "drizzle-orm";
import { getDb } from "./db";
import { marketDataCache } from "../drizzle/schema";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const now = new Date();
    const rows = await db
      .select({ data: marketDataCache.data })
      .from(marketDataCache)
      .where(and(eq(marketDataCache.cacheKey, key), gt(marketDataCache.expiresAt, now)))
      .limit(1);
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const serialized = JSON.stringify(data);
    await db
      .insert(marketDataCache)
      .values({ cacheKey: key, data: serialized, expiresAt })
      .onConflictDoUpdate({
        target: marketDataCache.cacheKey,
        set: { data: serialized, expiresAt, fetchedAt: new Date() },
      });
  } catch {
    // Cache write failure is non-fatal — the caller already has the data.
  }
}
