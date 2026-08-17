import { db } from "./db";
import { eq, inArray, desc, and, sql, or, ne } from "drizzle-orm";
import {
  users, projects, files, investments, submissions, offerings, coproducers, royaltySplits,
  events, donations, cypherPasses, votes, contributionNegotiations, licenseUnlocks,
  follows, messages, playlists, playlistTracks, userCredentials,
  type User, type InsertUser,
  type UserCredential,
  type Project, type InsertProject,
  type File, type InsertFile,
  type Investment, type InsertInvestment,
  type Submission, type InsertSubmission,
  type Offering, type InsertOffering,
  type Coproducer, type InsertCoproducer,
  type RoyaltySplit, type InsertRoyaltySplit,
  type Event, type InsertEvent,
  type Donation, type InsertDonation,
  type CypherPass, type InsertCypherPass,
  type Vote, type InsertVote,
  type ContributionNegotiation, type InsertContributionNegotiation,
  type LicenseUnlock,
  type Follow,
  type Message,
  type Playlist, type PlaylistTrack,
  SUBMISSION_TYPES, LAUNCH_CATEGORIES,
} from "@shared/schema";

export type LaunchStatus = {
  backerTotal: number;
  backerGoal: number;
  backerProgress: number;
  categories: Record<string, boolean>;
  categoriesFulfilled: number;
  canLaunch: boolean;
};

// Fields safe to return in public/social API responses — excludes sensitive internals
export type SafeUser = Omit<User, "stripeCustomerId">;

function toSafeUser(u: User): SafeUser {
  const { stripeCustomerId: _stripped, ...safe } = u;
  return safe;
}

export type PublicProfile = SafeUser & {
  followerCount: number;
  followingCount: number;
  submissionCount: number;
  projectCount: number;
  isFollowing: boolean;
  collaboratedProjects: { id: number; title: string; description: string }[];
};

export type FeedItem = {
  id: number;
  type: "submission" | "project";
  actorId: number;
  actorUsername: string;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  title: string;
  subType?: string;
  projectTitle?: string;
  projectId: number;
  createdAt: Date;
};

