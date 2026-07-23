/**
 * Daily suggestion refresh cron job.
 *
 * Schedule: 6:30 AM UTC, Monday–Friday
 *   = 2:30 AM ET / 11:30 PM PT — well before US market open (9:30 AM ET).
 *   Users open the app to fresh suggestions every trading day without needing
 *   to click "Generate AI Suggestions."
 *
 * What it does:
 *   1. Finds all users who have both portfolio holdings and goals configured.
 *   2. For each user, calls Gemini with the same prompt as analyzeWithAi.
 *   3. Clears the user's previous suggestions and inserts the new ones.
 *   4. Staggers requests 2 seconds apart to stay within Gemini rate limits.
 *
 * Important: cron-generated calls do NOT count against the user's 30-call
 * daily limit. The limit is for manual "Generate" button presses only.
 *
 * Multi-instance note:
 *   If Railway scales to multiple server instances, each instance runs its
 *   own cron, causing duplicate runs. Fix: add a DB lock row or use an
 *   external scheduler (Railway Crons, Inngest, or Trigger.dev). For the
 *   current single-instance Railway deployment this is not an issue.
 */

import cron from "node-cron";
import {
  getUsersWithHoldingsAndGoals,
  getPortfolioHoldings,
  getInvestorGoals,
  clearTradeSuggestions,
  insertTradeSuggestion,
} from "./db";
import { VALID_STRATEGIES } from "@shared/strategies";

async function refreshSuggestionsForUser(userId: number): Promise<{ saved: number }> {
  const [holdings, goals] = await Promise.all([
    getPortfolioHoldings(userId),
    getInvestorGoals(userId),
  ]);

  if (!holdings.length || !goals) return { saved: 0 };

  const holdingsSummary = holdings.slice(0, 10).map((h) => ({
    ticker: h.ticker,
    shares: h.shares,
    currentPrice: h.currentPrice / 100,
    averageCost: h.averageCost / 100,
  }));

  const accountType = goals.accountType ?? "taxable";
  const accountNotes =
    accountType === "taxable"
      ? "Taxable brokerage account. Wash sale rules apply. Premiums taxed as short-term gains."
      : accountType === "roth_ira"
      ? "Roth IRA. No wash sale rules. All gains are tax-free. Conservative strategies preferred."
      : accountType === "traditional_ira"
      ? "Traditional IRA. No wash sale rules. Gains are tax-deferred. No margin/naked options allowed."
      : "401(k). Very limited options strategies. Only covered calls if the plan allows.";

  const prompt = `
You are an options income advisor. Analyze these stock holdings and suggest 3-5 income-generating options trades.

Holdings: ${JSON.stringify(holdingsSummary)}
Monthly income goal: $${goals.monthlyIncomeGoal ?? 0}
Risk tolerance: ${goals.riskTolerance ?? "balanced"}
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

  const { callGemini } = await import("./services/gemini");
  const response = await callGemini(prompt);

  let suggestions: any[] = [];
  try {
    const clean = response.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  } catch (err) {
    console.error(`[Cron] Failed to parse Gemini response for user ${userId}:`, err);
    return { saved: 0 };
  }

  const validSuggestions = suggestions.filter(
    (s: any) =>
      s.ticker != null &&
      s.strategy &&
      s.strikePrice != null &&
      s.premium != null &&
      VALID_STRATEGIES.has(s.strategy)
  );

  if (validSuggestions.length === 0) return { saved: 0 };

  await clearTradeSuggestions(userId);

  let savedCount = 0;
  for (const s of validSuggestions) {
    try {
      await insertTradeSuggestion(userId, {
        ticker: String(s.ticker).toUpperCase(),
        strategy: s.strategy,
        strikePrice: Math.round(Number(s.strikePrice) * 100),
        premium: Math.round(Number(s.premium) * 100),
        daysToExpiration: s.daysToExpiration != null ? Number(s.daysToExpiration) : 30,
        delta: String(s.delta ?? "0.30"),
        annualizedYield: String(s.annualizedYield ?? "0"),
        probabilityOfProfit: String(s.probabilityOfProfit ?? "50"),
        potentialMonthlyIncome: Math.round(Number(s.potentialMonthlyIncome) * 100),
        expirationDate: s.expirationDate ? new Date(s.expirationDate) : null,
      });
      savedCount++;
    } catch (err) {
      console.error(`[Cron] Failed to save suggestion for user ${userId}:`, err);
    }
  }

  return { saved: savedCount };
}

/**
 * Runs the full daily refresh once (all users, staggered 2s apart).
 *
 * Shared by two triggers:
 *   - startDailyCron() below (node-cron, in-process) — used by traditional
 *     persistent-server deploys (Railway, Fly, a VM).
 *   - api/cron/daily-refresh.ts — used on Vercel, where there is no
 *     persistent process to hold a node-cron schedule, so Vercel Cron
 *     hits an HTTP endpoint on the same 6:30 AM Mon–Fri schedule instead.
 */
export async function runDailySuggestionRefresh(): Promise<{ succeeded: number; failed: number }> {
  const startTime = Date.now();
  console.log("[Cron] Starting daily suggestion refresh...");

  let userIds: number[];
  try {
    userIds = await getUsersWithHoldingsAndGoals();
  } catch (err) {
    console.error("[Cron] Failed to fetch user list:", err);
    return { succeeded: 0, failed: 0 };
  }

  console.log(`[Cron] Processing ${userIds.length} user(s)`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    try {
      const { saved } = await refreshSuggestionsForUser(userId);
      console.log(`[Cron] User ${userId}: ${saved} suggestion(s) saved`);
      succeeded++;
    } catch (err) {
      console.error(`[Cron] User ${userId} failed:`, err);
      failed++;
    }

    // 2-second stagger between users to respect Gemini rate limits.
    // At this rate: 30 users = 60 seconds total — well within the cron window.
    if (i < userIds.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Cron] Done in ${elapsed}s — ${succeeded} succeeded, ${failed} failed`
  );

  return { succeeded, failed };
}

export function startDailyCron(): void {
  // 6:30 AM UTC, Monday–Friday
  cron.schedule("30 6 * * 1-5", () => {
    runDailySuggestionRefresh();
  });

  console.log("[Cron] Daily suggestion refresh scheduled (6:30 AM UTC, Mon–Fri)");
}
