export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  fmpApiKey: process.env.FMP_API_KEY ?? "",
  // Polygon.io — free tier gives 15-min delayed stock quotes (no options on free tier).
  // Paid starter plan ($29/mo) unlocks real-time data + full options chains.
  // Current role: stock quote fallback (FMP → Polygon → Yahoo).
  polygonApiKey: process.env.POLYGON_API_KEY ?? "",
  // Alpaca Markets — used as third-tier stock quote fallback (FMP → Polygon → Alpaca → Yahoo).
  // Free/paper accounts: 15-min delayed data. Live brokerage accounts: real-time, no extra cost.
  // Future: Alpaca's order execution API could let users place trades directly from PremiaOpts.
  alpacaApiKey: process.env.ALPACA_API_KEY ?? "",
  alpacaApiSecret: process.env.ALPACA_API_SECRET ?? "",
  // Alpha Vantage — keys available but intentionally NOT used.
  // Alpha Vantage has no options chains, no IV, no Greeks — equity price
  // history only. FMP is the correct tool for an options income app.
  // Vercel Cron — Vercel auto-sends "Authorization: Bearer $CRON_SECRET" on
  // cron-triggered requests when this var is set; api/cron/daily-refresh.ts
  // checks it to reject calls that don't come from Vercel's scheduler.
  cronSecret: process.env.CRON_SECRET ?? "",
};