export type Conversation = {
  partnerId: number;
  partnerUsername: string;
  partnerDisplayName: string | null;
  partnerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Credentials — the only place the password hash is read or written
  getCredentialByEmail(email: string): Promise<UserCredential | undefined>;
  getCredentialByUserId(userId: number): Promise<UserCredential | undefined>;
  createCredential(userId: number, email: string, passwordHash: string): Promise<UserCredential>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  updateUserSubscription(id: number, isSubscribed: boolean): Promise<User>;
  updateUserRoles(id: number, roles: string[]): Promise<User>;
  updateUserOnboarding(id: number, agreedAt: Date): Promise<User>;
  updateUserStripeCustomerId(id: number, stripeCustomerId: string): Promise<User>;
  updateUserProfile(id: number, data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User>;

  getProjects(): Promise<(Project & { creator: User; investmentCount: number })[]>;
  getProject(id: number): Promise<(Project & {
    creator: User,
    files: (File & { uploader: User })[],
    investments: (Investment & { investor: User })[],
    submissions: (Submission & { user: User })[],
    coproducers: (Coproducer & { user: User })[],
    royaltySplits: RoyaltySplit[],
  }) | undefined>;
  createProject(project: InsertProject): Promise<Project>;

  createFile(file: InsertFile): Promise<File>;

  createInvestment(investment: InsertInvestment): Promise<Investment>;
  getProjectInvestments(projectId: number): Promise<Investment[]>;

  getProjectSubmissions(projectId: number, types?: string[]): Promise<(Submission & { user: User })[]>;
  getAllSubmissions(types?: string[]): Promise<(Submission & { user: User; project: Project })[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;

  createOffering(offering: InsertOffering): Promise<Offering>;
  getProjectOfferings(projectId: number): Promise<(Offering & { user: User })[]>;

  getCoproducers(projectId: number): Promise<(Coproducer & { user: User })[]>;
  selectCoproducers(projectId: number): Promise<(Coproducer & { user: User })[]>;

  getRoyaltySplits(projectId: number): Promise<RoyaltySplit[]>;
  initializeRoyaltySplits(projectId: number): Promise<void>;
  upsertProducerSplit(projectId: number, totalPercent: number): Promise<void>;

  // Events
  getEvents(): Promise<(Event & { voteCount: number })[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<Event | undefined>;

  // Donations & Cypher Passes
  createDonation(donation: InsertDonation): Promise<Donation>;
  getUserDonations(userId: number, year: number): Promise<Donation[]>;
  getUserCypherPass(userId: number, year: number): Promise<CypherPass | undefined>;
  grantCypherPass(userId: number, year: number): Promise<CypherPass>;

  // Voting
  castVote(vote: InsertVote): Promise<Vote>;
  getUserVotesForEvent(userId: number, eventId: number): Promise<Vote[]>;
  getVoteLeaderboard(eventId: number): Promise<{ artistUserId: number; username: string; displayName: string | null; voteCount: number }[]>;

  // Ministry
  getMinistryArtists(): Promise<User[]>;
  getMinistryStats(): Promise<{ passHolders: number; totalVotes: number }>;

  // Contribution Negotiations
  upsertNegotiation(data: { projectId: number; userId: number; requestedPercent: number; exchangeType: string }): Promise<ContributionNegotiation>;
  getProjectNegotiations(projectId: number): Promise<(ContributionNegotiation & { user: User })[]>;
  getUserNegotiation(projectId: number, userId: number): Promise<ContributionNegotiation | undefined>;
  updateNegotiationStatus(id: number, projectId: number, status: string): Promise<ContributionNegotiation | undefined>;

  // License Unlocks
  unlockLicense(submissionId: number, userId: number, amount: number): Promise<LicenseUnlock>;
  getLicenseUnlocks(submissionId: number): Promise<LicenseUnlock[]>;
  hasUserUnlockedLicense(submissionId: number, userId: number): Promise<boolean>;

  // Launch Status
  getProjectLaunchStatus(projectId: number): Promise<LaunchStatus>;

  // Social – Follows
  followUser(followerId: number, followeeId: number): Promise<Follow>;
  unfollowUser(followerId: number, followeeId: number): Promise<void>;
  isFollowing(followerId: number, followeeId: number): Promise<boolean>;
  getFollowers(userId: number): Promise<SafeUser[]>;
  getFollowing(userId: number): Promise<SafeUser[]>;
  getPublicProfile(username: string, viewerUserId?: number): Promise<PublicProfile | undefined>;
  getFeed(userId: number): Promise<FeedItem[]>;

  // Social – Messages
  sendMessage(senderId: number, receiverId: number, body: string): Promise<Message>;
  getThread(userId1: number, userId2: number): Promise<(Message & { sender: SafeUser; receiver: SafeUser })[]>;
  getConversations(userId: number): Promise<Conversation[]>;
  markThreadRead(viewerId: number, partnerId: number): Promise<void>;
  getUnreadCount(userId: number): Promise<number>;

  // Playlists
  createPlaylist(userId: number, name: string): Promise<Playlist>;
  getPlaylists(userId: number): Promise<(Playlist & { trackCount: number })[]>;
  deletePlaylist(id: number, userId: number): Promise<void>;
  addTrackToPlaylist(playlistId: number, submissionId: number, userId: number): Promise<PlaylistTrack>;
  removeTrackFromPlaylist(playlistId: number, submissionId: number, userId: number): Promise<void>;
  reorderPlaylistTracks(playlistId: number, order: number[], userId: number): Promise<void>;
  getPlaylistWithTracks(id: number, userId: number): Promise<(Playlist & { tracks: (PlaylistTrack & { submission: Submission & { user: User } })[] }) | undefined>;
  getRadioTracks(userId: number, isSubscribed: boolean): Promise<(Submission & { user: User; project: Project })[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  /** Only used to roll back a half-created account during registration. */
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ── Credentials ─────────────────────────────────────────────────────────────
  // Kept in their own table so the password hash and email are never part of a
  // serialized User, which the API nests inside many other responses.

  async getCredentialByEmail(email: string): Promise<UserCredential | undefined> {
    const [cred] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.email, email.toLowerCase()));
    return cred;
  }

  async getCredentialByUserId(userId: number): Promise<UserCredential | undefined> {
    const [cred] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));
    return cred;
  }

  async createCredential(userId: number, email: string, passwordHash: string): Promise<UserCredential> {
    const [cred] = await db
      .insert(userCredentials)
      .values({ userId, email: email.toLowerCase(), passwordHash })
      .returning();
    return cred;
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await db
      .update(userCredentials)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(userCredentials.userId, userId));
  }

  async updateUserSubscription(id: number, isSubscribed: boolean): Promise<User> {
    const [user] = await db.update(users).set({ isSubscribed }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserRoles(id: number, roles: string[]): Promise<User> {
    const [user] = await db.update(users).set({ roles }).where(eq(users.id, id)).returning();
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async updateUserOnboarding(id: number, agreedAt: Date): Promise<User> {
    const [user] = await db.update(users)
      .set({ onboardingComplete: true, agreedAt })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeCustomerId(id: number, stripeCustomerId: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserProfile(id: number, data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getProjects(): Promise<(Project & { creator: User; investmentCount: number })[]> {
    const allProjects = await db.select().from(projects);
    const results = [];
    for (const project of allProjects) {
      const [creator] = await db.select().from(users).where(eq(users.id, project.creatorId));
      const projectInvestments = await db.select().from(investments).where(eq(investments.projectId, project.id));
      results.push({ ...project, creator, investmentCount: projectInvestments.length });
    }
    return results;
  }

  async getProject(id: number): Promise<(Project & {
    creator: User,
    files: (File & { uploader: User })[],
    investments: (Investment & { investor: User })[],
    submissions: (Submission & { user: User })[],
    coproducers: (Coproducer & { user: User })[],
    royaltySplits: RoyaltySplit[],
  }) | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return undefined;

    const [creator] = await db.select().from(users).where(eq(users.id, project.creatorId));

    const projectFiles = await db.select().from(files).where(eq(files.projectId, id));
    const filesWithUploaders = await Promise.all(projectFiles.map(async (f) => {
      const [uploader] = await db.select().from(users).where(eq(users.id, f.uploaderId));
      return { ...f, uploader };
    }));

    const projectInvestments = await db.select().from(investments).where(eq(investments.projectId, id));
    const investmentsWithInvestors = await Promise.all(projectInvestments.map(async (i) => {
      const [investor] = await db.select().from(users).where(eq(users.id, i.investorId));
      return { ...i, investor };
    }));

    const projectSubmissions = await this.getProjectSubmissions(id);
    const projectCoproducers = await this.getCoproducers(id);
    const projectRoyaltySplits = await this.getRoyaltySplits(id);

    return {
      ...project,
      creator,
      files: filesWithUploaders,
      investments: investmentsWithInvestors,
      submissions: projectSubmissions,
      coproducers: projectCoproducers,
      royaltySplits: projectRoyaltySplits,
    };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(insertFile).returning();
    return file;
  }

  async createInvestment(insertInvestment: InsertInvestment): Promise<Investment> {
    const [investment] = await db.insert(investments).values(insertInvestment).returning();
    return investment;
  }

  async getProjectInvestments(projectId: number): Promise<Investment[]> {
    return await db.select().from(investments).where(eq(investments.projectId, projectId));
  }

  async getProjectSubmissions(projectId: number, types?: string[]): Promise<(Submission & { user: User })[]> {
    let rows: Submission[];
    if (types && types.length > 0) {
      rows = await db.select().from(submissions)
        .where(eq(submissions.projectId, projectId))
        .then(all => all.filter(s => types.includes(s.type)));
    } else {
      rows = await db.select().from(submissions).where(eq(submissions.projectId, projectId));
    }
    return await Promise.all(rows.map(async (s) => {
      const [user] = await db.select().from(users).where(eq(users.id, s.userId));
      return { ...s, user };
    }));
  }

  async getAllSubmissions(types?: string[]): Promise<(Submission & { user: User; project: Project })[]> {
    const rows = await db.select().from(submissions);
    const filtered = types && types.length > 0 ? rows.filter(s => types.includes(s.type)) : rows;
    return await Promise.all(filtered.map(async (s) => {
      const [user] = await db.select().from(users).where(eq(users.id, s.userId));
      const [project] = await db.select().from(projects).where(eq(projects.id, s.projectId));
      return { ...s, user, project };
    }));
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values(insertSubmission).returning();
    return submission;
  }

  async createOffering(insertOffering: InsertOffering): Promise<Offering> {
    const [offering] = await db.insert(offerings).values(insertOffering).returning();
    return offering;
  }

  async getProjectOfferings(projectId: number): Promise<(Offering & { user: User })[]> {
    const rows = await db.select().from(offerings).where(eq(offerings.projectId, projectId));
    return await Promise.all(rows.map(async (o) => {
      const [user] = await db.select().from(users).where(eq(users.id, o.userId));
      return { ...o, user };
    }));
  }

  async getCoproducers(projectId: number): Promise<(Coproducer & { user: User })[]> {
    const rows = await db.select().from(coproducers).where(eq(coproducers.projectId, projectId));
    return await Promise.all(rows.map(async (c) => {
      const [user] = await db.select().from(users).where(eq(users.id, c.userId));
      return { ...c, user };
    }));
  }

  async selectCoproducers(projectId: number): Promise<(Coproducer & { user: User })[]> {
    await db.delete(coproducers).where(eq(coproducers.projectId, projectId));

    const projectOfferingsRows = await db.select().from(offerings).where(eq(offerings.projectId, projectId));

    const offeringsByUser = new Map<number, number>();
    for (const o of projectOfferingsRows) {
      const prev = offeringsByUser.get(o.userId) ?? 0;
      offeringsByUser.set(o.userId, prev + Number(o.amount));
    }

    const sortedUsers = Array.from(offeringsByUser.entries()).sort((a, b) => b[1] - a[1]);

    const top3 = sortedUsers.slice(0, 3).map(([userId]) => userId);
    const remaining = sortedUsers.slice(3).map(([userId]) => userId);

    const shuffled = remaining.sort(() => Math.random() - 0.5);
    const random4 = shuffled.slice(0, 4);

    const toInsert: InsertCoproducer[] = [
      ...top3.map(userId => ({ projectId, userId, selectionType: 'top' as const, percentage: 3 })),
      ...random4.map(userId => ({ projectId, userId, selectionType: 'random' as const, percentage: 3 })),
    ];

    if (toInsert.length === 0) return [];

    await db.insert(coproducers).values(toInsert);
    return this.getCoproducers(projectId);
  }

  async getRoyaltySplits(projectId: number): Promise<RoyaltySplit[]> {
    return await db.select().from(royaltySplits).where(eq(royaltySplits.projectId, projectId));
  }

  async initializeRoyaltySplits(projectId: number): Promise<void> {
    const defaults: InsertRoyaltySplit[] = [
      { projectId, role: "artist", percentage: "45", notes: "Artist/Vocalist — Master recording (negotiable)" },
      { projectId, role: "co-producers", percentage: "21", notes: "Co-Producers (3+4) — 3% Master each × 7 blessed creators" },
      { projectId, role: "ministry", percentage: "5", notes: "Ministry Platform Bestowal (Master) + optional 5% publishing admin" },
      { projectId, role: "producers", percentage: "0", notes: "Investment equity % assigned per backer" },
      { projectId, role: "videographer", percentage: "0", notes: "Videographer/Marketing — negotiable up to 10% per contribution" },
      { projectId, role: "engineer", percentage: "0", notes: "Recording Engineer — negotiable up to 10% per contribution" },
      { projectId, role: "dancer", percentage: "0", notes: "Dancer/Actor — negotiable up to 10% per contribution" },
    ];
    await db.insert(royaltySplits).values(defaults);
  }

  async upsertProducerSplit(projectId: number, totalPercent: number): Promise<void> {
    const existing = await db.select().from(royaltySplits)
      .where(eq(royaltySplits.projectId, projectId))
      .then(rows => rows.find(r => r.role === "producers"));
    if (existing) {
      await db.update(royaltySplits)
        .set({ percentage: totalPercent.toString() })
        .where(eq(royaltySplits.id, existing.id));
    } else {
      await db.insert(royaltySplits).values({
        projectId,
        role: "producers",
        percentage: totalPercent.toString(),
        notes: "Investment equity % assigned per backer",
      });
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async getEvents(): Promise<(Event & { voteCount: number })[]> {
    const allEvents = await db.select().from(events);
    const allVotes = await db.select().from(votes);
    return allEvents.map(e => ({
      ...e,
      voteCount: allVotes.filter(v => v.eventId === e.id).length,
    }));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  // ── Donations & Cypher Passes ───────────────────────────────────────────────

  async createDonation(insertDonation: InsertDonation): Promise<Donation> {
    const [donation] = await db.insert(donations).values(insertDonation).returning();
    return donation;
  }

  async getUserDonations(userId: number, year: number): Promise<Donation[]> {
    return await db.select().from(donations)
      .where(and(eq(donations.userId, userId), eq(donations.year, year)));
  }

  async getUserCypherPass(userId: number, year: number): Promise<CypherPass | undefined> {
    const [pass] = await db.select().from(cypherPasses)
      .where(and(eq(cypherPasses.userId, userId), eq(cypherPasses.year, year)));
    return pass;
  }

  async grantCypherPass(userId: number, year: number): Promise<CypherPass> {
    const [pass] = await db.insert(cypherPasses).values({ userId, year }).returning();
    return pass;
  }

  // ── Voting ──────────────────────────────────────────────────────────────────

  async castVote(insertVote: InsertVote): Promise<Vote> {
    const [vote] = await db.insert(votes).values(insertVote).returning();
    return vote;
  }

  async getUserVotesForEvent(userId: number, eventId: number): Promise<Vote[]> {
    return await db.select().from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.eventId, eventId)));
  }

  async getVoteLeaderboard(eventId: number): Promise<{ artistUserId: number; username: string; displayName: string | null; voteCount: number }[]> {
    const eventVotes = await db.select().from(votes).where(eq(votes.eventId, eventId));
    const countMap = new Map<number, number>();
    for (const v of eventVotes) {
      countMap.set(v.artistUserId, (countMap.get(v.artistUserId) ?? 0) + 1);
    }
    const results = await Promise.all(Array.from(countMap.entries()).map(async ([artistUserId, voteCount]) => {
      const [user] = await db.select().from(users).where(eq(users.id, artistUserId));
      return { artistUserId, username: user?.username ?? "unknown", displayName: user?.displayName ?? null, voteCount };
    }));
    return results.sort((a, b) => b.voteCount - a.voteCount);
  }

  // ── Ministry ────────────────────────────────────────────────────────────────

  async getMinistryArtists(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.filter(u => (u.roles ?? []).includes("ministry"));
  }

  async getMinistryStats(): Promise<{ passHolders: number; totalVotes: number }> {
    const allPasses = await db.select().from(cypherPasses);
    const allVotes = await db.select().from(votes);
    return { passHolders: allPasses.length, totalVotes: allVotes.length };
  }

  // ── Contribution Negotiations ───────────────────────────────────────────────

  async upsertNegotiation(data: { projectId: number; userId: number; requestedPercent: number; exchangeType: string }): Promise<ContributionNegotiation> {
    const existing = await db.select().from(contributionNegotiations)
      .where(and(
        eq(contributionNegotiations.projectId, data.projectId),
        eq(contributionNegotiations.userId, data.userId),
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(contributionNegotiations)
        .set({
          requestedPercent: data.requestedPercent.toString(),
          exchangeType: data.exchangeType,
          status: "pending",
        })
        .where(eq(contributionNegotiations.id, existing[0].id))
        .returning();
      return updated;
    }
    const [neg] = await db.insert(contributionNegotiations).values({
      projectId: data.projectId,
      userId: data.userId,
      requestedPercent: data.requestedPercent.toString(),
      exchangeType: data.exchangeType,
      status: "pending",
    }).returning();
    return neg;
  }

  async getProjectNegotiations(projectId: number): Promise<(ContributionNegotiation & { user: User })[]> {
    const rows = await db.select().from(contributionNegotiations)
      .where(eq(contributionNegotiations.projectId, projectId));
    return await Promise.all(rows.map(async (n) => {
      const [user] = await db.select().from(users).where(eq(users.id, n.userId));
      return { ...n, user };
    }));
  }

  async getUserNegotiation(projectId: number, userId: number): Promise<ContributionNegotiation | undefined> {
    const [neg] = await db.select().from(contributionNegotiations)
      .where(and(
        eq(contributionNegotiations.projectId, projectId),
        eq(contributionNegotiations.userId, userId),
      ));
    return neg;
  }

  async updateNegotiationStatus(id: number, projectId: number, status: string): Promise<ContributionNegotiation | undefined> {
    const [neg] = await db.update(contributionNegotiations)
      .set({ status })
      .where(and(eq(contributionNegotiations.id, id), eq(contributionNegotiations.projectId, projectId)))
      .returning();
    return neg;
  }

  // ── License Unlocks ─────────────────────────────────────────────────────────

  async unlockLicense(submissionId: number, userId: number, amount: number): Promise<LicenseUnlock> {
    const [unlock] = await db.insert(licenseUnlocks).values({
      submissionId,
      userId,
      amount: amount.toString(),
    }).returning();
    return unlock;
  }

  async getLicenseUnlocks(submissionId: number): Promise<LicenseUnlock[]> {
    return await db.select().from(licenseUnlocks).where(eq(licenseUnlocks.submissionId, submissionId));
  }

  async hasUserUnlockedLicense(submissionId: number, userId: number): Promise<boolean> {
    const rows = await db.select().from(licenseUnlocks)
      .where(and(eq(licenseUnlocks.submissionId, submissionId), eq(licenseUnlocks.userId, userId)));
    return rows.length > 0;
  }

  // ── Public Launch Status ────────────────────────────────────────────────────

  async getProjectLaunchStatus(projectId: number): Promise<LaunchStatus> {
    const GOAL = 300;

    const offeringRows = await db.select().from(offerings).where(eq(offerings.projectId, projectId));
    const backerTotal = offeringRows.reduce((sum, o) => sum + Number(o.amount), 0);
    const backerProgress = Math.min(100, Math.round((backerTotal / GOAL) * 100));

    const allSubs = await db.select().from(submissions).where(eq(submissions.projectId, projectId));

    const allSubUsers = await Promise.all(allSubs.map(async (s) => {
      const [user] = await db.select().from(users).where(eq(users.id, s.userId));
      return { sub: s, user };
    }));

    const categories: Record<string, boolean> = {};

    for (const cat of LAUNCH_CATEGORIES) {
      if (cat === "ministry") {
        categories[cat] = allSubUsers.some(({ user }) => (user?.roles ?? []).includes("ministry"));
      } else {
        const catTypes = (SUBMISSION_TYPES as Record<string, readonly string[]>)[cat] ?? [];
        categories[cat] = allSubs.some(s => catTypes.includes(s.type));
      }
    }

    const categoriesFulfilled = Object.values(categories).filter(Boolean).length;
    const canLaunch = backerTotal >= GOAL && categoriesFulfilled >= 4;

    return {
      backerTotal,
      backerGoal: GOAL,
      backerProgress,
      categories,
      categoriesFulfilled,
      canLaunch,
    };
  }

  // ── Social – Follows ────────────────────────────────────────────────────────

  async followUser(followerId: number, followeeId: number): Promise<Follow> {
    const existing = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
    if (existing.length > 0) return existing[0];
    const [follow] = await db.insert(follows).values({ followerId, followeeId }).returning();
    return follow;
  }

  async unfollowUser(followerId: number, followeeId: number): Promise<void> {
    await db.delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  }

  async isFollowing(followerId: number, followeeId: number): Promise<boolean> {
    const rows = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
    return rows.length > 0;
  }

  async getFollowers(userId: number): Promise<SafeUser[]> {
    const rows = await db.select().from(follows).where(eq(follows.followeeId, userId));
    return (await Promise.all(rows.map(async (f) => {
      const [user] = await db.select().from(users).where(eq(users.id, f.followerId));
      return user ? toSafeUser(user) : null;
    }))).filter((u): u is SafeUser => u !== null);
  }

  async getFollowing(userId: number): Promise<SafeUser[]> {
    const rows = await db.select().from(follows).where(eq(follows.followerId, userId));
    return (await Promise.all(rows.map(async (f) => {
      const [user] = await db.select().from(users).where(eq(users.id, f.followeeId));
      return user ? toSafeUser(user) : null;
    }))).filter((u): u is SafeUser => u !== null);
  }

  async getPublicProfile(username: string, viewerUserId?: number): Promise<PublicProfile | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) return undefined;

    const followerRows = await db.select().from(follows).where(eq(follows.followeeId, user.id));
    const followingRows = await db.select().from(follows).where(eq(follows.followerId, user.id));
    const submissionRows = await db.select().from(submissions).where(eq(submissions.userId, user.id));
    const projectRows = await db.select().from(projects).where(eq(projects.creatorId, user.id));

    const isFollowing = viewerUserId
      ? followerRows.some(f => f.followerId === viewerUserId)
      : false;

    // Projects the user contributed to (via submissions) but did NOT create
    const ownProjectIds = new Set(projectRows.map(p => p.id));
    const contributedProjectIds = Array.from(new Set(submissionRows.map(s => s.projectId))).filter(id => !ownProjectIds.has(id));
    const collaboratedProjects: { id: number; title: string; description: string }[] = [];
    for (const pid of contributedProjectIds) {
      const [project] = await db.select().from(projects).where(eq(projects.id, pid));
      if (project) collaboratedProjects.push({ id: project.id, title: project.title, description: project.description });
    }

    return {
      ...toSafeUser(user),
      followerCount: followerRows.length,
      followingCount: followingRows.length,
      submissionCount: submissionRows.length,
      projectCount: projectRows.length,
      isFollowing,
      collaboratedProjects,
    };
  }

  async getFeed(userId: number): Promise<FeedItem[]> {
    const followingRows = await db.select().from(follows).where(eq(follows.followerId, userId));
    const followingIds = followingRows.map(f => f.followeeId);

    if (followingIds.length === 0) return [];

    // Viewer subscription status — private submissions only shown to subscribers
    const [viewer] = await db.select().from(users).where(eq(users.id, userId));
    const isSubscribed = !!viewer?.isSubscribed;

    const recentSubs = await db.select().from(submissions)
      .where(inArray(submissions.userId, followingIds))
      .orderBy(desc(submissions.createdAt))
      .limit(40);

    const recentProjects = await db.select().from(projects)
      .where(inArray(projects.creatorId, followingIds))
      .orderBy(desc(projects.createdAt))
      .limit(20);

    const items: FeedItem[] = [];

    for (const sub of recentSubs) {
      // Enforce the same visibility policy as /api/projects/:id/submissions
      if (!isSubscribed && sub.visibility !== "public") continue;

      const [actor] = await db.select().from(users).where(eq(users.id, sub.userId));
      const [project] = await db.select().from(projects).where(eq(projects.id, sub.projectId));
      if (!actor || !project) continue;
      items.push({
        id: sub.id,
        type: "submission",
        actorId: actor.id,
        actorUsername: actor.username,
        actorDisplayName: actor.displayName ?? null,
        actorAvatarUrl: actor.avatarUrl ?? null,
        title: sub.title,
        subType: sub.type,
        projectTitle: project.title,
        projectId: sub.projectId,
        createdAt: sub.createdAt ?? new Date(),
      });
    }

    for (const project of recentProjects) {
      const [actor] = await db.select().from(users).where(eq(users.id, project.creatorId));
      if (!actor) continue;
      items.push({
        id: project.id,
        type: "project",
        actorId: actor.id,
        actorUsername: actor.username,
        actorDisplayName: actor.displayName ?? null,
        actorAvatarUrl: actor.avatarUrl ?? null,
        title: project.title,
        subType: undefined,
        projectTitle: project.title,
        projectId: project.id,
        createdAt: project.createdAt ?? new Date(),
      });
    }

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── Social – Messages ────────────────────────────────────────────────────────

  async sendMessage(senderId: number, receiverId: number, body: string): Promise<Message> {
    const [msg] = await db.insert(messages).values({ senderId, receiverId, body }).returning();
    return msg;
  }

  async getThread(userId1: number, userId2: number): Promise<(Message & { sender: SafeUser; receiver: SafeUser })[]> {
    const rows = await db.select().from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1)),
        )
      )
      .orderBy(messages.createdAt);

    return await Promise.all(rows.map(async (m) => {
      const [sender] = await db.select().from(users).where(eq(users.id, m.senderId));
      const [receiver] = await db.select().from(users).where(eq(users.id, m.receiverId));
      return { ...m, sender: toSafeUser(sender), receiver: toSafeUser(receiver) };
    }));
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    const allMsgs = await db.select().from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(desc(messages.createdAt));

    const threadMap = new Map<number, typeof allMsgs[0]>();
    for (const msg of allMsgs) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!threadMap.has(partnerId)) threadMap.set(partnerId, msg);
    }

    const convos: Conversation[] = [];
    for (const [partnerId, lastMsg] of Array.from(threadMap.entries())) {
      const [partner] = await db.select().from(users).where(eq(users.id, partnerId));
      if (!partner) continue;

      const unreadRows = await db.select().from(messages)
        .where(and(
          eq(messages.senderId, partnerId),
          eq(messages.receiverId, userId),
          sql`${messages.readAt} IS NULL`,
        ));

      convos.push({
        partnerId,
        partnerUsername: partner.username,
        partnerDisplayName: partner.displayName ?? null,
        partnerAvatarUrl: partner.avatarUrl ?? null,
        lastMessage: lastMsg.body,
        lastMessageAt: lastMsg.createdAt ?? new Date(),
        unreadCount: unreadRows.length,
      });
    }

    return convos.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async markThreadRead(viewerId: number, partnerId: number): Promise<void> {
    await db.update(messages)
      .set({ readAt: new Date() })
      .where(and(
        eq(messages.senderId, partnerId),
        eq(messages.receiverId, viewerId),
        sql`${messages.readAt} IS NULL`,
      ));
  }

  async getUnreadCount(userId: number): Promise<number> {
    const rows = await db.select().from(messages)
      .where(and(eq(messages.receiverId, userId), sql`${messages.readAt} IS NULL`));
    return rows.length;
  }

  // ── Playlists ────────────────────────────────────────────────────────────────

  async createPlaylist(userId: number, name: string): Promise<Playlist> {
    const [pl] = await db.insert(playlists).values({ userId, name }).returning();
    return pl;
  }

  async getPlaylists(userId: number): Promise<(Playlist & { trackCount: number })[]> {
    const all = await db.select().from(playlists).where(eq(playlists.userId, userId)).orderBy(desc(playlists.createdAt));
    const result = await Promise.all(all.map(async pl => {
      const tracks = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, pl.id));
      return { ...pl, trackCount: tracks.length };
    }));
    return result;
  }

  async deletePlaylist(id: number, userId: number): Promise<void> {
    const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
    if (!playlist) throw new Error("Playlist not found or not owned by user");
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async addTrackToPlaylist(playlistId: number, submissionId: number, userId: number): Promise<PlaylistTrack> {
    const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
    if (!playlist) throw new Error("Playlist not found or not owned by user");

    // Access control: verify user can access this submission
    const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
    if (!sub) throw new Error("Submission not found");
    const [requestingUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSubscribed = requestingUser?.isSubscribed ?? false;
    if (sub.visibility !== "public" && !isSubscribed && sub.userId !== userId) {
      throw new Error("You do not have access to this submission");
    }

    const existing = await db.select().from(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.submissionId, submissionId)));
    if (existing.length > 0) return existing[0];
    const allTracks = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    const [track] = await db.insert(playlistTracks).values({ playlistId, submissionId, position: allTracks.length }).returning();
    return track;
  }

  async removeTrackFromPlaylist(playlistId: number, submissionId: number, userId: number): Promise<void> {
    const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
    if (!playlist) throw new Error("Playlist not found or not owned by user");
    await db.delete(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.submissionId, submissionId)));
  }

  async reorderPlaylistTracks(playlistId: number, order: number[], userId: number): Promise<void> {
    const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
    if (!playlist) throw new Error("Playlist not found or not owned by user");
    for (let i = 0; i < order.length; i++) {
      await db.update(playlistTracks)
        .set({ position: i })
        .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.submissionId, order[i])));
    }
  }

  async getPlaylistWithTracks(id: number, userId: number): Promise<(Playlist & { tracks: (PlaylistTrack & { submission: Submission & { user: User } })[] }) | undefined> {
    const [playlist] = await db.select().from(playlists).where(and(eq(playlists.id, id), eq(playlists.userId, userId)));
    if (!playlist) return undefined;
    const [requestingUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSubscribed = requestingUser?.isSubscribed ?? false;
    const tracks = await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, id)).orderBy(playlistTracks.position);
    const enriched = await Promise.all(tracks.map(async t => {
      const [sub] = await db.select().from(submissions).where(eq(submissions.id, t.submissionId));
      if (!sub) return null;
      // Access control: only return tracks the user can access
      if (sub.visibility !== "public" && !isSubscribed && sub.userId !== userId) return null;
      const [creator] = await db.select().from(users).where(eq(users.id, sub.userId));
      return { ...t, submission: { ...sub, user: creator } };
    }));
    return { ...playlist, tracks: enriched.filter(Boolean) as any };
  }

  async getRadioTracks(userId: number, isSubscribed: boolean): Promise<(Submission & { user: User; project: Project })[]> {
    const allSubs = await db.select().from(submissions).orderBy(sql`RANDOM()`);
    const result = await Promise.all(allSubs.map(async sub => {
      if (!isSubscribed && sub.visibility !== "public" && sub.userId !== userId) return null;
      const [creator] = await db.select().from(users).where(eq(users.id, sub.userId));
      const [proj] = await db.select().from(projects).where(eq(projects.id, sub.projectId));
      if (!creator || !proj) return null;
      return { ...sub, user: creator, project: proj };
    }));
    return result.filter(Boolean) as any;
  }
}

export const storage = new DatabaseStorage();
