import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar, json, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ROLES = ["producer", "writer", "supporter", "collaborator", "videographer", "engineer", "dancer", "ministry"] as const;
export type Role = typeof ROLES[number];

export const SUBMISSION_TYPES = {
  producer: ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"] as const,
  writer: ["hook", "song-concept", "verse", "theme", "song-title", "vocal-sample"] as const,
  supporter: ["mood-board", "song-concept", "visual-idea", "narrative-idea"] as const,
  collaborator: ["theme", "challenge", "concept"] as const,
  videographer: ["music-video-concept", "promo-asset", "social-media-pack", "visual-campaign"] as const,
  engineer: ["mix", "master", "vocal-production", "sound-design"] as const,
  dancer: ["choreography-concept", "performance-video", "acting-reel"] as const,
} as const;

export const ALL_SUBMISSION_TYPES = [
  ...SUBMISSION_TYPES.producer,
  ...SUBMISSION_TYPES.writer,
  ...SUBMISSION_TYPES.supporter,
  ...SUBMISSION_TYPES.collaborator,
  ...SUBMISSION_TYPES.videographer,
  ...SUBMISSION_TYPES.engineer,
  ...SUBMISSION_TYPES.dancer,
] as const;

export type SubmissionType = typeof ALL_SUBMISSION_TYPES[number];

export const COPRODUCER_SELECTION_TYPES = ["top", "random"] as const;
export type CoproducerSelectionType = typeof COPRODUCER_SELECTION_TYPES[number];

export const NEGOTIABLE_ROLES = ["videographer", "engineer", "dancer"] as const;
export type NegotiableRole = typeof NEGOTIABLE_ROLES[number];

export const VISIBILITY = ["private", "public"] as const;
export type Visibility = typeof VISIBILITY[number];

export const LAUNCH_GOAL = 300;
export const LAUNCH_CATEGORIES = ["producer", "writer", "supporter", "collaborator", "videographer", "engineer", "dancer", "ministry"] as const;
export type LaunchCategory = typeof LAUNCH_CATEGORIES[number];

/**
 * Session store for express-session via connect-pg-simple.
 *
 * Declared here so `npm run db:push` creates it alongside everything else.
 * connect-pg-simple can create this itself, but only by reading a table.sql
 * from its own package directory — which does not survive the esbuild bundle
 * in production. No application code reads or writes this table.
 */
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => ({
  expireIdx: index("IDX_user_sessions_expire").on(table.expire),
}));

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isSubscribed: boolean("is_subscribed").default(false),
  onboardingComplete: boolean("onboarding_complete").default(false),
  agreedAt: timestamp("agreed_at"),
  stripeCustomerId: text("stripe_customer_id"),
  credits: integer("credits").default(0),
  roles: text("roles").array().default([]),
});

/**
 * Login credentials, deliberately kept off the users table.
 *
 * User rows are serialized all over the API — nested inside projects,
 * submissions, co-producers, negotiations, feed items and messages. Keeping
 * the email and password hash in a separate table means no existing response
 * path can leak them by accident, and only the auth routes ever read this.
 */
export const userCredentials = pgTable("user_credentials", {
  userId: integer("user_id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const AUTH_TOKEN_PURPOSES = ["password_reset", "email_verification"] as const;
export type AuthTokenPurpose = typeof AUTH_TOKEN_PURPOSES[number];

/**
 * Single-use tokens emailed to a member.
 *
 * Only the SHA-256 of the token is stored, so a database leak does not let an
 * attacker reset anyone's password — the raw value exists solely in the email.
 */
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  purpose: text("purpose").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, { fields: [authTokens.userId], references: [users.id] }),
}));

