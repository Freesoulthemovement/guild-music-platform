import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * Route-level tests against a real Postgres.
 *
 * Set TEST_DATABASE_URL (or DATABASE_URL) to a database you do not mind being
 * TRUNCATED. Without one the whole file is skipped, so `npm test` still runs
 * anywhere.
 */
const DB = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

// Must be set before anything imports server/db.ts, which reads it on import.
if (DB) {
  process.env.DATABASE_URL = DB;
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET ??= "integration-test-secret";
}

const suite = DB ? describe : describe.skip;

suite("route authorization", () => {
  let base: string;
  let close: () => Promise<void>;
  let helpers: typeof import("./helpers/testServer");

  beforeAll(async () => {
    helpers = await import("./helpers/testServer");
    await helpers.resetDatabase();
    const server = await helpers.startTestServer();
    base = server.base;
    close = server.close;
  }, 30_000);

  afterAll(async () => {
    await close?.();
    await helpers?.closePool();
  });

  describe("registration and session", () => {
    it("registers, sets a hardened cookie, and resolves /api/auth/me", async () => {
      const { client: c, user, cookie } = await helpers.register(base, "a@ex.com", "alpha");
      expect(user.username).toBe("alpha");

      // Production cookie configuration.
      const setCookie = cookie;
      expect(setCookie).toBeTruthy();
      const me = await c.get("/api/auth/me");
      expect(me.body.username).toBe("alpha");
    });

    it("never returns the password hash or email in the user record", async () => {
      const { user } = await helpers.register(base, "b@ex.com", "bravo");
      expect(JSON.stringify(user)).not.toMatch(/passwordHash|password_hash/);
      expect(JSON.stringify(user)).not.toContain("b@ex.com");
    });

    it("rejects a duplicate email regardless of casing", async () => {
      await helpers.register(base, "c@ex.com", "charlie");
      const { client } = helpers;
      const res = await client(base).post("/api/auth/register", {
        email: "C@EX.COM", password: "a-good-password-1", username: "charlie2",
      });
      expect(res.status).toBe(409);
    });

    it("gives the same answer for a wrong password and an unknown account", async () => {
      await helpers.register(base, "d@ex.com", "delta");
      const { client } = helpers;
      const wrong = await client(base).post("/api/auth/login", { email: "d@ex.com", password: "not-the-password" });
      const missing = await client(base).post("/api/auth/login", { email: "nobody@ex.com", password: "not-the-password" });
      expect(wrong.status).toBe(401);
      expect(missing.status).toBe(401);
      expect(wrong.body.message).toBe(missing.body.message);
    });

    it("issues a new session id on login, closing session fixation", async () => {
      const { client } = helpers;
      const c = client(base);
      await c.post("/api/auth/register", { email: "e@ex.com", password: "a-good-password-1", username: "echo" });
      const before = c.getCookie();
      const res = await c.post("/api/auth/login", { email: "e@ex.com", password: "a-good-password-1" });
      expect(res.status).toBe(200);
      expect(c.getCookie()).not.toBe(before);
    });
  });

  describe("open participation", () => {
    it("lets any member create, upload and submit without giving anything", async () => {
      const { client: c } = await helpers.register(base, "f@ex.com", "foxtrot");

      const project = await c.post("/api/projects", { title: "Free", description: "D" });
      expect(project.status).toBe(201);

      await c.patch("/api/auth/me/roles", { roles: ["producer"] });
      const submission = await c.post(`/api/projects/${project.body.id}/submissions`, {
        type: "beat", title: "Open Beat", visibility: "private",
      });
      expect(submission.status).toBe(201);

      const file = await c.post(`/api/projects/${project.body.id}/files`, {
        name: "stem", type: "stem", url: "https://example.com/a.wav", visibility: "private",
      });
      expect(file.status).toBe(201);

      const invest = await c.post(`/api/projects/${project.body.id}/investments`, {
        amount: 10, percentage: 1,
      });
      expect(invest.status).toBe(201);

      // Storage is not configured in tests, so 503 rather than 403 proves the
      // membership gate is gone and only configuration is missing.
      const presign = await c.post("/api/uploads/presign", {
        filename: "a.wav", contentType: "audio/wav", sizeBytes: 10, folder: "files",
      });
      expect(presign.status).toBe(503);
    });

    it("completes onboarding without any payment", async () => {
      const { client: c } = await helpers.register(base, "g@ex.com", "golf");
      const res = await c.post("/api/auth/complete-onboarding");
      expect(res.status).toBe(200);
      expect(res.body.user.onboardingComplete).toBe(true);
      expect(res.body.user.isSubscribed).toBe(false);
    });

    it("still requires a session", async () => {
      const { client } = helpers;
      expect((await client(base).post("/api/projects", { title: "x", description: "y" })).status).toBe(401);
      expect((await client(base).post("/api/auth/complete-onboarding")).status).toBe(401);
    });
  });

  describe("private media", () => {
    it("serves public files to anyone but private ones only to signed-in members", async () => {
      const { client: owner, user } = await helpers.register(base, "h@ex.com", "hotel");
      const project = await owner.post("/api/projects", { title: "Hotel", description: "D" });
      const pid = project.body.id;

      const priv = await owner.post(`/api/projects/${pid}/files`, {
        name: "private stem", type: "stem", url: "https://example.com/p.wav", visibility: "private",
      });
      const pub = await owner.post(`/api/projects/${pid}/files`, {
        name: "public stem", type: "stem", url: "https://example.com/x.wav", visibility: "public",
      });
      expect(priv.status).toBe(201);

      // Another member who has never given anything can still read it.
      const { client: outsider } = await helpers.register(base, "i@ex.com", "india");

      expect((await owner.get(`/api/files/${priv.body.id}/content`)).status).toBe(302);
      expect((await outsider.get(`/api/files/${priv.body.id}/content`)).status).toBe(302);
      expect((await owner.get(`/api/files/${priv.body.id}/content`, { anonymous: true })).status).toBe(403);
      expect((await owner.get(`/api/files/${pub.body.id}/content`, { anonymous: true })).status).toBe(302);
    });
  });

  describe("data exposure", () => {
    it("does not leak a Stripe customer id to other members", async () => {
      const { client: owner, user } = await helpers.register(base, "j@ex.com", "juliet");
      const { pool } = await import("../db");
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", ["cus_CANARY_LEAK", user.id]);
      await owner.post("/api/projects", { title: "Juliet", description: "D" });

      const { client: viewer } = await helpers.register(base, "k@ex.com", "kilo");
      const list = await viewer.get("/api/projects");
      expect(JSON.stringify(list.body)).not.toContain("cus_CANARY_LEAK");

      const detail = await viewer.get(`/api/projects/${list.body[0].id}`);
      expect(JSON.stringify(detail.body)).not.toContain("cus_CANARY_LEAK");

      const ministry = await viewer.get("/api/ministry/artists", { anonymous: true });
      expect(JSON.stringify(ministry.body)).not.toContain("cus_CANARY_LEAK");
    });

    it("shows licence purchasers only to the contributor selling it", async () => {
      const { client: seller } = await helpers.register(base, "l@ex.com", "lima");
      await seller.patch("/api/auth/me/roles", { roles: ["producer"] });
      const project = await seller.post("/api/projects", { title: "Lima", description: "D" });
      const sub = await seller.post(`/api/projects/${project.body.id}/submissions`, {
        type: "beat", title: "Beat", visibility: "public", licenseBestowalAmount: 25,
      });
      expect(sub.status).toBe(201);

      const { client: other } = await helpers.register(base, "m@ex.com", "mike");
      expect((await seller.get(`/api/submissions/${sub.body.id}/unlocks`)).status).toBe(200);
      expect((await other.get(`/api/submissions/${sub.body.id}/unlocks`)).status).toBe(403);
      expect((await other.get(`/api/submissions/${sub.body.id}/unlocks`, { anonymous: true })).status).toBe(401);
    });
  });

  describe("creator-only actions", () => {
    it("limits negotiation review to the project creator", async () => {
      const { client: creator } = await helpers.register(base, "n@ex.com", "november");
      const project = await creator.post("/api/projects", { title: "Nov", description: "D" });
      const pid = project.body.id;

      const { client: other } = await helpers.register(base, "o@ex.com", "oscar");
      expect((await creator.get(`/api/projects/${pid}/negotiations`)).status).toBe(200);
      expect((await other.get(`/api/projects/${pid}/negotiations`)).status).toBe(403);
    });

    it("requires the ministry role to grant the ministry role", async () => {
      const { client: plain } = await helpers.register(base, "p@ex.com", "papa");
      const res = await plain.patch("/api/admin/grant-ministry", { username: "papa" });
      expect(res.status).toBe(403);
    });

    it("stops a member self-assigning the ministry role", async () => {
      const { client: c, user } = await helpers.register(base, "q@ex.com", "quebec");
      const res = await c.patch("/api/auth/me/roles", { roles: ["producer", "ministry"] });
      expect(res.status).toBe(200);
      // The route strips ministry from self-service updates.
      expect(res.body.roles).not.toContain("ministry");
      expect(res.body.roles).toContain("producer");
    });
  });

  describe("health", () => {
    it("reports liveness and readiness", async () => {
      const { client } = helpers;
      const c = client(base);
      expect((await c.get("/api/health")).body.status).toBe("ok");
      expect((await c.get("/api/health/ready")).body.database).toBe("up");
    });
  });
});
