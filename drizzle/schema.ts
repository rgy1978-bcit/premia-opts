import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, serial, numeric, index } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const riskToleranceEnum = pgEnum("riskTolerance", ["conservative", "balanced", "aggressive"]);
export const strategyEnum = pgEnum("strategy", ["covered_call", "cash_secured_put", "bull_call_spread", "bull_put_spread"]);
export const statusEnum = pgEnum("status", ["accepted", "rejected", "under_consideration", "executed"]);
export const outcomeEnum = pgEnum("outcome", ["profit", "loss", "breakeven", "pending"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  userMode: varchar("userMode", { length: 16 }).default("pro").notNull(),
  userRole: varchar("userRole", { length: 16 }).default("investor").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const investorGoals = pgTable("investorGoals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthlyIncomeGoal: integer("monthlyIncomeGoal").notNull(),
  riskTolerance: riskToleranceEnum("riskTolerance").notNull(),
  preferredStrategies: varchar("preferredStrategies", { length: 255 }).notNull(),
  maxCapitalExposure: integer("maxCapitalExposure").notNull(),
  timeHorizon: varchar("timeHorizon", { length: 64 }).notNull(),
  accountType: varchar("accountType", { length: 32 }).default("taxable").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type InvestorGoals = typeof investorGoals.$inferSelect;
export type InsertInvestorGoals = typeof investorGoals.$inferInsert;

export const portfolioHoldings = pgTable("portfolioHoldings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  shares: numeric("shares", { precision: 10, scale: 4 }).notNull(),
  averageCost: integer("averageCost").notNull(),
  currentPrice: integer("currentPrice").notNull(),
  purchaseDate: timestamp("purchaseDate"),
  sector: varchar("sector", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PortfolioHoldings = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHoldings = typeof portfolioHoldings.$inferInsert;

export const portfolioCapital = pgTable("portfolioCapital", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  availableCash: integer("availableCash").notNull(),
  totalCapital: integer("totalCapital").notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
});

export type PortfolioCapital = typeof portfolioCapital.$inferSelect;
export type InsertPortfolioCapital = typeof portfolioCapital.$inferInsert;

export const taxHarvestOpportunities = pgTable("taxHarvestOpportunities", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  unrealizedLoss: integer("unrealizedLoss").notNull(),
  estimatedTaxSavings: integer("estimatedTaxSavings").notNull(),
  washSaleRisk: boolean("washSaleRisk").default(false),
  lastPurchaseDate: timestamp("lastPurchaseDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaxHarvestOpportunities = typeof taxHarvestOpportunities.$inferSelect;
export type InsertTaxHarvestOpportunities = typeof taxHarvestOpportunities.$inferInsert;

export const tradeSuggestions = pgTable("tradeSuggestions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  strategy: strategyEnum("strategy").notNull(),
  strikePrice: integer("strikePrice").notNull(),
  premium: integer("premium").notNull(),
  daysToExpiration: integer("daysToExpiration").notNull(),
  delta: varchar("delta", { length: 10 }).notNull(),
  annualizedYield: varchar("annualizedYield", { length: 10 }).notNull(),
  probabilityOfProfit: varchar("probabilityOfProfit", { length: 10 }).notNull(),
  potentialMonthlyIncome: integer("potentialMonthlyIncome").notNull(),
  expirationDate: timestamp("expirationDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TradeSuggestions = typeof tradeSuggestions.$inferSelect;
export type InsertTradeSuggestions = typeof tradeSuggestions.$inferInsert;

export const tradeDecisions = pgTable("tradeDecisions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tradeSuggestionId: integer("tradeSuggestionId").references(() => tradeSuggestions.id),
  ticker: varchar("ticker", { length: 10 }).notNull(),
  strategy: varchar("strategy", { length: 64 }).notNull(),
  status: statusEnum("status").notNull(),
  executionPrice: integer("executionPrice"),
  executionDate: timestamp("executionDate"),
  actualPremium: integer("actualPremium"),
  outcome: outcomeEnum("outcome").default("pending"),
  profitLoss: integer("profitLoss"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TradeDecisions = typeof tradeDecisions.$inferSelect;
export type InsertTradeDecisions = typeof tradeDecisions.$inferInsert;

export const dailyAnalytics = pgTable("dailyAnalytics", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  totalPortfolioValue: integer("totalPortfolioValue").notNull(),
  unrealizedGains: integer("unrealizedGains").notNull(),
  realizedGains: integer("realizedGains").notNull(),
  estimatedMonthlyIncome: integer("estimatedMonthlyIncome").notNull(),
  progressTowardGoal: varchar("progressTowardGoal", { length: 10 }).notNull(),
  portfolioConcentrationRisk: varchar("portfolioConcentrationRisk", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type InsertDailyAnalytics = typeof dailyAnalytics.$inferInsert;

export const portfolioGreeks = pgTable("portfolioGreeks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  delta: varchar("delta", { length: 10 }).notNull(),
  gamma: varchar("gamma", { length: 10 }).notNull(),
  theta: varchar("theta", { length: 10 }).notNull(),
  vega: varchar("vega", { length: 10 }).notNull(),
  rho: varchar("rho", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioGreeks = typeof portfolioGreeks.$inferSelect;
export type InsertPortfolioGreeks = typeof portfolioGreeks.$inferInsert;

export const aiUsage = pgTable("aiUsage", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(),
  callCount: integer("callCount").notNull().default(0),
});

export type AiUsage = typeof aiUsage.$inferSelect;
export type InsertAiUsage = typeof aiUsage.$inferInsert;

// ---------------------------------------------------------------------------
// Market data cache — reduces FMP/Polygon API calls across all users
// TTL is enforced at read time (expiresAt check). A cleanup job can prune
// stale rows periodically, but leaving them does not cause correctness issues.
// ---------------------------------------------------------------------------
export const marketDataCache = pgTable("marketDataCache", {
  cacheKey: varchar("cacheKey", { length: 128 }).primaryKey(),
  data: text("data").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
}, (table) => [
  index("marketDataCache_expiresAt_idx").on(table.expiresAt),
]);

export type MarketDataCache = typeof marketDataCache.$inferSelect;