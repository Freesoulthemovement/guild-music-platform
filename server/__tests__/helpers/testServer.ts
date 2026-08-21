import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

/**
 * Boots the real route stack against a real database on an ephemeral port.
 *
 * NODE_ENV is production so the demo seed does not run and the session cookie
 * is configured exactly as it will be in production — the configuration worth
 * testing. Requests therefore carry X-Forwarded-Proto, the same way a host's
 * TLS terminator does.
 */
export type TestServer = { base: string; close: () => Promise<void> };

export async function startTestServer(): Promise<TestServer> {
  const { registerRoutes } = await import("../../routes");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: false }));

  const httpServer: Server = createServer(app);
  await registerRoutes(httpServer, app);

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const { port } = httpServer.address() as AddressInfo;

  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
  };
}

/** Wipes every table the tests touch, so each run starts from a known state. */
export async function resetDatabase() {
  const { pool } = await import("../../db");
  await pool.query(`
    TRUNCATE TABLE
      auth_tokens, user_credentials, user_sessions,
      license_unlocks, playlist_tracks, playlists,
      contribution_negotiations, coproducers, royalty_splits,
      offerings, investments, submissions, files,
      votes, cypher_passes, donations, events,
      messages, follows, projects, users
    RESTART IDENTITY CASCADE
  `);
}

export async function closePool() {
  const { pool } = await import("../../db");
  await pool.end();
}

type Res = { status: number; body: any; headers: Headers; setCookie?: string };

/** Minimal client that keeps a session cookie and never follows redirects. */
export function client(base: string) {
  let cookie: string | undefined;

  async function call(
    method: string,
    path: string,
    body?: unknown,
    opts: { anonymous?: boolean; cookie?: string } = {},
  ): Promise<Res> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Forwarded-Proto": "https",
    };
    const jar = opts.cookie ?? (opts.anonymous ? undefined : cookie);
    if (jar) headers["Cookie"] = jar;

    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie") ?? undefined;
    if (setCookie && !opts.anonymous && !opts.cookie) cookie = setCookie.split(";")[0];

    const text = await res.text();
    let parsed: any = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* redirect bodies */ }
    return { status: res.status, body: parsed, headers: res.headers, setCookie };
  }

  return {
    get: (p: string, o?: any) => call("GET", p, undefined, o),
    post: (p: string, b?: unknown, o?: any) => call("POST", p, b, o),
    patch: (p: string, b?: unknown, o?: any) => call("PATCH", p, b, o),
    del: (p: string, o?: any) => call("DELETE", p, undefined, o),
    getCookie: () => cookie,
    setCookie: (v?: string) => { cookie = v; },
  };
}

/** Registers a member and returns their session cookie and user record. */
export async function register(
  base: string,
  email: string,
  username: string,
  password = "a-good-password-1",
) {
  const c = client(base);
  const res = await c.post("/api/auth/register", { email, password, username });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client: c, user: res.body, cookie: c.getCookie()! };
}

/** Marks a member subscribed, standing in for a completed Stripe checkout. */
export async function makeSubscribed(userId: number) {
  const { pool } = await import("../../db");
  await pool.query("UPDATE users SET is_subscribed = true WHERE id = $1", [userId]);
}
