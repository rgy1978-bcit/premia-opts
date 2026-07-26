import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";

/**
 * Builds the Express app (tRPC + OAuth routes) without binding a port.
 * Shared by the traditional persistent-process entrypoint (server/_core/index.ts)
 * and the Vercel serverless entrypoint (api/[...path].ts) — the latter never
 * calls .listen(), Vercel invokes the app directly per-request.
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
