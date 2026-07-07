import { COOKIE_NAME } from "@shared/const";
import { VALID_STRATEGIES } from "@shared/strategies";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as engine from "./portfolioEngine";
import * as marketData from "./marketData";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    getMode: protectedProcedure.query(({ ctx }) => ({
      mode: (ctx.user.userMode ?? "pro") as "pro" | "learning",
    })),
    setMode: protectedProcedure
      .input(z.object({ mode: z.enum(["pro", "learning"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserMode(ctx.user.id, input.mode);
        return { mode: input.mode };
      }),
  }),

  // Portfolio and Goals Management
  portfolio: router({
    // Get or create investor goals
    getGoals: protectedProcedure.query(async ({ ctx }) => {
      const goals = await db.getInvestorGoals(ctx.user.id);
      return goals || null;
    }),

    // Set investor goals
    setGoals: protectedProcedure
      .input(
        z.object({
          monthlyIncomeGoal: z.number().positive(),
          riskTolerance: z.enum(["conservative", "balanced", "aggressive"]),
          preferredStrategies: z.string(),
          maxCapitalExposure: z.number().positive(),
          timeHorizon: z.string(),
          accountType: z.enum(["taxable", "traditional_ira", "roth_ira", "401k"]).optional().default("taxable"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertInvestorGoals(ctx.user.id, input);
        return { success: true };
      }),

    // Get portfolio holdings
    getHoldings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPortfolioHoldings(ctx.user.id);
    }),

    // Upload portfolio holdings from CSV
    uploadHoldings: protectedProcedure
      .input(
        z.object({
          holdings: z.array(
            z.object({
              ticker: z.string(),
              shares: z.number(),
              averageCost: z.number(),
              currentPrice: z.number(),
              purchaseDate: z.string().optional(),
              sector: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        for (const holding of input.holdings) {
          await db.upsertPortfolioHolding(ctx.user.id, {
            ticker: holding.ticker,
            shares: holding.shares,
            averageCost: Math.round(holding.averageCost * 100), // Convert to cents
            currentPrice: Math.round(holding.currentPrice * 100),
            purchaseDate: holding.purchaseDate ? new Date(holding.purchaseDate) : null,
            sector: holding.sector || null,
          });
        }
        return { success: true, count: input.holdings.length };
      }),

    // Get portfolio capital
    getCapital: protectedProcedure.query(async ({ ctx }) => {
      const capital = await db.getPortfolioCapital(ctx.user.id);
      return capital || null;
    }),

    // Update portfolio capital
    updateCapital: protectedProcedure
      .input(
        z.object({
          availableCash: z.number(),
          totalCapital: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertPortfolioCapital(ctx.user.id, {
          availableCash: Math.round(input.availableCash * 100),
          totalCapital: Math.round(input.totalCapital * 100),
        });
        return { success: true };
      }),
  }),

  // Analysis and Scanning
  analysis: router({
    // Analyze portfolio
    analyzePortfolio: protectedProcedure.query(async ({ ctx }) => {
      const holdings = await db.getPortfolioHoldings(ctx.user.id);
      const analysis = engine.analyzePortfolio(holdings);
      return {
        ...analysis,
        totalValue: analysis.totalValue / 100,
        totalCost: analysis.totalCost / 100,
        unrealizedGains: analysis.unrealizedGains / 100,
      };
    }),

    // Scan for tax harvesting opportunities
    scanTaxHarvest: protectedProcedure.query(async ({ ctx }) => {
      const holdings = await db.getPortfolioHoldings(ctx.user.id);
      const opportunities = engine.identifyTaxHarvestOpportunities(holdings);

      // Save to database
      for (const opp of opportunities) {
        await db.upsertTaxHarvestOpportunity(ctx.user.id, {
          ticker: opp.ticker,
          unrealizedLoss: Math.round(opp.unrealizedLoss),
          estimatedTaxSavings: Math.round(opp.estimatedTaxSavings),
          washSaleRisk: opp.washSaleRisk,
          lastPurchaseDate: new Date(),
        });
      }

      return opportunities.map((opp) => ({
        ...opp,
        unrealizedLoss: opp.unrealizedLoss / 100,
        estimatedTaxSavings: opp.estimatedTaxSavings / 100,
        currentPrice: opp.currentPrice / 100,
        averageCost: opp.averageCost / 100,
      }));
    }),

    // Get tax harvest opportunities
    getTaxHarvest: protectedProcedure.query(async ({ ctx }) => {
      const opportunities = await db.getTaxHarvestOpportunities(ctx.user.id);
      return opportunities.map((opp) => ({
        ...opp,
        unrealizedLoss: opp.unrealizedLoss / 100,
        estimatedTaxSavings: opp.estimatedTaxSavings / 100,
      }));
    }),

    // Get portfolio Greeks
    getGreeks: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPortfolioGreeks(ctx.user.id);
    }),

    // Calculate Greeks
    calculateGreeks: protectedProcedure.query(async ({ ctx }) => {
      const holdings = await db.getPortfolioHoldings(ctx.user.id);
      const greeks = engine.calculatePortfolioGreeks(holdings);

      // Save to database
      await db.insertPortfolioGreeks(ctx.user.id, {
        date: new Date(),
        delta: greeks.delta.toString(),
        gamma: greeks.gamma.toString(),
        theta: greeks.theta.toString(),
        vega: greeks.vega.toString(),
        rho: greeks.rho.toString(),
      });

      return greeks;
    }),
  }),

  // Trade Suggestions and Decisions
  trades: router({
    // Get trade suggestions
    getSuggestions: protectedProcedure.query(async ({ ctx }) => {
      const suggestions = await db.getTradeSuggestions(ctx.user.id);
      return suggestions.map((s) => ({
        ...s,
        strikePrice: s.strikePrice / 100,
        premium: s.premium / 100,
        potentialMonthlyIncome: s.potentialMonthlyIncome / 100,
      }));
    }),

    // Create trade suggestion
    createSuggestion: protectedProcedure
      .input(
        z.object({
          ticker: z.string(),
          strategy: z.enum(["covered_call", "cash_secured_put", "bull_call_spread", "bull_put_spread"]),
          strikePrice: z.number(),
          premium: z.number(),
          daysToExpiration: z.number(),
          delta: z.string(),
          annualizedYield: z.string(),
          probabilityOfProfit: z.string(),
          potentialMonthlyIncome: z.number(),
          expirationDate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.insertTradeSuggestion(ctx.user.id, {
          ticker: input.ticker,
          strategy: input.strategy,
          strikePrice: Math.round(input.strikePrice * 100),
          premium: Math.round(input.premium * 100),
          daysToExpiration: input.daysToExpiration,
          delta: input.delta,
          annualizedYield: input.annualizedYield,
          probabilityOfProfit: input.probabilityOfProfit,
          potentialMonthlyIncome: Math.round(input.potentialMonthlyIncome * 100),
          expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
        });
        return { success: true };
      }),

    // Get trade decisions
    getDecisions: protectedProcedure.query(async ({ ctx }) => {
      const decisions = await db.getTradeDecisions(ctx.user.id);
      return decisions.map((d) => ({
        ...d,
        executionPrice: d.executionPrice ? d.executionPrice / 100 : undefined,
        actualPremium: d.actualPremium ? d.actualPremium / 100 : undefined,
        profitLoss: d.profitLoss ? d.profitLoss / 100 : undefined,
      }));
    }),

    // Update trade decision
    updateDecision: protectedProcedure
      .input(
        z.object({
          ticker: z.string(),
          strategy: z.string(),
          status: z.enum(["accepted", "rejected", "under_consideration", "executed"]),
          executionPrice: z.number().optional(),
          executionDate: z.string().optional(),
          actualPremium: z.number().optional(),
          outcome: z.enum(["profit", "loss", "breakeven", "pending"]).optional(),
          profitLoss: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertTradeDecision(ctx.user.id, {
          ticker: input.ticker,
          strategy: input.strategy,
          status: input.status,
          tradeSuggestionId: null,
          executionPrice: input.executionPrice ? Math.round(input.executionPrice * 100) : null,
          executionDate: input.executionDate ? new Date(input.executionDate) : null,
          actualPremium: input.actualPremium ? Math.round(input.actualPremium * 100) : null,
          outcome: input.outcome || null,
          profitLoss: input.profitLoss ? Math.round(input.profitLoss * 100) : null,
          notes: input.notes || null,
        });
        return { success: true };
      }),
      createDecision: protectedProcedure
      .input(
        z.object({
          tradeSuggestionId: z.number(),
          ticker: z.string(),
          strategy: z.string(),
          status: z.enum(["accepted", "rejected", "under_consideration", "executed"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertTradeDecision(ctx.user.id, {
          ticker: input.ticker,
          strategy: input.strategy,
          status: input.status,
          tradeSuggestionId: input.tradeSuggestionId,
          executionPrice: null,
          executionDate: null,
          actualPremium: null,
          outcome: null,
          profitLoss: null,
          notes: null,
        });
        return { success: true };
      }),
    }),

  // Market Data & Live Pricing
  market: router({
    // Get live stock quote
    getQuote: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const quote = await marketData.getStockQuote(input.symbol);
        return quote || null;
      }),

    // Get multiple stock quotes
    getQuotes: publicProcedure
      .input(z.object({ symbols: z.array(z.string()) }))
      .query(async ({ input }) => {
        return await marketData.getMultipleQuotes(input.symbols);
      }),

    // Get options chain for a symbol
    getOptionsChain: publicProcedure
      .input(z.object({ symbol: z.string(), expirationDate: z.string().optional() }))
      .query(async ({ input }) => {
        const chain = await marketData.getOptionsChain(input.symbol, input.expirationDate);
        return chain || null;
      }),

    // Get implied volatility
    getImpliedVolatility: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        const iv = await marketData.getImpliedVolatility(input.symbol);
        return iv || 0;
      }),

    // Get available options expiration dates (FMP)
    getExpirationDates: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        return await marketData.getExpirationDates(input.symbol);
      }),
  }),

  // Broker Connections
  broker: router({
    // Get connected brokers for user
    getConnected: protectedProcedure.query(async ({ ctx }) => {
      // TODO: Implement broker connection retrieval from database
      return [];
    }),

    // Connect a broker account
    connect: protectedProcedure
      .input(
        z.object({
          brokerType: z.enum(["alpaca", "td-ameritrade", "interactive-brokers", "fidelity"]),
          authCode: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement OAuth flow for broker connection
        return { success: true, message: "Broker connection initiated" };
      }),

    // Disconnect a broker account
    disconnect: protectedProcedure
      .input(z.object({ brokerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement broker disconnection
        return { success: true };
      }),

    // Sync portfolio from connected broker
    syncPortfolio: protectedProcedure
      .input(z.object({ brokerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement portfolio sync from broker
        return { success: true, holdingsUpdated: 0 };
      }),
  }),

  // Analytics and Reporting
  analytics: router({
    // Get daily analytics
    getDailyAnalytics: protectedProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const analytics = await db.getDailyAnalytics(ctx.user.id, input.days);
        return analytics.map((a) => ({
          ...a,
          totalPortfolioValue: a.totalPortfolioValue / 100,
          unrealizedGains: a.unrealizedGains / 100,
          realizedGains: a.realizedGains / 100,
          estimatedMonthlyIncome: a.estimatedMonthlyIncome / 100,
        }));
      }),

    // Record daily analytics
    recordDaily: protectedProcedure
      .input(
        z.object({
          totalPortfolioValue: z.number(),
          unrealizedGains: z.number(),
          realizedGains: z.number(),
          estimatedMonthlyIncome: z.number(),
          progressTowardGoal: z.string(),
          portfolioConcentrationRisk: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.insertDailyAnalytics(ctx.user.id, {
          date: new Date(),
          totalPortfolioValue: Math.round(input.totalPortfolioValue * 100),
          unrealizedGains: Math.round(input.unrealizedGains * 100),
          realizedGains: Math.round(input.realizedGains * 100),
          estimatedMonthlyIncome: Math.round(input.estimatedMonthlyIncome * 100),
          progressTowardGoal: input.progressTowardGoal,
          portfolioConcentrationRisk: input.portfolioConcentrationRisk || null,
        });
        return { success: true };
      }),
}),

  // Discover Router — AI-personalized stock picks for options income
  discover: router({
    getAiPicks: protectedProcedure.mutation(async ({ ctx }) => {
      const usage = await db.checkAndIncrementAiUsage(ctx.user.id, 30);
      if (!usage.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily AI limit reached (${usage.limit} calls/day). Resets at midnight.`,
        });
      }

      const { callGemini } = await import("./services/gemini");
      const holdings = await db.getPortfolioHoldings(ctx.user.id);
      const goals = await db.getInvestorGoals(ctx.user.id);

      const existingTickers = holdings.map((h) => h.ticker).join(", ") || "none";

      const prompt = `
You are an options income advisor. Suggest 6 stocks or ETFs ideal for options income strategies.

User's existing holdings (avoid recommending these): ${existingTickers}
User's risk tolerance: ${goals?.riskTolerance ?? "balanced"}
User's monthly income goal: $${goals?.monthlyIncomeGoal ?? 0}
User's preferred strategies: ${goals?.preferredStrategies ?? "any"}

Pick stocks that are great candidates for covered calls, cash-secured puts, or iron condors. Prioritize liquid, well-known names with active options markets.

Return ONLY valid JSON in this exact structure:
{
  "picks": [
    {
      "ticker": "SPY",
      "name": "SPDR S&P 500 ETF",
      "sector": "ETF",
      "priceRange": "$480–$520",
      "strategy": "iron_condor",
      "strategyLabel": "Iron Condors",
      "reason": "Most liquid options market in the world. Low correlation with individual stocks. Ideal for collecting premium in sideways markets.",
      "estimatedMonthlyYield": "1–2%",
      "riskLevel": "Medium",
      "minCapital": 500
    }
  ]
}

strategy must be one of: covered_call, cash_secured_put, iron_condor.
Return exactly 6 picks. No markdown, no explanation outside the JSON.
      `.trim();

      const response = await callGemini(prompt);
      try {
        const clean = response.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        return { ...parsed, callsUsed: usage.callCount, callsRemaining: usage.limit - usage.callCount };
      } catch {
        return { picks: [], summary: response, callsUsed: usage.callCount, callsRemaining: usage.limit - usage.callCount };
      }
    }),
  }),

  // AI Router with usage limits
  ai: router({
    checkUsage: protectedProcedure.query(async ({ ctx }) => {
      const usage = await db.getAiUsageToday(ctx.user.id);
      return { callCount: usage, limit: 30, remaining: Math.max(0, 30 - usage) };
    }),

    askPortfolioQuestion: protectedProcedure
      .input(z.object({ question: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const usage = await db.checkAndIncrementAiUsage(ctx.user.id, 30);
        if (!usage.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Daily AI limit reached (${usage.limit} calls/day). Resets at midnight.`,
          });
        }

        const { callGemini } = await import("./services/gemini");
        const holdings = await db.getPortfolioHoldings(ctx.user.id);
        const goals = await db.getInvestorGoals(ctx.user.id);

        const context = `
You are an options trading advisor for PremiaOpts.
User portfolio: ${JSON.stringify(holdings.slice(0, 10))}
User goals: ${JSON.stringify(goals)}
Answer concisely in 2-3 sentences.
        `.trim();

        const answer = await callGemini(input.question, context);
        return { answer, callsUsed: usage.callCount, callsRemaining: usage.limit - usage.callCount };
      }),

    analyzeWithAi: protectedProcedure.mutation(async ({ ctx }) => {
      const usage = await db.checkAndIncrementAiUsage(ctx.user.id, 30);
      if (!usage.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily AI limit reached (${usage.limit} calls/day). Resets at midnight.`,
        });
      }

      const { callGemini } = await import("./services/gemini");
      const holdings = await db.getPortfolioHoldings(ctx.user.id);
      const goals = await db.getInvestorGoals(ctx.user.id);

      const holdingsSummary = holdings.slice(0, 10).map(h => ({
        ticker: h.ticker,
        shares: h.shares,
        currentPrice: h.currentPrice / 100,
        averageCost: h.averageCost / 100,
      }));

      const accountType = goals?.accountType ?? "taxable";
      const accountNotes =
        accountType === "taxable"
          ? "This is a taxable brokerage account. Wash sale rules apply. Premiums are taxed as short-term gains."
          : accountType === "roth_ira"
          ? "This is a Roth IRA. No wash sale rules. All gains are tax-free. Conservative strategies preferred."
          : accountType === "traditional_ira"
          ? "This is a Traditional IRA. No wash sale rules. Gains are tax-deferred. No margin/naked options allowed."
          : "This is a 401(k). Very limited options strategies. Only covered calls if the plan allows.";


      const prompt = `
You are an options income advisor. Analyze these stock holdings and suggest 3-5 income-generating options trades.

Holdings: ${JSON.stringify(holdingsSummary)}
Monthly income goal: $${goals?.monthlyIncomeGoal ?? 0}
Risk tolerance: ${goals?.riskTolerance ?? "balanced"}
Account type: ${accountType} — ${accountNotes}

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "One paragraph summary of the strategy",
  "suggestions": [
    {
      "ticker": "AAPL",
      "strategy": "covered_call",
      "strikePrice": 195.00,
      "premium": 3.50,
      "daysToExpiration": 30,
      "delta": "0.30",
      "annualizedYield": "22.5",
      "probabilityOfProfit": "70",
      "potentialMonthlyIncome": 350.00,
      "expirationDate": "2024-02-16",
      "reasoning": "Brief explanation"
    }
  ]
}

strategy must be one of: covered_call, cash_secured_put, bull_call_spread, bull_put_spread
Only suggest covered_call for tickers the user actually holds (at least 100 shares).
Use realistic current market estimates for strikes and premiums.
      `.trim();

      const response = await callGemini(prompt);
      try {
        const clean = response.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

        // Replace any previous suggestions for this user with the fresh batch
        await db.clearTradeSuggestions(ctx.user.id);

        let savedCount = 0;
        const validStrategies = VALID_STRATEGIES;
        for (const s of suggestions) {
          if (s.ticker == null || !s.strategy || s.strikePrice == null || s.premium == null) continue;
          if (!validStrategies.has(s.strategy)) continue;
          try {
            await db.insertTradeSuggestion(ctx.user.id, {
              ticker: String(s.ticker).toUpperCase(),
              strategy: s.strategy,
              strikePrice: Math.round(Number(s.strikePrice) * 100),
              premium: Math.round(Number(s.premium) * 100),
              daysToExpiration: Number(s.daysToExpiration) || 30,
              delta: String(s.delta ?? "0.30"),
              annualizedYield: String(s.annualizedYield ?? "0"),
              probabilityOfProfit: String(s.probabilityOfProfit ?? "50"),
              potentialMonthlyIncome: Math.round(Number(s.potentialMonthlyIncome) * 100),
              expirationDate: s.expirationDate ? new Date(s.expirationDate) : null,
            });
            savedCount++;
          } catch (e) {
            console.error("Failed to save suggestion:", e);
          }
        }

        return {
          summary: parsed.summary ?? "",
          suggestions,
          savedCount: savedCount,
          callsUsed: usage.callCount,
          callsRemaining: usage.limit - usage.callCount,
        };
      } catch {
        return { summary: response, suggestions: [], savedCount: 0, callsUsed: usage.callCount, callsRemaining: usage.limit - usage.callCount };
      }
    }),
  }),
  });
  export type AppRouter = typeof appRouter;