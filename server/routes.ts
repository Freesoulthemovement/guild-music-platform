import type Stripe from "stripe";
import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { ROLES } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { pool } from "./db";
import { WebhookHandlers } from "./webhookHandlers";
import { getStripeClient, getConfiguredPriceId } from "./stripeClient";
import { hashPassword, verifyPassword, dummyVerify } from "./password";

const PgSession = connectPgSimple(session);

// Deliberately identical for "no such email" and "wrong password" so the
// response cannot be used to enumerate which addresses have accounts.
const INVALID_CREDENTIALS = "Invalid email or password";

// Throttles credential guessing. Counts only failures, so a member logging in
// repeatedly from a shared IP is not locked out by their own success.
const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

/**
 * Starts an authenticated session, regenerating the session id first.
 *
 * Without regeneration an attacker who can plant a session cookie before login
 * keeps a valid session afterwards (session fixation).
 */
function startSession(req: Express.Request & { session: any }, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr: unknown) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;

  // A predictable secret lets anyone forge a session cookie, so refuse to boot
  // with the development fallback in production.
  if (isProduction && !sessionSecret) {
    throw new Error(
      "SESSION_SECRET must be set in production. Generate one with: openssl rand -hex 32",
    );
  }

  app.use(
    session({
      secret: sessionSecret || "dev_secret",
      resave: false,
      saveUninitialized: false,
      // Postgres-backed so sessions survive restarts and deploys. MemoryStore
      // dropped every login on restart and leaked memory over time.
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        // The table is defined in shared/schema.ts and created by db:push.
        // connect-pg-simple's own creation path reads a table.sql from its
        // package directory, which does not exist inside the esbuild bundle.
        createTableIfMissing: false,
      }),
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      },
    }),
  );

  // Auth
  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session?.userId) return res.status(200).json(null);
    const user = await storage.getUser(req.session.userId);
    res.status(200).json(user || null);
  });

  app.post(api.auth.register.path, authWriteLimiter, async (req, res) => {
    try {
      const { email, password, username } = api.auth.register.input.parse(
        req.body,
      );

      if (await storage.getCredentialByEmail(email)) {
        return res
          .status(409)
          .json({ message: "An account with that email already exists" });
      }
      if (await storage.getUserByUsername(username)) {
        return res.status(409).json({ message: "That username is taken" });
      }

      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        username,
        displayName: username,
        credits: 0,
        isSubscribed: false,
        roles: [],
      });

      try {
        await storage.createCredential(user.id, email, passwordHash);
      } catch (err) {
        // A unique-constraint race between the check above and this insert
        // would otherwise leave an account nobody can log into.
        await storage.deleteUser(user.id).catch(() => {});
        return res
          .status(409)
          .json({ message: "An account with that email already exists" });
      }

      await startSession(req, user.id);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else {
        console.error("Registration error:", err);
        res.status(500).json({ message: "Internal error" });
      }
    }
  });

  app.post(api.auth.login.path, authWriteLimiter, async (req, res) => {
    try {
      const { email, password } = api.auth.login.input.parse(req.body);

      const credential = await storage.getCredentialByEmail(email);
      if (!credential) {
        // Spend comparable time so a missing account is not distinguishable
        // from a wrong password by response timing.
        await dummyVerify();
        return res.status(401).json({ message: INVALID_CREDENTIALS });
      }

      const ok = await verifyPassword(password, credential.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: INVALID_CREDENTIALS });
      }

      const user = await storage.getUser(credential.userId);
      if (!user) {
        console.error(`Credential ${credential.userId} has no matching user`);
        return res.status(401).json({ message: INVALID_CREDENTIALS });
      }

      await startSession(req, user.id);
      res.status(200).json(user);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal error" });
      }
    }
  });

  app.post(api.auth.changePassword.path, authWriteLimiter, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const { currentPassword, newPassword } =
        api.auth.changePassword.input.parse(req.body);

      const credential = await storage.getCredentialByUserId(req.session.userId);
      if (!credential) {
        return res.status(400).json({ message: "This account has no password set" });
      }
      if (!(await verifyPassword(currentPassword, credential.passwordHash))) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      await storage.updatePassword(
        req.session.userId,
        await hashPassword(newPassword),
      );
      // Re-issue the session so a stolen pre-change cookie stops working.
      await startSession(req, req.session.userId);
      res.status(200).json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else {
        console.error("Change password error:", err);
        res.status(500).json({ message: "Internal error" });
      }
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(200).json({ success: true });
    });
  });

  // NOTE: /api/auth/subscribe (mock free-subscribe) is intentionally removed.
  // Subscription state is only set via Stripe-verified paths:
  //   - POST /api/stripe/verify-session (checkout return)
  //   - POST /api/stripe/webhook (checkout.session.completed / subscription lifecycle)

  app.patch(api.auth.updateRoles.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const { roles } = api.auth.updateRoles.input.parse(req.body);
      const currentUser = await storage.getUser(req.session.userId);
      const hasMinistry = (currentUser?.roles ?? []).includes("ministry");
      const selfServiceRoles = roles.filter((r) => r !== "ministry");
      const finalRoles = hasMinistry
        ? [...selfServiceRoles, "ministry"]
        : selfServiceRoles;
      const user = await storage.updateUserRoles(
        req.session.userId,
        finalRoles,
      );
      res.status(200).json(user);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // Projects
  app.get(api.projects.list.path, async (req, res) => {
    const allProjects = await storage.getProjects();
    res.status(200).json(allProjects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    // Filter private content for non-subscribers
    const viewer = req.session?.userId
      ? await storage.getUser(req.session.userId)
      : null;
    const isSubscribed = !!viewer?.isSubscribed;
    const isCreator = viewer?.id === project.creatorId;
    if (!isSubscribed && !isCreator) {
      project.files = project.files.filter((f) => f.visibility === "public");
      project.submissions = project.submissions.filter(
        (s) => s.visibility === "public",
      );
    }
    res.status(200).json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectCreator = await storage.getUser(req.session.userId);
    if (!projectCreator?.isSubscribed)
      return res
        .status(403)
        .json({ message: "Active membership required to create projects" });
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject({
        ...input,
        creatorId: req.session.userId,
      });
      // Auto-initialize default royalty splits for every new project
      await storage.initializeRoyaltySplits(project.id);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // Files
  app.post(api.files.create.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const fileUser = await storage.getUser(req.session.userId);
    if (!fileUser?.isSubscribed)
      return res
        .status(403)
        .json({ message: "Active membership required to upload files" });
    try {
      const input = api.files.create.input.parse(req.body);
      const file = await storage.createFile({
        ...input,
        projectId: Number(req.params.projectId),
        uploaderId: req.session.userId,
      });
      res.status(201).json(file);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // Investments
  app.post(api.investments.create.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.isSubscribed)
      return res.status(403).json({ message: "Must be subscribed to invest" });
    try {
      const input = api.investments.create.input.parse(req.body);
      const projectId = Number(req.params.projectId);
      const existing = await storage.getProjectInvestments(projectId);
      if (existing.length >= 3)
        return res
          .status(403)
          .json({ message: "Maximum of 3 investors reached" });
      if (input.percentage > 10)
        return res.status(403).json({ message: "Maximum 10% per investor" });
      if (existing.some((inv) => inv.investorId === req.session.userId)) {
        return res
          .status(403)
          .json({ message: "You have already invested in this project" });
      }
      const investment = await storage.createInvestment({
        projectId,
        investorId: req.session.userId,
        amount: input.amount.toString(),
        percentage: input.percentage,
      });
      // Update persisted producer split to reflect new total equity
      const allInvestments = await storage.getProjectInvestments(projectId);
      const totalEquity = allInvestments.reduce(
        (sum, i) => sum + i.percentage,
        0,
      );
      await storage.upsertProducerSplit(projectId, totalEquity);
      res.status(201).json(investment);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // Offerings
  app.post(api.offerings.create.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = api.offerings.create.input.parse(req.body);
      const offering = await storage.createOffering({
        projectId: Number(req.params.projectId),
        userId: req.session.userId,
        amount: input.amount.toString(),
      });
      res.status(201).json(offering);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.offerings.list.path, async (req, res) => {
    const result = await storage.getProjectOfferings(
      Number(req.params.projectId),
    );
    res.status(200).json(result);
  });

  // Co-producer selection (project creator only)
  app.post(api.coproducers.select.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectId = Number(req.params.projectId);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.creatorId !== req.session.userId) {
      return res
        .status(403)
        .json({ message: "Only the project creator can select co-producers" });
    }
    const projectOfferings = await storage.getProjectOfferings(projectId);
    if (projectOfferings.length === 0) {
      return res
        .status(400)
        .json({
          message:
            "No offerings yet — supporters must make offerings before co-producers can be selected",
        });
    }
    const selected = await storage.selectCoproducers(projectId);
    res.status(200).json(selected);
  });

  app.get(api.coproducers.list.path, async (req, res) => {
    const result = await storage.getCoproducers(Number(req.params.projectId));
    res.status(200).json(result);
  });

  // Global submissions feed (supports ?types=beat,loop query param)
  app.get(api.submissions.listAll.path, async (req, res) => {
    const typesParam = req.query.types as string | undefined;
    const types = typesParam
      ? typesParam.split(",").filter(Boolean)
      : undefined;
    const viewer = req.session?.userId
      ? await storage.getUser(req.session.userId)
      : null;
    const isSubscribed = !!viewer?.isSubscribed;
    const subs = await storage.getAllSubmissions(types);
    const visible = isSubscribed
      ? subs
      : subs.filter((s) => s.visibility === "public");
    res.status(200).json(visible);
  });

  // Per-project submissions (supports ?types=beat,loop query param)
  app.get(api.submissions.list.path, async (req, res) => {
    const typesParam = req.query.types as string | undefined;
    const types = typesParam
      ? typesParam.split(",").filter(Boolean)
      : undefined;
    const viewer = req.session?.userId
      ? await storage.getUser(req.session.userId)
      : null;
    const isSubscribed = !!viewer?.isSubscribed;
    const subs = await storage.getProjectSubmissions(
      Number(req.params.projectId),
      types,
    );
    const visible = isSubscribed
      ? subs
      : subs.filter((s) => s.visibility === "public");
    res.status(200).json(visible);
  });

  app.post(api.submissions.create.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = api.submissions.create.input.parse(req.body);

      const { ALL_SUBMISSION_TYPES, SUBMISSION_TYPES } = await import(
        "@shared/schema"
      );
      const submittingUser = await storage.getUser(req.session.userId);
      if (!submittingUser?.isSubscribed) {
        return res
          .status(403)
          .json({
            message: "Active membership required to submit contributions",
          });
      }
      if (!(ALL_SUBMISSION_TYPES as readonly string[]).includes(input.type)) {
        return res
          .status(400)
          .json({ message: `Unknown submission type: ${input.type}` });
      }

      const user = await storage.getUser(req.session.userId);
      const userRoles = user?.roles ?? [];
      const allowedTypes = new Set<string>();
      for (const role of userRoles) {
        const roleTypes =
          SUBMISSION_TYPES[role as keyof typeof SUBMISSION_TYPES];
        if (roleTypes) roleTypes.forEach((t) => allowedTypes.add(t));
      }
      if (!allowedTypes.has(input.type)) {
        const reason =
          userRoles.length === 0
            ? "You must set a creative role before submitting"
            : `Your current roles do not permit submitting type: ${input.type}`;
        return res.status(403).json({ message: reason });
      }

      const submission = await storage.createSubmission({
        ...input,
        licenseBestowalAmount:
          input.licenseBestowalAmount != null
            ? input.licenseBestowalAmount.toString()
            : undefined,
        sampleClearancePercent:
          input.sampleClearancePercent != null
            ? input.sampleClearancePercent.toString()
            : undefined,
        projectId: Number(req.params.projectId),
        userId: req.session.userId,
      });
      res.status(201).json(submission);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Events ───────────────────────────────────────────────────────────────────
  app.get("/api/events", async (_req, res) => {
    const allEvents = await storage.getEvents();
    res.status(200).json(allEvents);
  });

  // ── Donations ─────────────────────────────────────────────────────────────

  app.post("/api/donations", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = z
        .object({ amount: z.coerce.number().min(1) })
        .parse(req.body);
      const year = new Date().getFullYear();
      const donation = await storage.createDonation({
        userId: req.session.userId,
        amount: input.amount.toString(),
        year,
      });
      // Check pass eligibility: single ≥$700 OR cumulative ≥$1,000
      const existingPass = await storage.getUserCypherPass(
        req.session.userId,
        year,
      );
      if (!existingPass) {
        const yearDonations = await storage.getUserDonations(
          req.session.userId,
          year,
        );
        const cumulative = yearDonations.reduce(
          (s, d) => s + Number(d.amount),
          0,
        );
        const singleQualifies = input.amount >= 700;
        const cumulativeQualifies = cumulative >= 1000;
        if (singleQualifies || cumulativeQualifies) {
          await storage.grantCypherPass(req.session.userId, year);
        }
      }
      res.status(201).json(donation);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/donations/me", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const year = new Date().getFullYear();
    const userDonations = await storage.getUserDonations(
      req.session.userId,
      year,
    );
    const yearTotal = userDonations.reduce((s, d) => s + Number(d.amount), 0);
    const pass =
      (await storage.getUserCypherPass(req.session.userId, year)) ?? null;
    res
      .status(200)
      .json({ donations: userDonations, yearTotal, hasPass: !!pass, pass });
  });

  // ── Voting ────────────────────────────────────────────────────────────────
  app.get("/api/events/:eventId/votes", async (req, res) => {
    const eventId = Number(req.params.eventId);
    const leaderboard = await storage.getVoteLeaderboard(eventId);
    res.status(200).json(leaderboard);
  });

  app.post("/api/events/:eventId/votes", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = z.object({ artistUserId: z.number() }).parse(req.body);
      const eventId = Number(req.params.eventId);
      // Active membership required to vote
      const voter = await storage.getUser(req.session.userId);
      if (!voter?.isSubscribed)
        return res
          .status(403)
          .json({ message: "Active membership required to vote" });
      // Fetch event to validate it exists
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const year = new Date().getFullYear();
      // Must have a Cypher Pass for the current calendar year
      const pass = await storage.getUserCypherPass(req.session.userId, year);
      if (!pass)
        return res
          .status(403)
          .json({ message: "You need a Cypher Pass to vote" });
      // Max 4 votes per event
      const myVotes = await storage.getUserVotesForEvent(
        req.session.userId,
        eventId,
      );
      if (myVotes.length >= 4)
        return res
          .status(403)
          .json({
            message: "You have already used all 4 votes for this event",
          });
      // Cannot vote for yourself
      if (input.artistUserId === req.session.userId)
        return res
          .status(403)
          .json({ message: "You cannot vote for yourself" });
      // artistUserId must be a ministry artist — enforce server-side, not just in UI
      const ministryArtists = await storage.getMinistryArtists();
      const isEligible = ministryArtists.some(
        (a) => a.id === input.artistUserId,
      );
      if (!isEligible)
        return res
          .status(400)
          .json({ message: "That user is not an eligible ministry artist" });
      const vote = await storage.castVote({
        userId: req.session.userId,
        eventId,
        artistUserId: input.artistUserId,
      });
      res.status(201).json(vote);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // User's own vote count for an event (session-based)
  app.get("/api/events/:eventId/my-votes", async (req, res) => {
    if (!req.session?.userId)
      return res.status(200).json({ count: 0, votes: [] });
    const eventId = Number(req.params.eventId);
    const userVotes = await storage.getUserVotesForEvent(
      req.session.userId,
      eventId,
    );
    res.status(200).json({ count: userVotes.length, votes: userVotes });
  });

  // ── Ministry ─────────────────────────────────────────────────────────────
  app.get("/api/ministry/artists", async (_req, res) => {
    const artists = await storage.getMinistryArtists();
    res.status(200).json(artists);
  });

  app.get("/api/ministry/stats", async (_req, res) => {
    const stats = await storage.getMinistryStats();
    res.status(200).json(stats);
  });

  // ── Contribution Negotiations ─────────────────────────────────────────────
  // POST /api/projects/:id/negotiations — create or update own negotiation request
  app.post("/api/projects/:id/negotiations", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectId = Number(req.params.id);
    try {
      const input = z
        .object({
          requestedPercent: z.coerce.number().min(0).max(10),
          exchangeType: z.enum(["percentage", "equal"]),
        })
        .parse(req.body);
      const { NEGOTIABLE_ROLES } = await import("@shared/schema");
      const user = await storage.getUser(req.session.userId);
      const userRoles = user?.roles ?? [];
      const hasNegotiableRole = userRoles.some((r) =>
        (NEGOTIABLE_ROLES as readonly string[]).includes(r),
      );
      if (!hasNegotiableRole) {
        return res
          .status(403)
          .json({
            message:
              "Only Videographer/Marketing, Recording Engineer, or Dancer/Actor roles may submit negotiations",
          });
      }
      const neg = await storage.upsertNegotiation({
        projectId,
        userId: req.session.userId,
        requestedPercent: input.requestedPercent,
        exchangeType: input.exchangeType,
      });
      res.status(200).json(neg);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // GET /api/projects/:id/negotiations — list all negotiations (creator only)
  app.get("/api/projects/:id/negotiations", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectId = Number(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.creatorId !== req.session.userId) {
      return res
        .status(403)
        .json({ message: "Only the project creator can view negotiations" });
    }
    const negs = await storage.getProjectNegotiations(projectId);
    res.status(200).json(negs);
  });

  // GET /api/projects/:id/negotiations/me — get own negotiation for a project
  app.get("/api/projects/:id/negotiations/me", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectId = Number(req.params.id);
    const neg = await storage.getUserNegotiation(projectId, req.session.userId);
    res.status(200).json(neg ?? null);
  });

  // PATCH /api/projects/:id/negotiations/:nId — accept or reject (creator only)
  app.patch("/api/projects/:id/negotiations/:nId", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const projectId = Number(req.params.id);
    const nId = Number(req.params.nId);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.creatorId !== req.session.userId) {
      return res
        .status(403)
        .json({
          message: "Only the project creator can respond to negotiations",
        });
    }
    try {
      const { status } = z
        .object({ status: z.enum(["accepted", "rejected"]) })
        .parse(req.body);
      const updated = await storage.updateNegotiationStatus(
        nId,
        projectId,
        status,
      );
      if (!updated)
        return res
          .status(404)
          .json({ message: "Negotiation not found for this project" });
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Public Launch Status ──────────────────────────────────────────────────
  app.get("/api/projects/:id/launch-status", async (req, res) => {
    const projectId = Number(req.params.id);
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const status = await storage.getProjectLaunchStatus(projectId);
    res.status(200).json(status);
  });

  // ── License Unlocks ────────────────────────────────────────────────────────
  app.post("/api/submissions/:id/unlock-license", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const submissionId = Number(req.params.id);
    const { db } = await import("./db");
    const { submissions } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [sub] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    if (!sub) return res.status(404).json({ message: "Submission not found" });
    if (!sub.licenseBestowalAmount)
      return res
        .status(400)
        .json({ message: "This submission has no license price set" });
    const alreadyUnlocked = await storage.hasUserUnlockedLicense(
      submissionId,
      req.session.userId,
    );
    if (alreadyUnlocked)
      return res
        .status(400)
        .json({ message: "You have already unlocked this license" });
    const unlock = await storage.unlockLicense(
      submissionId,
      req.session.userId,
      Number(sub.licenseBestowalAmount),
    );
    res.status(201).json(unlock);
  });

  app.get("/api/submissions/:id/unlocks", async (req, res) => {
    const submissionId = Number(req.params.id);
    const unlocks = await storage.getLicenseUnlocks(submissionId);
    res.status(200).json(unlocks);
  });

  app.get("/api/submissions/:id/unlocks/me", async (req, res) => {
    if (!req.session?.userId) return res.status(200).json({ unlocked: false });
    const submissionId = Number(req.params.id);
    const unlocked = await storage.hasUserUnlockedLicense(
      submissionId,
      req.session.userId,
    );
    res.status(200).json({ unlocked });
  });

  // ── Stripe Webhook ────────────────────────────────────────────────────────
  // Note: express.json's verify callback stores req.rawBody as Buffer, so we use that here.
  app.post("/api/stripe/webhook", async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature)
      return res.status(400).json({ error: "Missing stripe-signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;

    // Verify first. A bad signature means the payload is untrusted and must
    // not be acted on, so this is a 400 with no side effects.
    let event: Stripe.Event;
    try {
      event = await WebhookHandlers.constructEvent(
        (req as any).rawBody as Buffer,
        sig,
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Handling failures return 500 so Stripe retries. Returning 200 here would
    // silently strand a paying member without access.
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id
          ? Number(session.client_reference_id)
          : NaN;
        if (!isNaN(userId) && userId > 0) {
          await storage.updateUserSubscription(userId, true);
          const existingUser = await storage.getUser(userId);
          if (existingUser && !existingUser.onboardingComplete) {
            await storage.updateUserOnboarding(userId, new Date());
          }
        }
      } else if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : null;
        if (customerId) {
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) await storage.updateUserSubscription(user.id, false);
        }
      } else if (event.type === "customer.subscription.updated") {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : null;
        const status: string | undefined = sub.status;
        if (customerId && status) {
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const active = status === "active" || status === "trialing";
            await storage.updateUserSubscription(user.id, active);
          }
        }
      }
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("Webhook handling error:", err.message);
      res.status(500).json({ error: "Webhook handling failed" });
    }
  });

  // ── Stripe Checkout ───────────────────────────────────────────────────────
  app.post("/api/stripe/checkout", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const stripe = await getStripeClient();

      // Prefer an explicitly configured price. Stripe's search index is
      // eventually consistent, so looking a price up by product name can miss
      // one that was just created — fine for dev, not for a live checkout.
      const configuredPriceId = getConfiguredPriceId();
      let priceId: string | undefined = configuredPriceId;

      if (!priceId) {
        const priceSearch = await stripe.prices.search({
          query: "active:'true' AND type:'recurring'",
          expand: ["data.product"],
          limit: 20,
        });
        priceId = priceSearch.data.find((p) => {
          const prod = p.product as any;
          return (
            typeof prod === "object" && prod?.name === "Producers Circle Pro"
          );
        })?.id;
      }

      if (!priceId) {
        return res
          .status(503)
          .json({
            message:
              "Subscription product not configured. Set STRIPE_PRICE_ID, or run the seed script to create the Producers Circle Pro product.",
          });
      }

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: user.displayName ?? user.username,
          metadata: { userId: user.id.toString() },
        });
        await storage.updateUserStripeCustomerId(user.id, customer.id);
        customerId = customer.id;
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/account`,
        client_reference_id: user.id.toString(),
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err.message);
      res.status(500).json({ message: err.message || "Checkout failed" });
    }
  });

  // ── Stripe Customer Portal ────────────────────────────────────────────────
  app.post("/api/stripe/portal", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(req.session.userId);
    if (!user?.stripeCustomerId)
      return res
        .status(400)
        .json({ message: "No billing account found. Please subscribe first." });
    try {
      const stripe = await getStripeClient();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/account`,
      });
      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Portal error:", err.message);
      res
        .status(500)
        .json({ message: err.message || "Failed to open billing portal" });
    }
  });

  // ── Onboarding completion for already-subscribed users ────────────────────
  // Called when a legacy subscribed user completes the agreement/pledge steps
  // without needing to re-enter Stripe checkout.
  app.post("/api/stripe/onboarding/complete", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isSubscribed)
      return res.status(403).json({ message: "Active subscription required" });
    try {
      const updated = await storage.updateUserOnboarding(
        req.session.userId,
        new Date(),
      );
      res.json({ success: true, user: updated });
    } catch (err: any) {
      res
        .status(500)
        .json({ message: err.message || "Failed to complete onboarding" });
    }
  });

  // ── Stripe Subscription Status ────────────────────────────────────────────
  app.get("/api/stripe/subscription-status", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user?.stripeCustomerId)
        return res.status(200).json({ status: "none" });
      const stripe = await getStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 1,
        status: "all" as any,
      });
      const sub = subscriptions.data[0] as any;
      if (!sub) return res.status(200).json({ status: "none" });
      return res.status(200).json({
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: sub.current_period_end,
      });
    } catch (err: any) {
      const user = await storage.getUser(req.session.userId).catch(() => null);
      return res
        .status(200)
        .json({ status: user?.isSubscribed ? "active" : "none" });
    }
  });

  // ── Stripe Verify Session (called after redirect back from Stripe) ─────────
  app.post("/api/stripe/verify-session", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const { sessionId } = req.body;
    if (!sessionId)
      return res.status(400).json({ message: "sessionId required" });
    try {
      const stripe = await getStripeClient();
      const checkoutSession =
        await stripe.checkout.sessions.retrieve(sessionId);
      // Security: ensure this checkout session was created for the current user
      if (
        checkoutSession.client_reference_id !== req.session.userId.toString()
      ) {
        return res.status(403).json({ message: "Session ownership mismatch" });
      }
      if (
        checkoutSession.payment_status === "paid" ||
        checkoutSession.status === "complete"
      ) {
        await storage.updateUserSubscription(req.session.userId, true);
        const finalUser = await storage.updateUserOnboarding(
          req.session.userId,
          new Date(),
        );
        res.json({ success: true, user: finalUser });
      } else {
        res.json({ success: false, status: checkoutSession.payment_status });
      }
    } catch (err: any) {
      console.error("Verify session error:", err.message);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // ── Social – Profile ─────────────────────────────────────────────────────

  app.patch("/api/users/me", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = z
        .object({
          displayName: z.string().max(60).optional(),
          bio: z.string().max(500).optional(),
          avatarUrl: z.string().url().optional().or(z.literal("")),
        })
        .parse(req.body);
      const updated = await storage.updateUserProfile(
        req.session.userId,
        input,
      );
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/users/:username", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const profile = await storage.getPublicProfile(
      req.params.username,
      req.session.userId,
    );
    if (!profile) return res.status(404).json({ message: "User not found" });
    res.status(200).json(profile);
  });

  app.get("/api/users/:username/submissions", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    const viewer = await storage.getUser(req.session.userId);
    const isSubscribed = !!viewer?.isSubscribed;
    const { submissions: subsTable } = await import("@shared/schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(subsTable)
      .where(eq(subsTable.userId, user.id));
    const visible = isSubscribed
      ? rows
      : rows.filter((s: any) => s.visibility === "public");
    res.status(200).json(visible);
  });

  // ── Social – Follows ──────────────────────────────────────────────────────

  app.post("/api/users/:username/follow", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const target = await storage.getUserByUsername(req.params.username);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.id === req.session.userId)
      return res.status(400).json({ message: "Cannot follow yourself" });
    const follow = await storage.followUser(req.session.userId, target.id);
    res.status(201).json(follow);
  });

  app.delete("/api/users/:username/follow", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const target = await storage.getUserByUsername(req.params.username);
    if (!target) return res.status(404).json({ message: "User not found" });
    await storage.unfollowUser(req.session.userId, target.id);
    res.status(200).json({ success: true });
  });

  app.get("/api/users/:username/followers", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const target = await storage.getUserByUsername(req.params.username);
    if (!target) return res.status(404).json({ message: "User not found" });
    const followers = await storage.getFollowers(target.id);
    res.status(200).json(followers);
  });

  app.get("/api/users/:username/following", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const target = await storage.getUserByUsername(req.params.username);
    if (!target) return res.status(404).json({ message: "User not found" });
    const following = await storage.getFollowing(target.id);
    res.status(200).json(following);
  });

  // ── Social – Feed ─────────────────────────────────────────────────────────

  app.get("/api/feed", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const feed = await storage.getFeed(req.session.userId);
    res.status(200).json(feed);
  });

  // ── Social – Messages ─────────────────────────────────────────────────────

  app.get("/api/messages/unread-count", async (req, res) => {
    if (!req.session?.userId) return res.status(200).json({ count: 0 });
    const count = await storage.getUnreadCount(req.session.userId);
    res.status(200).json({ count });
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const convos = await storage.getConversations(req.session.userId);
    res.status(200).json(convos);
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    try {
      const input = z
        .object({
          receiverUsername: z.string().min(1),
          body: z.string().min(1).max(2000),
        })
        .parse(req.body);
      const receiver = await storage.getUserByUsername(input.receiverUsername);
      if (!receiver) return res.status(404).json({ message: "User not found" });
      if (receiver.id === req.session.userId)
        return res.status(400).json({ message: "Cannot message yourself" });
      const msg = await storage.sendMessage(
        req.session.userId,
        receiver.id,
        input.body,
      );
      res.status(201).json(msg);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/messages/:username", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const partner = await storage.getUserByUsername(req.params.username);
    if (!partner) return res.status(404).json({ message: "User not found" });
    const thread = await storage.getThread(req.session.userId, partner.id);
    await storage.markThreadRead(req.session.userId, partner.id);
    res.status(200).json(thread);
  });

  app.patch("/api/messages/:username/read", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const partner = await storage.getUserByUsername(req.params.username);
    if (!partner) return res.status(404).json({ message: "User not found" });
    await storage.markThreadRead(req.session.userId, partner.id);
    res.status(200).json({ success: true });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────
  app.patch(api.admin.grantMinistry.path, async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUser(req.session.userId);
    if (!caller || !(caller.roles ?? []).includes("ministry")) {
      return res.status(403).json({ message: "Ministry role required" });
    }
    try {
      const { username } = api.admin.grantMinistry.input.parse(req.body);
      const target = await storage.getUserByUsername(username);
      if (!target) return res.status(404).json({ message: "User not found" });
      const currentRoles = target.roles ?? [];
      if (currentRoles.includes("ministry")) {
        return res.status(200).json(target);
      }
      const updated = await storage.updateUserRoles(target.id, [
        ...currentRoles,
        "ministry",
      ]);
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        res.status(400).json({ message: err.errors[0].message });
      else res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Playlists ─────────────────────────────────────────────────────────────
  app.get("/api/playlists", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const list = await storage.getPlaylists(req.session.userId);
    res.json(list);
  });

  app.post("/api/playlists", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "Name required" });
    const pl = await storage.createPlaylist(req.session.userId, name.trim());
    res.status(201).json(pl);
  });

  app.delete("/api/playlists/:id", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const id = parseInt(req.params.id, 10);
    await storage.deletePlaylist(id, req.session.userId);
    res.json({ success: true });
  });

  app.get("/api/playlists/:id", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const id = parseInt(req.params.id, 10);
    const pl = await storage.getPlaylistWithTracks(id, req.session.userId);
    if (!pl) return res.status(404).json({ message: "Not found" });
    res.json(pl);
  });

  app.post("/api/playlists/:id/tracks", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const playlistId = parseInt(req.params.id, 10);
    const { submissionId } = req.body;
    if (!submissionId || typeof submissionId !== "number")
      return res.status(400).json({ message: "submissionId required" });
    try {
      const track = await storage.addTrackToPlaylist(
        playlistId,
        submissionId,
        req.session.userId,
      );
      res.status(201).json(track);
    } catch (err: any) {
      res.status(403).json({ message: err.message });
    }
  });

  app.delete("/api/playlists/:id/tracks/:submissionId", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const playlistId = parseInt(req.params.id, 10);
    const submissionId = parseInt(req.params.submissionId, 10);
    try {
      await storage.removeTrackFromPlaylist(
        playlistId,
        submissionId,
        req.session.userId,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(403).json({ message: err.message });
    }
  });

  app.patch("/api/playlists/:id/tracks/reorder", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const playlistId = parseInt(req.params.id, 10);
    const { order } = req.body;
    if (!Array.isArray(order) || !order.every((x) => typeof x === "number")) {
      return res
        .status(400)
        .json({ message: "order must be array of submissionIds" });
    }
    try {
      await storage.reorderPlaylistTracks(
        playlistId,
        order,
        req.session.userId,
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(403).json({ message: err.message });
    }
  });

  // ── Radio ──────────────────────────────────────────────────────────────────
  app.get("/api/radio", async (req, res) => {
    if (!req.session?.userId)
      return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const tracks = await storage.getRadioTracks(
      req.session.userId,
      user.isSubscribed ?? false,
    );
    res.json(tracks);
  });

  // Demo data only. These accounts are subscribed and two of them hold the
  // ministry role, so seeding them into a live database would hand anyone who
  // guessed the password an administrator account.
  if (!isProduction) {
    seedDatabase().catch(console.error);
  }

  return httpServer;
}

