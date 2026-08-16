import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Ticket, Trophy, Users, Star,
  ChevronRight, Loader2, Crown, Music2, ShieldCheck, Heart,
  Wallet, Sparkles, Vote, Lock, CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format, formatDistanceToNow, isPast } from "date-fns";

// ── Donation allocation breakdown ─────────────────────────────────────────────
const DONATION_ALLOC = [
  { label: "Artists", percent: 45, color: "bg-violet-500", icon: Music2, description: "Direct bestowal to artists and performers" },
  { label: "Hearths", percent: 15, color: "bg-rose-400", icon: Heart, description: "Community land & homes for members" },
  { label: "Event Fund", percent: 15, color: "bg-amber-500", icon: Sparkles, description: "Cypher production & venue costs" },
  { label: "Savings", percent: 15, color: "bg-emerald-500", icon: Wallet, description: "Movement reserve treasury" },
  { label: "Marketing", percent: 10, color: "bg-fuchsia-500", icon: CheckCircle2, description: "Outreach, branding & creative campaigns" },
];

// ── Countdown component ──────────────────────────────────────────────────────
function Countdown({ targetDate }: { targetDate: Date }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return <span className="text-muted-foreground">Event has passed</span>;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex gap-3 flex-wrap" data-testid="countdown-timer">
      {[{ val: days, label: "Days" }, { val: hours, label: "Hours" }, { val: mins, label: "Mins" }, { val: secs, label: "Secs" }].map(({ val, label }) => (
        <div key={label} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2 min-w-[64px]">
          <span className="text-2xl font-display font-bold tabular-nums text-primary">{String(val).padStart(2, "0")}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Vote Leaderboard ─────────────────────────────────────────────────────────
function VoteLeaderboard({ eventId }: { eventId: number }) {
  const { data: leaderboard = [] } = useQuery<{ artistUserId: number; username: string; displayName: string | null; voteCount: number }[]>({
    queryKey: ["/api/events", eventId, "votes"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/votes`);
      return res.json();
    },
  });

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm" data-testid="leaderboard-empty">
        No votes cast yet — be the first to bestow your support.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="vote-leaderboard">
      {leaderboard.map((entry, i) => (
        <div
          key={entry.artistUserId}
          className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
          data-testid={`leaderboard-row-${entry.artistUserId}`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            i === 0 ? "bg-amber-500/20 text-amber-400" :
            i === 1 ? "bg-slate-400/20 text-slate-300" :
            i === 2 ? "bg-orange-600/20 text-orange-400" :
            "bg-white/10 text-muted-foreground"
          }`}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{entry.displayName || entry.username}</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-mono font-bold text-primary">
            <Trophy className="w-3.5 h-3.5" />
            {entry.voteCount}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Voting Panel ─────────────────────────────────────────────────────────────
function VotingPanel({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const { data: artists = [] } = useQuery<{ id: number; username: string; displayName: string | null }[]>({
    queryKey: ["/api/ministry/artists"],
  });

  const { data: myVoteInfo } = useQuery<{ count: number; votes: any[] }>({
    queryKey: ["/api/events", eventId, "my-votes"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/my-votes`);
      return res.json();
    },
  });

  const myVoteCount = myVoteInfo?.count ?? 0;

  const castVote = useMutation({
    mutationFn: async (artistUserId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/votes`, { artistUserId });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to cast vote");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "my-votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ministry/stats"] });
      toast({ title: "Vote cast", description: "Your vote has been bestowed." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not cast vote", description: err.message, variant: "destructive" });
    },
  });

  const votesLeft = 4 - myVoteCount;

  return (
    <div className="space-y-4" data-testid="voting-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {votesLeft > 0 ? `${votesLeft} vote${votesLeft !== 1 ? "s" : ""} remaining` : "All votes cast"}
        </p>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < myVoteCount ? "bg-primary" : "bg-white/10"}`} />
          ))}
        </div>
      </div>

      {artists.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No ministry artists available yet.</p>
      ) : (
        <div className="space-y-2">
          {artists.map(artist => (
            <div
              key={artist.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
              data-testid={`artist-card-${artist.id}`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0">
                {(artist.displayName || artist.username).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{artist.displayName || artist.username}</p>
                <p className="text-xs text-muted-foreground">Ministry Artist</p>
              </div>
              <Button
                size="sm"
                onClick={() => castVote.mutate(artist.id)}
                disabled={votesLeft === 0 || castVote.isPending}
                className="flex-shrink-0 text-xs"
                data-testid={`button-vote-${artist.id}`}
              >
                {castVote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Vote className="w-3 h-3 mr-1" />}
                Vote
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Donation Form ─────────────────────────────────────────────────────────────
function DonationPanel() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");

  const { data: summary, isLoading: summaryLoading } = useQuery<{
    donations: any[];
    yearTotal: number;
    hasPass: boolean;
    pass: any | null;
  }>({
    queryKey: ["/api/donations/me"],
  });

  const logDonation = useMutation({
    mutationFn: async (amt: number) => {
      const res = await apiRequest("POST", "/api/donations", { amount: amt });
      return res.json();
    },
    onSuccess: (_, amt) => {
      queryClient.invalidateQueries({ queryKey: ["/api/donations/me"] });
      const newTotal = (summary?.yearTotal ?? 0) + amt;
      const earned = !summary?.hasPass && (amt >= 700 || newTotal >= 1000);
      toast({
        title: earned ? "Cypher Pass Earned!" : "Bestowal logged",
        description: earned
          ? "You've qualified for a Cypher Pass — 4 votes are now yours."
          : `$${amt.toFixed(2)} bestowed. Year total: $${newTotal.toFixed(2)}`,
      });
      setAmount("");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not log donation.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) return;
    logDonation.mutate(amt);
  };

  const yearTotal = summary?.yearTotal ?? 0;
  const hasPass = summary?.hasPass ?? false;
  const progress700 = Math.min(100, (yearTotal / 700) * 100);
  const progress1000 = Math.min(100, (yearTotal / 1000) * 100);

  return (
    <div className="glass-panel rounded-3xl p-6 space-y-6" data-testid="donation-panel">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
          <Ticket className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg">Cypher Pass Bestowal</h3>
          <p className="text-xs text-muted-foreground">Log your contribution to qualify</p>
        </div>
        {hasPass && (
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Pass Holder
          </span>
        )}
      </div>

      {/* Progress toward pass */}
      {!hasPass && !summaryLoading && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Single Donation ($700)</span>
              <span className="font-mono">${yearTotal.toFixed(0)} / $700</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress700}%` }}
                data-testid="progress-700"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cumulative ($1,000)</span>
              <span className="font-mono">${yearTotal.toFixed(0)} / $1,000</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${progress1000}%` }}
                data-testid="progress-1000"
              />
            </div>
          </div>
        </div>
      )}

      {hasPass ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">Cypher Pass {summary?.pass?.year ?? new Date().getFullYear()} Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">You have 4 votes to bestow on ministry artists below.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bestowal Amount ($)</label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 700"
              className="bg-background/50 border-white/10 font-mono"
              data-testid="input-donation-amount"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={logDonation.isPending || !amount}
            data-testid="button-log-donation"
          >
            {logDonation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
            Log Bestowal
          </Button>
        </form>
      )}

      {/* Allocation breakdown */}
      <div className="pt-2 border-t border-white/5 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bestowal Allocation</p>
        <div className="w-full h-2 rounded-full overflow-hidden flex gap-0.5" data-testid="allocation-bar">
          {DONATION_ALLOC.map(a => (
            <div key={a.label} className={`${a.color} h-full`} style={{ width: `${a.percent}%` }} title={`${a.label}: ${a.percent}%`} />
          ))}
        </div>
        <div className="space-y-2">
          {DONATION_ALLOC.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.label} className="flex items-center gap-2.5" data-testid={`alloc-row-${a.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${a.color}`} />
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">{a.label} — {a.description}</span>
                <span className="text-xs font-mono font-bold tabular-nums">{a.percent}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Ministry Stats Banner ────────────────────────────────────────────────────
function MinistryStatsBanner() {
  const { data: stats } = useQuery<{ passHolders: number; totalVotes: number }>({
    queryKey: ["/api/ministry/stats"],
  });

  return (
    <div className="grid grid-cols-2 gap-4" data-testid="ministry-stats">
      <div className="glass-panel rounded-2xl p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-muted-foreground">Pass Holders</span>
        </div>
        <p className="text-2xl font-display font-bold tabular-nums" data-testid="stat-pass-holders">{stats?.passHolders ?? 0}</p>
      </div>
      <div className="glass-panel rounded-2xl p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Vote className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Votes Cast</span>
        </div>
        <p className="text-2xl font-display font-bold tabular-nums" data-testid="stat-total-votes">{stats?.totalVotes ?? 0}</p>
      </div>
    </div>
  );
}

// ── Main Events Page ──────────────────────────────────────────────────────────
export default function EventsPage() {
  const { user } = useAuth();

  const { data: eventsData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
  });

  const { data: donationSummary } = useQuery<{
    donations: any[];
    yearTotal: number;
    hasPass: boolean;
    pass: any | null;
  }>({
    queryKey: ["/api/donations/me"],
    enabled: !!user,
  });

  const hasPass = donationSummary?.hasPass ?? false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
          <Star className="w-4 h-4" />
          Free Soul Ecclesiastical Movement
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-3">
          The Cypher
        </h1>
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          The sacred annual gathering of the tribe. Bestow your contribution to earn a Cypher Pass and cast 4 votes for which ministry artists grace the stage.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Left column — event cards + leaderboard */}
        <div className="space-y-8">

          {/* Ministry Stats */}
          <MinistryStatsBanner />

          {/* Event Cards */}
          {eventsData.map((event: any) => {
            const eventDate = new Date(event.date);
            const isPastEvent = isPast(eventDate);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-b from-card/60 to-primary/5"
                data-testid={`event-card-${event.id}`}
              >
                {/* Event hero header */}
                <div className="p-6 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {isPastEvent ? "Past Event" : "Upcoming"}
                      </div>
                      <h2 className="text-2xl font-display font-bold">{event.title}</h2>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {event.voteCount} votes cast
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-primary/60" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary/60" />
                      {format(eventDate, "MMMM d, yyyy")}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{event.description}</p>

                  {/* Countdown */}
                  {!isPastEvent && (
                    <div className="space-y-2 mb-6">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Countdown — {formatDistanceToNow(eventDate, { addSuffix: true })}
                      </p>
                      <Countdown targetDate={eventDate} />
                    </div>
                  )}
                </div>

                {/* Leaderboard section */}
                <div className="border-t border-white/5 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-bold">Artist Vote Leaderboard</h3>
                  </div>
                  <VoteLeaderboard eventId={event.id} />
                </div>

                {/* Voting section — Cypher Pass holders only */}
                {user && hasPass && (
                  <div className="border-t border-white/5 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Vote className="w-4 h-4 text-primary" />
                      <h3 className="font-display font-bold">Cast Your 4 Votes</h3>
                    </div>
                    <VotingPanel eventId={event.id} />
                  </div>
                )}

                {user && !hasPass && (
                  <div className="border-t border-white/5 p-4 mx-6 mb-6 rounded-xl bg-white/[0.02] flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Log a $700+ bestowal or $1,000 cumulative to unlock voting.</span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {eventsData.length === 0 && (
            <div className="glass-panel rounded-3xl p-12 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No events scheduled yet.</p>
            </div>
          )}
        </div>

        {/* Right column — donation panel */}
        <div className="space-y-6 lg:sticky lg:top-24">
          {user && !user.isSubscribed ? (
            <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col items-center gap-4 text-center" data-testid="donation-panel-locked">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-lg mb-1">Membership Required</p>
                <p className="text-sm text-muted-foreground">Activate your Producers Circle Pro membership to log bestowals and earn Cypher Pass votes.</p>
              </div>
              <Link href="/account">
                <Button className="w-full" data-testid="button-activate-from-events">Activate Membership</Button>
              </Link>
            </div>
          ) : (
          <DonationPanel />
          )}

          {/* Cypher Pass badge teaser */}
          {hasPass && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-3xl p-5 border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent"
              data-testid="cypher-pass-badge"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold">Cypher Pass {donationSummary?.pass?.year ?? new Date().getFullYear()}</p>
                  <p className="text-xs text-muted-foreground">4 sacred votes • Annual holder</p>
                </div>
                <ShieldCheck className="w-5 h-5 text-primary ml-auto" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
