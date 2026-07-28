# PremiaOpts — AI Options Income Advisor

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend | Express + tRPC + Drizzle ORM |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Google/Microsoft OAuth) |
| AI | Google Gemini (primary), local Black-Scholes fallback |
| Market Data | Financial Modeling Prep API (primary), Yahoo Finance (fallback) |
| Deploy | Vercel — `dev` branch → preview, `main` branch → production |

## Running Locally

```bash
cp .env.example .env
# Fill in .env values (see variable descriptions in .env.example)

pnpm install
pnpm dev        # starts both client (port 5173) and server (port 3000)
```

Database migrations run automatically on server start via Drizzle.

## Project Structure

```
client/src/
  pages/          # One file per route (Dashboard, Opportunities, Discover, ...)
  components/     # Shared UI + feature components
    ui/           # shadcn/ui primitives (don't edit these)
  hooks/          # useUserMode, etc.
  lib/trpc.ts     # tRPC client setup

server/
  routers.ts      # All tRPC procedures (the API)
  db.ts           # Database query functions (Drizzle)
  marketData.ts   # FMP + Yahoo Finance wrappers
  portfolioEngine.ts  # Pure calculation functions (Greeks, yield, etc.)
  services/
    gemini.ts     # Gemini AI client
  _core/
    env.ts        # All environment variables (import ENV from here)
    trpc.ts       # tRPC server setup + context

shared/           # Types shared between client and server
drizzle/          # SQL migration files
```

## Key Patterns

### Adding a new tRPC procedure

1. Add the procedure to `server/routers.ts` inside the appropriate sub-router
2. Use `protectedProcedure` for authenticated routes, `publicProcedure` for public ones
3. The client gets full type inference automatically — no codegen needed

### Rules of Hooks (critical)

All React hooks (`useState`, `useQuery`, `useMutation`, etc.) must be called **before** any conditional return. Violations cause runtime crashes when the user toggles between Pro/Learning mode.

```tsx
// ✅ Correct
export default function MyPage() {
  const { isLearning } = useUserMode();
  const query = trpc.someRoute.useQuery();   // hook before return
  if (isLearning) return <LearningView />;
  return <ProView data={query.data} />;
}

// ❌ Wrong — will crash
export default function MyPage() {
  const { isLearning } = useUserMode();
  if (isLearning) return <LearningView />;
  const query = trpc.someRoute.useQuery();   // hook after return = crash
}
```

### User Modes

Users have two modes: `"pro"` (default) and `"learning"`.

- `useUserMode()` → `{ mode, isLearning, isPro, isLoading }`
- Each page should render a simplified Learning version when `isLearning === true`
- Learning components live in `client/src/components/Learning*.tsx`

### Database values

Monetary values (prices, premiums, etc.) are stored as **integers in cents** (e.g. $185.50 → 18550). Divide by 100 before displaying, multiply by 100 before storing.

### Environment variables

Always import from `server/_core/env.ts`, never `process.env` directly:

```ts
import { ENV } from "./_core/env";
const key = ENV.fmpApiKey;
```

## Branch Strategy

- Feature work → `dev` branch (Vercel preview deployment)
- `main` branch → production (auto-deploys on push)
- Never push directly to `main` without testing on `dev` first

## AI Call Limits

Daily per-user AI call limit is **30 calls/day** (resets at midnight UTC). Enforced in `checkAndIncrementAiUsage()` in `db.ts`. Update the limit constant in both `routers.ts` usages if you change it.

## Options Strategy Reference

| Strategy | Requires stock ownership? | Direction |
|----------|--------------------------|-----------|
| Covered Call | Yes (≥100 shares) | Neutral/Bearish |
| Cash-Secured Put | No | Neutral/Bullish |
| Bull Call Spread | No | Bullish |
| Bull Put Spread | No | Neutral/Bullish |
| Iron Condor | No | Neutral (range-bound) |