/**
 * Development-only demo data. Never runs in production — see the caller.
 *
 * Every seeded account gets the same well-known password so the app is usable
 * locally straight after a db:push.
 */
const DEV_SEED_PASSWORD = "circle-dev-password";

/** Gives a seeded user login credentials, if they do not already have them. */
async function ensureDevCredential(userId: number, email: string) {
  if (await storage.getCredentialByUserId(userId)) return;
  if (await storage.getCredentialByEmail(email)) return;
  await storage.createCredential(userId, email, await hashPassword(DEV_SEED_PASSWORD));
}

async function seedDatabase() {
  // ── Seed the first Cypher event ───────────────────────────────────────────
  const existingEvents = await storage.getEvents();
  if (existingEvents.length === 0) {
    await storage.createEvent({
      title: "The First Cypher — Las Vegas",
      description:
        "The inaugural annual gathering of the Free Soul Ecclesiastical Movement. Seven chosen co-producers perform live alongside ministry artists in a sovereign, members-only ceremony. Cypher Pass holders determine who takes the stage through their sacred 4-vote bestowal.",
      location: "Las Vegas, NV",
      date: new Date("2027-03-20T20:00:00.000Z"),
      donationAllocation: JSON.stringify({
        Hearths: 30,
        "Artist Bestowal": 30,
        "Event Setup": 20,
        Savings: 10,
      }),
    });
  }

  let user1 = await storage.getUserByUsername("alice");
  if (!user1) {
    user1 = await storage.createUser({
      username: "alice",
      displayName: "Alice Artist",
      credits: 50,
      isSubscribed: true,
      roles: ["producer", "writer"],
    });
    await storage.updateUserOnboarding(user1.id, new Date());
  } else {
    const hasMinistry = (user1.roles ?? []).includes("ministry");
    const canonical = [
      "producer",
      "writer",
      ...(hasMinistry ? ["ministry"] : []),
    ];
    user1 = await storage.updateUserRoles(user1.id, canonical);
    await storage.updateUserSubscription(user1.id, true);
    if (!user1.onboardingComplete)
      await storage.updateUserOnboarding(user1.id, new Date());
  }

  let user2 = await storage.getUserByUsername("bob");
  if (!user2) {
    user2 = await storage.createUser({
      username: "bob",
      displayName: "Bob Producer",
      credits: 200,
      isSubscribed: true,
      roles: ["producer", "collaborator"],
    });
    await storage.updateUserOnboarding(user2.id, new Date());
  } else {
    const hasMinistry = (user2.roles ?? []).includes("ministry");
    const canonical = [
      "producer",
      "collaborator",
      ...(hasMinistry ? ["ministry"] : []),
    ];
    user2 = await storage.updateUserRoles(user2.id, canonical);
    await storage.updateUserSubscription(user2.id, true);
    if (!user2.onboardingComplete)
      await storage.updateUserOnboarding(user2.id, new Date());
  }

  // ── Demo ministry artists so voting is testable out of the box ────────────
  let zara = await storage.getUserByUsername("zara");
  if (!zara) {
    zara = await storage.createUser({
      username: "zara",
      displayName: "Zara Free Soul",
      credits: 0,
      isSubscribed: true,
      roles: ["ministry", "producer"],
    });
  } else if (!(zara.roles ?? []).includes("ministry")) {
    zara = await storage.updateUserRoles(zara.id, [
      ...(zara.roles ?? []).filter((r) => r !== "ministry"),
      "ministry",
    ]);
  }

  let malik = await storage.getUserByUsername("malik");
  if (!malik) {
    malik = await storage.createUser({
      username: "malik",
      displayName: "Malik Sovereign",
      credits: 0,
      isSubscribed: true,
      roles: ["ministry", "writer"],
    });
  } else if (!(malik.roles ?? []).includes("ministry")) {
    malik = await storage.updateUserRoles(malik.id, [
      ...(malik.roles ?? []).filter((r) => r !== "ministry"),
      "ministry",
    ]);
  }

  // Login credentials for the demo accounts. Password: see DEV_SEED_PASSWORD.
  await ensureDevCredential(user1.id, "alice@example.com");
  await ensureDevCredential(user2.id, "bob@example.com");
  await ensureDevCredential(zara.id, "zara@example.com");
  await ensureDevCredential(malik.id, "malik@example.com");

  const existingProjects = await storage.getProjects();

  let p1Id =
    existingProjects.find(
      (p) => p.title === "Neon Nights EP" && p.creatorId === user1.id,
    )?.id ?? 0;
  let p2Id =
    existingProjects.find(
      (p) => p.title === "Acoustic Sessions" && p.creatorId === user2.id,
    )?.id ?? 0;

  if (!p1Id) {
    const p1 = await storage.createProject({
      title: "Neon Nights EP",
      description:
        "Synthwave exploration EP with 5 tracks. Looking for vocalists and additional synth layers.",
      creatorId: user1.id,
    });
    p1Id = p1.id;
    await storage.initializeRoyaltySplits(p1Id);
    await storage.createFile({
      projectId: p1Id,
      uploaderId: user1.id,
      name: "Synth Bass Stem",
      url: "https://storage.producerscircle.mock/synth.wav",
      type: "stem",
    });
    const seedInvestment = await storage.createInvestment({
      projectId: p1Id,
      investorId: user2.id,
      amount: "50",
      percentage: 5,
    });
    await storage.upsertProducerSplit(p1Id, seedInvestment.percentage);
  }

  if (!p2Id) {
    const p2 = await storage.createProject({
      title: "Acoustic Sessions",
      description:
        "Looking for vocalists and guitarists to collaborate on this organic, soulful project.",
      creatorId: user2.id,
    });
    p2Id = p2.id;
    await storage.initializeRoyaltySplits(p2Id);
  }

  // Backfill royalty splits for any project missing them
  for (const p of existingProjects) {
    const existingSplits = await storage.getRoyaltySplits(p.id);
    if (existingSplits.length === 0) {
      await storage.initializeRoyaltySplits(p.id);
      const projInvestments = await storage.getProjectInvestments(p.id);
      const total = projInvestments.reduce((sum, i) => sum + i.percentage, 0);
      if (total > 0) await storage.upsertProducerSplit(p.id, total);
    }
  }

  // Always ensure seed submissions exist (idempotent: check by title + userId)
  const { db } = await import("./db");
  const { submissions: subsTable } = await import("@shared/schema");
  const { eq, and } = await import("drizzle-orm");

  const seedSubs = [
    {
      projectId: p1Id,
      userId: user1.id,
      type: "beat" as const,
      title: "Neon Pulse Beat",
      description: "Main beat with 808s and synth chords at 128bpm",
    },
    {
      projectId: p1Id,
      userId: user2.id,
      type: "hook" as const,
      title: "City Lights Hook",
      description: "Melodic hook about driving through the city at night",
    },
    {
      projectId: p2Id,
      userId: user1.id,
      type: "mood-board" as const,
      title: "Earthy Tones Vision",
      description:
        "Visual direction: warm browns, candlelight, natural textures",
    },
    {
      projectId: p2Id,
      userId: user2.id,
      type: "collab-beat" as const,
      title: "Open Collab Groove",
      description: "Chill 90bpm groove — open for additional instruments",
    },
  ];

  for (const s of seedSubs) {
    const [existing] = await db
      .select()
      .from(subsTable)
      .where(and(eq(subsTable.title, s.title), eq(subsTable.userId, s.userId)));
    if (!existing) {
      await storage.createSubmission(s);
    }
  }
}
