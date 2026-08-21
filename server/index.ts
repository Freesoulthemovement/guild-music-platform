import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { log } from "./log";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Required for secure cookies and correct req.protocol behind a hosting proxy
// (Render, Railway, Fly, nginx). Without it Express sees plain http and will
// refuse to set a `secure` session cookie.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // The webhook endpoint is registered manually in the Stripe dashboard and
  // verified per-request with STRIPE_WEBHOOK_SECRET, so there is nothing to
  // bootstrap here. Warn early if Stripe is not configured — the app still
  // serves, but checkout, the billing portal and webhooks will return errors.
  if (!process.env.STRIPE_SECRET_KEY) {
    log("STRIPE_SECRET_KEY not set — billing endpoints will fail", "stripe");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    log("STRIPE_WEBHOOK_SECRET not set — incoming webhooks will be rejected", "stripe");
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });

  /**
   * Graceful shutdown.
   *
   * Platforms send SIGTERM and then SIGKILL a short time later. Without this
   * the process dies mid-request on every deploy, so a member's upload or
   * checkout can be cut off. Stop accepting connections, let in-flight work
   * finish, then close the database pool.
   */
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received — draining connections`, "shutdown");

    // Hard stop if a hung request would otherwise outlive the platform's grace
    // period; better a clean exit than being SIGKILLed mid-write.
    const force = setTimeout(() => {
      log("drain timed out — exiting", "shutdown");
      process.exit(1);
    }, 25_000);
    force.unref();

    httpServer.close(async () => {
      try {
        const { pool } = await import("./db");
        await pool.end();
        log("database pool closed", "shutdown");
      } catch (err: any) {
        log(`error closing pool: ${err.message}`, "shutdown");
      }
      clearTimeout(force);
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
})();

export { log };
