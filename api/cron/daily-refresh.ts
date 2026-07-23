import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ENV } from "../../server/_core/env";
import { runDailySuggestionRefresh } from "../../server/cron";

// Triggered by Vercel Cron (see vercel.json "crons") on the same 6:30 AM
// Mon-Fri schedule the traditional node-cron scheduler uses. Vercel
// auto-attaches "Authorization: Bearer $CRON_SECRET" to its own cron
// requests when CRON_SECRET is set — reject anything else so this
// publicly-reachable endpoint can't be used to spam Gemini calls.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ENV.cronSecret || req.headers.authorization !== `Bearer ${ENV.cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = await runDailySuggestionRefresh();
  res.status(200).json(result);
}