export const userCredentialsRelations = relations(userCredentials, ({ one }) => ({
  user: one(users, { fields: [userCredentials.userId], references: [users.id] }),
}));

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  creatorId: integer("creator_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  uploaderId: integer("uploader_id").notNull(),
  name: text("name").notNull(),
  // Legacy/external location. New uploads set storageKey instead and this
  // holds the playback route rather than a direct object URL.
  url: text("url").notNull(),
  // R2 object key. Null for rows created before object storage existed.
  storageKey: text("storage_key"),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  type: text("type").notNull(),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * A gift toward a project. Deliberately carries no percentage.
 *
 * This replaces the former `investments` table, which recorded an equity
 * percentage that flowed into the project's royalty splits. Money paid in
 * exchange for a share of what others produce is an investment contract
 * however it is labelled, and Article III Section 3 of the bylaws forbids
 * profit distribution to individuals. A bestowal confers no claim on
 * proceeds — only the record that it was given.
 */
export const bestowals = pgTable("bestowals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  memberId: integer("member_id").notNull(),
  amount: numeric("amount").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  // R2 object key for the attached audio, when there is one.
  storageKey: text("storage_key"),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  visibility: text("visibility").notNull().default("private"),
  licenseBestowalAmount: numeric("license_bestowal_amount"),
  sampleClearancePercent: numeric("sample_clearance_percent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const licenseUnlocks = pgTable("license_unlocks", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offerings = pgTable("offerings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coproducers = pgTable("coproducers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  selectionType: text("selection_type").notNull(),
  percentage: integer("percentage").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow(),
});

export const royaltySplits = pgTable("royalty_splits", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  role: text("role").notNull(),
  percentage: numeric("percentage").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contributionNegotiations = pgTable("contribution_negotiations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  requestedPercent: numeric("requested_percent").notNull().default("0"),
  exchangeType: text("exchange_type").notNull().default("percentage"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Social Graph ──────────────────────────────────────────────────────────────

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull(),
  followeeId: integer("followee_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, { fields: [projects.creatorId], references: [users.id] }),
  files: many(files),
  bestowals: many(bestowals),
  submissions: many(submissions),
  offerings: many(offerings),
  coproducers: many(coproducers),
  royaltySplits: many(royaltySplits),
  contributionNegotiations: many(contributionNegotiations),
}));

export const filesRelations = relations(files, ({ one }) => ({
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  uploader: one(users, { fields: [files.uploaderId], references: [users.id] }),
}));

export const bestowalsRelations = relations(bestowals, ({ one }) => ({
  project: one(projects, { fields: [bestowals.projectId], references: [projects.id] }),
  member: one(users, { fields: [bestowals.memberId], references: [users.id] }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  project: one(projects, { fields: [submissions.projectId], references: [projects.id] }),
  user: one(users, { fields: [submissions.userId], references: [users.id] }),
  licenseUnlocks: many(licenseUnlocks),
}));

export const licenseUnlocksRelations = relations(licenseUnlocks, ({ one }) => ({
  submission: one(submissions, { fields: [licenseUnlocks.submissionId], references: [submissions.id] }),
  user: one(users, { fields: [licenseUnlocks.userId], references: [users.id] }),
}));

export const offeringsRelations = relations(offerings, ({ one }) => ({
  project: one(projects, { fields: [offerings.projectId], references: [projects.id] }),
  user: one(users, { fields: [offerings.userId], references: [users.id] }),
}));

export const coproducersRelations = relations(coproducers, ({ one }) => ({
  project: one(projects, { fields: [coproducers.projectId], references: [projects.id] }),
  user: one(users, { fields: [coproducers.userId], references: [users.id] }),
}));

export const royaltySplitsRelations = relations(royaltySplits, ({ one }) => ({
  project: one(projects, { fields: [royaltySplits.projectId], references: [projects.id] }),
}));

export const contributionNegotiationsRelations = relations(contributionNegotiations, ({ one }) => ({
  project: one(projects, { fields: [contributionNegotiations.projectId], references: [projects.id] }),
  user: one(users, { fields: [contributionNegotiations.userId], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id] }),
  followee: one(users, { fields: [follows.followeeId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id] }),
}));

// ── Playlists ─────────────────────────────────────────────────────────────────

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlistTracks = pgTable("playlist_tracks", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull(),
  submissionId: integer("submission_id").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, { fields: [playlists.userId], references: [users.id] }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistTracks.playlistId], references: [playlists.id] }),
  submission: one(submissions, { fields: [playlistTracks.submissionId], references: [submissions.id] }),
}));

export const insertPlaylistSchema = createInsertSchema(playlists).omit({ id: true, createdAt: true });
export const insertPlaylistTrackSchema = createInsertSchema(playlistTracks).omit({ id: true, createdAt: true });

export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type InsertPlaylistTrack = z.infer<typeof insertPlaylistTrackSchema>;

// ── Cypher Pass System ────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  date: timestamp("date").notNull(),
  donationAllocation: text("donation_allocation").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cypherPasses = pgTable("cypher_passes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  year: integer("year").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  artistUserId: integer("artist_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventsRelations = relations(events, ({ many }) => ({
  votes: many(votes),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  user: one(users, { fields: [donations.userId], references: [users.id] }),
}));

export const cypherPassesRelations = relations(cypherPasses, ({ one }) => ({
  user: one(users, { fields: [cypherPasses.userId], references: [users.id] }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
  event: one(events, { fields: [votes.eventId], references: [events.id] }),
  artist: one(users, { fields: [votes.artistUserId], references: [users.id] }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, createdAt: true });
export const insertBestowalSchema = createInsertSchema(bestowals).omit({ id: true, createdAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, createdAt: true });
export const insertOfferingSchema = createInsertSchema(offerings).omit({ id: true, createdAt: true });
export const insertCoproducerSchema = createInsertSchema(coproducers).omit({ id: true, createdAt: true });
export const insertRoyaltySplitSchema = createInsertSchema(royaltySplits).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertDonationSchema = createInsertSchema(donations).omit({ id: true, createdAt: true });
export const insertCypherPassSchema = createInsertSchema(cypherPasses).omit({ id: true, grantedAt: true });
export const insertVoteSchema = createInsertSchema(votes).omit({ id: true, createdAt: true });
export const insertContributionNegotiationSchema = createInsertSchema(contributionNegotiations).omit({ id: true, createdAt: true });
export const insertLicenseUnlockSchema = createInsertSchema(licenseUnlocks).omit({ id: true, createdAt: true });
export const insertFollowSchema = createInsertSchema(follows).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, readAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type Bestowal = typeof bestowals.$inferSelect;
export type InsertBestowal = z.infer<typeof insertBestowalSchema>;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Offering = typeof offerings.$inferSelect;
export type InsertOffering = z.infer<typeof insertOfferingSchema>;
export type Coproducer = typeof coproducers.$inferSelect;
export type InsertCoproducer = z.infer<typeof insertCoproducerSchema>;
export type RoyaltySplit = typeof royaltySplits.$inferSelect;
export type InsertRoyaltySplit = z.infer<typeof insertRoyaltySplitSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type CypherPass = typeof cypherPasses.$inferSelect;
export type InsertCypherPass = z.infer<typeof insertCypherPassSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type ContributionNegotiation = typeof contributionNegotiations.$inferSelect;
export type InsertContributionNegotiation = z.infer<typeof insertContributionNegotiationSchema>;
export type LicenseUnlock = typeof licenseUnlocks.$inferSelect;
export type InsertLicenseUnlock = z.infer<typeof insertLicenseUnlockSchema>;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type UserCredential = typeof userCredentials.$inferSelect;

// ── Auth input rules ──────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 10;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  // Capped so an enormous input cannot tie up the hashing work function.
  .max(200, "Password must be at most 200 characters");

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username may only contain letters, numbers and underscores",
  );
