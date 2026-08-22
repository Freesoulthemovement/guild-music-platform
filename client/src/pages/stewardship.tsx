import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sprout, BookOpen, HandHeart, CheckCircle2, Clock, Home, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  CLERGY_STUDY_HOURS, CLERGY_SERVICE_HOURS,
  PASS_SERVICE_HOURS, PASS_STUDY_HOURS,
  type StewardshipStanding, type StewardshipEntry,
} from "@shared/schema";

/** Article II of the bylaws, stated plainly. */
const TIERS = [
  {
    key: "volunteer", label: "Volunteer", icon: Sprout,
    body: "Enter the community to receive aid, create, and study the Living Dictionary. No employment status, no wages.",
  },
  {
    key: "steward", label: "Steward", icon: Home,
    body: "Take a vow of stewardship and live on-site to manage the fields and energy systems. The ministry provides room, board and utilities.",
  },
  {
    key: "clergy", label: "Clergy", icon: Crown,
    body: `Study the Living Dictionary for ${CLERGY_STUDY_HOURS} hours and offer ${CLERGY_SERVICE_HOURS} hours of verified public service. Ordained by the board — the work speaks for itself.`,
  },
] as const;

function Bar({ value, goal, tone }: { value: number; goal: number; tone: string }) {
  const pct = Math.min(100, goal === 0 ? 100 : (value / goal) * 100);
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StewardshipPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [kind, setKind] = useState<"study" | "service">("service");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const { data } = useQuery<{ standing: StewardshipStanding; entries: StewardshipEntry[] }>({
    queryKey: ["/api/stewardship/me"],
    queryFn: async () => {
      const res = await fetch("/api/stewardship/me", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your standing");
      return res.json();
    },
    enabled: !!user,
  });

  const logHours = useMutation({
    mutationFn: async (body: { kind: string; hours: number; description: string }) => {
      const res = await fetch("/api/stewardship/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Could not log hours" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stewardship/me"] });
      setHours(""); setDescription("");
      toast({ title: "Logged", description: "Awaiting confirmation by the ministry." });
    },
    onError: (err: Error) =>
      toast({ title: "Could not log hours", description: err.message, variant: "destructive" }),
  });

  const standing = data?.standing;
  const entries = data?.entries ?? [];
  const canSubmit = Number(hours) > 0 && description.trim().length >= 10;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to the Circle
      </Link>

      <div className="glass-panel rounded-3xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Stewardship</h1>
            <p className="text-sm text-muted-foreground">Article II — the path to the land</p>
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Standing here is measured in study and service, not money. Hours carry
          no cash value and cannot be traded. What they unlock is the ministry's
          care — land, housing and provision for those who steward it.
        </p>
      </div>

      {standing && (
        <div className="glass-panel rounded-3xl p-6 mb-6" data-testid="standing-panel">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Your standing</p>
              <p className="text-2xl font-display font-bold capitalize" data-testid="text-tier">{standing.tier}</p>
            </div>
            {standing.clergyEligible && standing.tier !== "clergy" && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" data-testid="badge-eligible">
                Eligible for ordination
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="w-3.5 h-3.5" /> Study
                </span>
                <span className="font-mono">
                  <span className="text-emerald-400">{standing.verifiedStudyHours}</span>
                  <span className="text-muted-foreground"> / {CLERGY_STUDY_HOURS}h</span>
                </span>
              </div>
              <Bar value={standing.verifiedStudyHours} goal={CLERGY_STUDY_HOURS} tone="bg-emerald-500" />
              {standing.pendingStudyHours > 0 && (
                <p className="text-xs text-amber-400">{standing.pendingStudyHours}h awaiting confirmation</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <HandHeart className="w-3.5 h-3.5" /> Service
                </span>
                <span className="font-mono">
                  <span className="text-emerald-400">{standing.verifiedServiceHours}</span>
                  <span className="text-muted-foreground"> / {CLERGY_SERVICE_HOURS}h</span>
                </span>
              </div>
              <Bar value={standing.verifiedServiceHours} goal={CLERGY_SERVICE_HOURS} tone="bg-emerald-500" />
              {standing.pendingServiceHours > 0 && (
                <p className="text-xs text-amber-400">{standing.pendingServiceHours}h awaiting confirmation</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-6">
            {PASS_SERVICE_HOURS}h of verified service or {PASS_STUDY_HOURS}h of study
            also carries a Cypher Pass — no bestowal required.
          </p>
        </div>
      )}

      <div className="glass-panel rounded-3xl p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-1">Log hours</h2>
        <p className="text-xs text-muted-foreground mb-5">
          A ministry member confirms each entry before it counts. Log the work as it was done.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            logHours.mutate({ kind, hours: Number(hours), description: description.trim() });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {(["service", "study"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                  kind === k
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white"
                }`}
                data-testid={`kind-${k}`}
              >
                {k === "service" ? "Public service" : "Study"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Hours</label>
            <Input
              type="number" min="0.5" max="24" step="0.5"
              value={hours} onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              className="bg-background/50 border-white/10 font-mono"
              data-testid="input-hours"
            />
            <p className="text-xs text-muted-foreground/60">Up to 24 in one entry — log a long stretch as the days it took.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What was done</label>
            <Textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cleared and fenced the north field with two other stewards"
              className="bg-background/50 border-white/10 min-h-[80px]"
              data-testid="input-description"
            />
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit || logHours.isPending} data-testid="button-log-hours">
            {logHours.isPending ? "Logging..." : "Log hours"}
          </Button>
        </form>
      </div>

      {entries.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 mb-6">
          <h2 className="font-display font-bold text-lg mb-4">Your record</h2>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]" data-testid={`entry-${e.id}`}>
                <div className="min-w-0">
                  <p className="text-sm">{e.description}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{e.kind}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm">{Number(e.hours)}h</p>
                  {e.verifiedAt ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl p-6">
        <h2 className="font-display font-bold text-lg mb-4">The three tiers</h2>
        <div className="space-y-4">
          {TIERS.map((t) => {
            const Icon = t.icon;
            const isYou = standing?.tier === t.key;
            return (
              <div
                key={t.key}
                className={`flex gap-4 p-4 rounded-xl border ${
                  isYou ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isYou ? "text-emerald-400" : "text-muted-foreground"}`} />
                <div>
                  <p className="font-semibold text-sm mb-1">
                    {t.label}
                    {isYou && <span className="ml-2 text-xs text-emerald-400">— you</span>}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-5">
          Standing is granted by the ministry, never reached automatically by an
          hour count. Stipends for clergy are board-approved and capped.
        </p>
      </div>
    </div>
  );
}
