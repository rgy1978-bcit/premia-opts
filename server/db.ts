import { eq, and, lt, gte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  InsertUser,
  users,
  investorGoals,
  portfolioHoldings,
  portfolioCapital,
  taxHarvestOpportunities,
  tradeSuggestions,
  tradeDecisions,
  dailyAnalytics,
  portfolioGreeks,
  aiUsage,
  InvestorGoals,
  PortfolioHoldings,
  PortfolioCapital,
  TaxHarvestOpportunities,
  TradeSuggestions,
  TradeDecisions,
  DailyAnalytics,
  PortfolioGreeks,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

console.log("[DB] DATABASE_URL user:", process.env.DATABASE_URL?.split('@')[0]?.split(':')[1] ? "has-password" : "no-password", "host:", process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserMode(userId: number, mode: "pro" | "learning"): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user mode: database not available");
    return;
  }
  await db
    .update(users)
    .set({ userMode: mode, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// Portfolio queries

export async function getInvestorGoals(userId: number): Promise<InvestorGoals | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(investorGoals)
    .where(eq(investorGoals.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertInvestorGoals(userId: number, data: Omit<InvestorGoals, "id" | "createdAt" | "updatedAt" | "userId">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getInvestorGoals(userId);

  if (existing) {
    await db
      .update(investorGoals)
      .set(data)
      .where(eq(investorGoals.userId, userId));
  } else {
    await db.insert(investorGoals).values({
      ...data,
      userId,
    });
  }
}

export async function getPortfolioHoldings(userId: number): Promise<PortfolioHoldings[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(portfolioHoldings)
    .where(eq(portfolioHoldings.userId, userId));
}

export async function upsertPortfolioHolding(userId: number, holding: Omit<PortfolioHoldings, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(portfolioHoldings)
    .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.ticker, holding.ticker)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(portfolioHoldings)
      .set(holding)
      .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.ticker, holding.ticker)));
  } else {
    await db.insert(portfolioHoldings).values({
      ...holding,
      userId,
    });
  }
}

export async function getPortfolioCapital(userId: number): Promise<PortfolioCapital | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(portfolioCapital)
    .where(eq(portfolioCapital.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertPortfolioCapital(userId: number, data: Omit<PortfolioCapital, "id" | "userId" | "createdAt" | "lastUpdated">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getPortfolioCapital(userId);

  if (existing) {
    await db
      .update(portfolioCapital)
      .set(data)
      .where(eq(portfolioCapital.userId, userId));
  } else {
    await db.insert(portfolioCapital).values({
      ...data,
      userId,
    });
  }
}

export async function getTaxHarvestOpportunities(userId: number): Promise<TaxHarvestOpportunities[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(taxHarvestOpportunities)
    .where(eq(taxHarvestOpportunities.userId, userId))
    .orderBy(desc(taxHarvestOpportunities.estimatedTaxSavings));
}

export async function upsertTaxHarvestOpportunity(userId: number, opportunity: Omit<TaxHarvestOpportunities, "id" | "userId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(taxHarvestOpportunities)
    .where(and(eq(taxHarvestOpportunities.userId, userId), eq(taxHarvestOpportunities.ticker, opportunity.ticker)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(taxHarvestOpportunities)
      .set(opportunity)
      .where(and(eq(taxHarvestOpportunities.userId, userId), eq(taxHarvestOpportunities.ticker, opportunity.ticker)));
  } else {
    await db.insert(taxHarvestOpportunities).values({
      ...opportunity,
      userId,
    });
  }
}

export async function getTradeSuggestions(userId: number): Promise<TradeSuggestions[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeSuggestions)
    .where(eq(tradeSuggestions.userId, userId))
    .orderBy(desc(tradeSuggestions.annualizedYield));
}

export async function clearTradeSuggestions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tradeSuggestions).where(eq(tradeSuggestions.userId, userId));
}

export async function insertTradeSuggestion(userId: number, suggestion: Omit<TradeSuggestions, "id" | "userId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tradeSuggestions).values({
    ...suggestion,
    userId,
  });

  return result;
}

export async function getTradeDecisions(userId: number): Promise<TradeDecisions[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeDecisions)
    .where(eq(tradeDecisions.userId, userId))
    .orderBy(desc(tradeDecisions.createdAt));
}

export async function upsertTradeDecision(userId: number, decision: Omit<TradeDecisions, "id" | "userId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(tradeDecisions)
    .where(and(eq(tradeDecisions.userId, userId), eq(tradeDecisions.ticker, decision.ticker)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tradeDecisions)
      .set(decision)
      .where(and(eq(tradeDecisions.userId, userId), eq(tradeDecisions.ticker, decision.ticker)));
  } else {
    await db.insert(tradeDecisions).values({
      ...decision,
      userId,
    });
  }
}

export async function getDailyAnalytics(userId: number, days: number = 30): Promise<DailyAnalytics[]> {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await db
    .select()
    .from(dailyAnalytics)
    .where(and(eq(dailyAnalytics.userId, userId), gte(dailyAnalytics.date, startDate)))
    .orderBy(desc(dailyAnalytics.date));
}

export async function insertDailyAnalytics(userId: number, analytics: Omit<DailyAnalytics, "id" | "userId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(dailyAnalytics).values({
    ...analytics,
    userId,
  });
}

export async function getPortfolioGreeks(userId: number): Promise<PortfolioGreeks | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(portfolioGreeks)
    .where(eq(portfolioGreeks.userId, userId))
    .orderBy(desc(portfolioGreeks.date))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function insertPortfolioGreeks(userId: number, greeks: Omit<PortfolioGreeks, "id" | "userId" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(portfolioGreeks).values({
    ...greeks,
    userId,
  });
}
export async function checkAndIncrementAiUsage(userId: number, dailyLimit: number = 30): Promise<{ allowed: boolean; callCount: number; limit: number }> {
  const db = await getDb();
  if (!db) return { allowed: false, callCount: 0, limit: dailyLimit };

  const today = new Date().toISOString().split('T')[0];

  // Get or create today's usage record
  const existing = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, today)))
    .limit(1);

  if (existing.length === 0) {
    // First call today
    await db.insert(aiUsage).values({ userId, date: today, callCount: 1 });
    return { allowed: true, callCount: 1, limit: dailyLimit };
  }

  const current = existing[0].callCount;

  if (current >= dailyLimit) {
    return { allowed: false, callCount: current, limit: dailyLimit };
  }

  // Increment counter
  await db
    .update(aiUsage)
    .set({ callCount: current + 1 })
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, today)));

  return { allowed: true, callCount: current + 1, limit: dailyLimit };
}

/**
 * Returns all userIds who have at least one portfolio holding AND investor
 * goals configured. Used by the daily cron to know who to generate
 * suggestions for.
 */
export async function getUsersWithHoldingsAndGoals(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ userId: portfolioHoldings.userId })
    .from(portfolioHoldings)
    .innerJoin(investorGoals, eq(portfolioHoldings.userId, investorGoals.userId));
  return rows.map((r) => r.userId);
}

export async function getAiUsageToday(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const today = new Date().toISOString().split('T')[0];
  const result = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, today)))
    .limit(1);

  return result.length > 0 ? result[0].callCount : 0;
}