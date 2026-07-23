import "dotenv/config";
import { createApp } from "../server/_core/app";

// Vercel filesystem routing: this catch-all handles every /api/* request
// except the more specific api/cron/daily-refresh.ts (specific routes win
// over catch-alls). Express does its own routing internally on req.url,
// so /api/trpc/* and /api/oauth/callback resolve exactly as they do under
// the traditional persistent-server entrypoint (server/_core/index.ts).
export default createApp();
