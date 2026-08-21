import { useParams } from "wouter";
import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useCreateFile } from "@/hooks/use-files";
import { useCreateInvestment } from "@/hooks/use-investments";
import { useCreateSubmission } from "@/hooks/use-submissions";
import { useCreateOffering, useProjectOfferings } from "@/hooks/use-offerings";
import { useCoproducers, useSelectCoproducers } from "@/hooks/use-coproducers";
import { useProjectNegotiations, useMyNegotiation, useSubmitNegotiation, useRespondNegotiation } from "@/hooks/use-negotiations";
import { useProjectLaunchStatus, useUnlockLicense, useMyLicenseUnlock } from "@/hooks/use-license";
import { useAuth } from "@/hooks/use-auth";
import { usePlayer } from "@/context/player";
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu";
import { uploadFile, formatBytes, MAX_UPLOAD_BYTES } from "@/lib/upload";
import { format } from "date-fns";
import {
  FileAudio, FileImage, FileCode, UploadCloud, TrendingUp, AlertCircle,
  ArrowLeft, Plus, Headphones, Mic2, Heart, Lightbulb, Shuffle,
  Crown, Sparkles, Star, Music2, DollarSign, Lock, Globe, EyeOff,
  Film, SlidersHorizontal, PersonStanding, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  Rocket, CheckCheck, Key, Banknote, Play, Pause,
} from "lucide-react";
import { Handshake } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleBadge, SUBMISSION_TYPE_LABELS, getSubmissionTypesForRoles, hasNegotiableRole } from "@/components/role-badge";
import type { Submission, User } from "@shared/schema";

const SUBMISSION_TYPE_GROUPS = {
  "Beats & Production": ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"],
  "Writing & Vocals": ["hook", "song-concept", "verse", "theme", "song-title", "vocal-sample"],
  "Creative Ideas": ["mood-board", "visual-idea", "narrative-idea", "challenge", "concept"],
  "Video & Marketing": ["music-video-concept", "promo-asset", "social-media-pack", "visual-campaign"],
  "Audio Engineering": ["mix", "master", "vocal-production", "sound-design"],
  "Performance": ["choreography-concept", "performance-video", "acting-reel"],
};

const PRODUCER_BEAT_TYPES = ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"];

const LAUNCH_CATEGORY_LABELS: Record<string, string> = {
  producer: "Producer",
  writer: "Writer",
  supporter: "Supporter",
  collaborator: "Collaborator",
  videographer: "Videographer / Marketing",
  engineer: "Recording Engineer",
  dancer: "Dancer / Actor",
  ministry: "Ministry",
};

const SPLIT_META: Record<string, { label: string; color: string; icon: typeof Mic2; description: string }> = {
  artist:        { label: "Artist / Vocalist",   color: "bg-violet-500",  icon: Mic2,   description: "Master recording share (negotiable)" },
  producers:     { label: "Producer(s)",          color: "bg-primary",     icon: Music2, description: "Investment equity % assigned per backer" },
  "co-producers":{ label: "Co-Producers (3+4)",  color: "bg-amber-500",   icon: Star,   description: "3% Master each × 7 blessed creators" },
  ministry:      { label: "Ministry Bestowal",    color: "bg-emerald-500", icon: Crown,  description: "Platform bestowal (Master) + optional 5% publishing admin" },
};
const SPLIT_ORDER = ["artist", "producers", "co-producers", "ministry"];

type PersistedSplit = { role: string; percentage: string | number };

function CircleSplitPanel({ royaltySplits }: { royaltySplits: PersistedSplit[] }) {
  const splitMap = new Map(royaltySplits.map(s => [s.role, Number(s.percentage)]));
  const fallback: Record<string, number> = { artist: 50, producers: 0, "co-producers": 21, ministry: 5 };

  const splits = SPLIT_ORDER.map(role => {
    const meta = SPLIT_META[role];
    const percent = splitMap.has(role) ? splitMap.get(role)! : (fallback[role] ?? 0);
    return { role, ...meta, percent };
  });
  const total = splits.reduce((sum, s) => sum + s.percent, 0);

  return (
    <div className="space-y-4" data-testid="circle-split-panel">
      <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5" data-testid="split-bar">
        {splits.map(s => (
          <div
            key={s.role}
            className={`${s.color} h-full transition-all`}
            style={{ width: `${(s.percent / 100) * 100}%` }}
            title={`${s.role}: ${s.percent}%`}
          />
        ))}
      </div>

      <div className="space-y-3">
        {splits.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.role} className="flex items-start gap-3" data-testid={`split-row-${s.role.toLowerCase().replace(/[\s/()]+/g, '-')}`}>
              <div className={`w-3 h-3 rounded-sm mt-0.5 flex-shrink-0 ${s.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {s.role}
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums">{s.percent}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-white/5 flex justify-between text-xs text-muted-foreground">
        <span>Displayed total</span>
        <span className="font-mono">{total}% Master</span>
      </div>
      <p className="text-xs text-muted-foreground/60 italic">
        Remaining {100 - total}% reserved for artist negotiation, publishing splits & unclaimed shares.
      </p>
    </div>
  );
}

function CoproducerPanel({
  isCreator,
  projectId,
  hasOfferings,
}: {
  isCreator: boolean;
  projectId: number;
  hasOfferings: boolean;
}) {
  const { data: coproducers = [] } = useCoproducers(projectId);
  const selectCoproducers = useSelectCoproducers(projectId);
  const selected = coproducers.length > 0;

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="coproducer-panel">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold">Co-Producers (3+4)</h3>
            <p className="text-xs text-muted-foreground">3% Master each</p>
          </div>
        </div>
        {selected && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {coproducers.length} selected
          </span>
        )}
      </div>

      {!selected ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-center space-y-2">
            <Shuffle className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Co-producers not yet selected.</p>
            <p className="text-xs text-muted-foreground/60">
              Top 3 supporters by offering + 4 blessed at random from remaining backers.
            </p>
          </div>
          {isCreator && (
            <Button
              onClick={() => selectCoproducers.mutate()}
              disabled={selectCoproducers.isPending || !hasOfferings}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
              data-testid="button-select-coproducers"
            >
              {selectCoproducers.isPending ? "Selecting..." : "Select Co-Producers"}
            </Button>
          )}
          {isCreator && !hasOfferings && (
            <p className="text-xs text-muted-foreground text-center">Supporters must submit offerings first.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {coproducers.map((cp, i) => (
            <div
              key={cp.id}
              data-testid={`coproducer-card-${cp.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                cp.selectionType === 'top' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{cp.user?.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    cp.selectionType === 'top'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {cp.selectionType === 'top' ? 'Top Supporter' : 'Blessed Random'}
                  </span>
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-amber-400">{cp.percentage}%</div>
            </div>
          ))}
          {isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCoproducers.mutate()}
              disabled={selectCoproducers.isPending}
              className="w-full mt-2 border-white/10 text-xs"
              data-testid="button-reselect-coproducers"
            >
              {selectCoproducers.isPending ? "Re-selecting..." : "Re-select Co-Producers"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OfferingPanel({ projectId }: { projectId: number }) {
  const { data: offerings } = useProjectOfferings(projectId);
  const createOffering = useCreateOffering(projectId);
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const totalOfferings = (offerings ?? []).reduce((sum, o) => sum + Number(o.amount), 0);
  const offerCount = (offerings ?? []).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOffering.mutateAsync({ amount: parseFloat(amount) });
    setAmount("");
    setIsOpen(false);
  };

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="offering-panel">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-400/20 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold">Supporter Offerings</h3>
            <p className="text-xs text-muted-foreground">Pledge toward the mission</p>
          </div>
        </div>
        {offerCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-400/10 text-rose-400 border border-rose-400/20">
            {offerCount} {offerCount === 1 ? "backer" : "backers"}
          </span>
        )}
      </div>

      <div className="flex justify-between text-sm mb-4">
        <span className="text-muted-foreground">Total pledged</span>
        <span className="font-mono font-bold text-rose-400">${totalOfferings}</span>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-rose-400/30 text-rose-400 hover:bg-rose-400/10 hover:border-rose-400/50"
            data-testid="button-make-offering"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Make an Offering
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-panel border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit an Offering</DialogTitle>
            <DialogDescription>
              Offerings are logged as pledges — no payment is charged. Top supporters by offering amount may be selected as co-producers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Offering Amount ($)</label>
              <Input
                type="number"
                required
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 25"
                className="bg-background/50 border-white/10 font-mono"
                data-testid="input-offering-amount"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-400 text-white"
              disabled={createOffering.isPending}
              data-testid="button-confirm-offering"
            >
              {createOffering.isPending ? "Submitting..." : "Submit Offering"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {(offerings ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          {offerings!.slice(0, 5).map(o => (
            <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{o.user?.username}</span>
              <span className="font-mono text-rose-400">${Number(o.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NegotiationPanel({ projectId }: { projectId: number }) {
  const submitNegotiation = useSubmitNegotiation(projectId);
  const { data: myNeg } = useMyNegotiation(projectId);
  const [requestedPercent, setRequestedPercent] = useState("5");
  const [exchangeType, setExchangeType] = useState<"percentage" | "equal">("percentage");
  const [isOpen, setIsOpen] = useState(false);

  const statusColor = {
    pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    accepted: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    rejected: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  }[myNeg?.status ?? "pending"] ?? "text-amber-400 bg-amber-400/10 border-amber-400/20";

  const statusLabel = {
    pending: "Pending Review",
    accepted: "Accepted",
    rejected: "Declined",
  }[myNeg?.status ?? "pending"] ?? "Pending Review";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitNegotiation.mutateAsync({
      requestedPercent: parseFloat(requestedPercent),
      exchangeType,
    });
    setIsOpen(false);
  };

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="negotiation-panel">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
          <Handshake className="w-4 h-4 text-fuchsia-400" />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Contribution Negotiation</h3>
          <p className="text-xs text-muted-foreground">Request a bestowal for your work</p>
        </div>
      </div>

      {myNeg ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your request</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>{statusLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{myNeg.exchangeType === "equal" ? "Equal Bestowal Exchange" : `${Number(myNeg.requestedPercent)}% Contribution`}</span>
            </div>
            {myNeg.exchangeType === "percentage" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Requested %</span>
                <span className="font-mono font-bold text-fuchsia-400">{Number(myNeg.requestedPercent)}%</span>
              </div>
            )}
          </div>

          {(myNeg.status === "rejected" || myNeg.status === "pending") ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/10 text-xs"
              onClick={() => setIsOpen(true)}
              data-testid="button-update-negotiation"
            >
              {myNeg.status === "rejected" ? "Submit New Request" : "Update Request"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            As a creative specialist, you can request up to 10% bestowal from this project, or propose an equal-value exchange.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-fuchsia-400/30 text-fuchsia-400 hover:bg-fuchsia-400/10"
            onClick={() => setIsOpen(true)}
            data-testid="button-open-negotiation"
          >
            <Handshake className="w-4 h-4 mr-2" />
            Request Bestowal
          </Button>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Contribution Negotiation</DialogTitle>
            <DialogDescription>
              Set your requested bestowal percentage (0–10%) or toggle Equal Bestowal Exchange. The creator will review and accept or decline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Exchange Type</label>
                <button
                  type="button"
                  onClick={() => setExchangeType(t => t === "percentage" ? "equal" : "percentage")}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
                  data-testid="toggle-exchange-type"
                >
                  {exchangeType === "equal" ? (
                    <><ToggleRight className="w-5 h-5 text-fuchsia-400" /> Equal Exchange</>
                  ) : (
                    <><ToggleLeft className="w-5 h-5 text-muted-foreground" /> Percentage</>
                  )}
                </button>
              </div>

              {exchangeType === "percentage" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Requested Bestowal (%)</label>
                  <Input
                    type="number"
                    required
                    min="0"
                    max="10"
                    step="0.5"
                    value={requestedPercent}
                    onChange={e => setRequestedPercent(e.target.value)}
                    placeholder="e.g. 5"
                    className="bg-background/50 border-white/10 font-mono"
                    data-testid="input-requested-percent"
                  />
                  <p className="text-xs text-muted-foreground">Max 10% of project private or public value.</p>
                </div>
              )}

              {exchangeType === "equal" && (
                <div className="p-3 rounded-xl bg-fuchsia-400/5 border border-fuchsia-400/20 text-xs text-fuchsia-300">
                  Equal Bestowal Exchange — both parties agree to a mutual fair-value exchange with no fixed percentage. The creator accepts or proposes terms directly.
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
              disabled={submitNegotiation.isPending}
              data-testid="button-submit-negotiation"
            >
              {submitNegotiation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreatorNegotiationsPanel({ projectId }: { projectId: number }) {
  const { data: negotiations = [] } = useProjectNegotiations(projectId);
  const respond = useRespondNegotiation(projectId);
  const pending = negotiations.filter(n => n.status === "pending");

  if (negotiations.length === 0) return null;

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="creator-negotiations-panel">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
          <Handshake className="w-4 h-4 text-fuchsia-400" />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Contribution Negotiations</h3>
          <p className="text-xs text-muted-foreground">
            {pending.length > 0 ? `${pending.length} pending request${pending.length !== 1 ? "s" : ""}` : "All resolved"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {negotiations.map(neg => (
          <div
            key={neg.id}
            data-testid={`negotiation-card-${neg.id}`}
            className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium">{neg.user?.username}</span>
                <div className="flex gap-1 mt-1">
                  {(neg.user?.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                neg.status === "pending" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                neg.status === "accepted" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                "text-rose-400 bg-rose-400/10 border-rose-400/20"
              }`}>
                {neg.status === "pending" ? "Pending" : neg.status === "accepted" ? "Accepted" : "Declined"}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              {neg.exchangeType === "equal" ? (
                <p>Requesting <strong className="text-white">Equal Bestowal Exchange</strong></p>
              ) : (
                <p>Requesting <strong className="text-fuchsia-400 font-mono">{Number(neg.requestedPercent)}%</strong> contribution bestowal</p>
              )}
            </div>

            {neg.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  onClick={() => respond.mutate({ nId: neg.id, status: "accepted" })}
                  disabled={respond.isPending}
                  data-testid={`button-accept-negotiation-${neg.id}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-rose-400/30 text-rose-400 hover:bg-rose-400/10 text-xs"
                  onClick={() => respond.mutate({ nId: neg.id, status: "rejected" })}
                  disabled={respond.isPending}
                  data-testid={`button-reject-negotiation-${neg.id}`}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Public Launch Tracker ──────────────────────────────────────────────────────
function LaunchTrackerPanel({ projectId }: { projectId: number }) {
  const { data: launch } = useProjectLaunchStatus(projectId);

  if (!launch) return null;

  const LAUNCH_CATEGORIES_ORDER = ["producer", "writer", "supporter", "collaborator", "videographer", "engineer", "dancer", "ministry"];

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="launch-tracker-panel">
      <div className="flex items-center gap-2 mb-5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          launch.canLaunch ? "bg-emerald-500/20" : "bg-sky-500/20"
        }`}>
          <Rocket className={`w-4 h-4 ${launch.canLaunch ? "text-emerald-400" : "text-sky-400"}`} />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Public Launch</h3>
          <p className="text-xs text-muted-foreground">
            {launch.canLaunch ? "Ready to launch!" : `${launch.categoriesFulfilled}/8 categories (need 4+) • $${launch.backerTotal}/$${launch.backerGoal}`}
          </p>
        </div>
        {launch.canLaunch && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Unlocked
          </span>
        )}
      </div>

      {/* Backer goal progress */}
      <div className="space-y-2 mb-5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Backer contributions</span>
          <span className="font-mono font-bold">
            <span className={launch.backerTotal >= launch.backerGoal ? "text-emerald-400" : "text-sky-400"}>
              ${launch.backerTotal}
            </span>
            <span className="text-muted-foreground"> / ${launch.backerGoal}</span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all ${
              launch.backerTotal >= launch.backerGoal ? "bg-emerald-500" : "bg-sky-500"
            }`}
            style={{ width: `${launch.backerProgress}%` }}
          />
        </div>
      </div>

      {/* Category checklist */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium">Creative categories</p>
          <span className={`text-xs font-mono ${launch.categoriesFulfilled >= 4 ? "text-emerald-400" : "text-muted-foreground"}`}>
            {launch.categoriesFulfilled}/8 <span className="text-muted-foreground">(need 4)</span>
          </span>
        </div>
        {LAUNCH_CATEGORIES_ORDER.map(cat => {
          const fulfilled = launch.categories[cat] ?? false;
          return (
            <div
              key={cat}
              data-testid={`launch-category-${cat}`}
              className="flex items-center gap-2 text-xs"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                fulfilled ? "bg-emerald-500/20" : "bg-white/5"
              }`}>
                {fulfilled
                  ? <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />
                  : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                }
              </div>
              <span className={fulfilled ? "text-white" : "text-muted-foreground"}>
                {LAUNCH_CATEGORY_LABELS[cat] ?? cat}
              </span>
            </div>
          );
        })}
      </div>

      <Button
        className={`w-full font-bold ${
          launch.canLaunch
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-white/5 border border-white/10 text-muted-foreground cursor-not-allowed"
        }`}
        disabled={!launch.canLaunch}
        data-testid="button-public-launch"
        title={launch.canLaunch ? undefined : "Coming Soon — complete all requirements to enable public launch"}
      >
        <Rocket className="w-4 h-4 mr-2" />
        {launch.canLaunch ? "Launch to Public" : "Coming Soon — Complete Requirements"}
      </Button>
    </div>
  );
}

// ── Beat License Card ──────────────────────────────────────────────────────────
function LicenseCard({ sub, currentUserId }: { sub: Submission & { user: User }; currentUserId?: number }) {
  const unlock = useUnlockLicense(sub.id);
  const { data: myUnlock } = useMyLicenseUnlock(sub.id);
  const isOwner = sub.userId === currentUserId;
  const alreadyUnlocked = myUnlock?.unlocked ?? false;

  return (
    <div
      data-testid={`license-card-${sub.id}`}
      className="p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="font-semibold text-sm">{sub.title}</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
            {SUBMISSION_TYPE_LABELS[sub.type] ?? sub.type}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-bold text-primary text-sm">${Number(sub.licenseBestowalAmount)}</div>
          {sub.sampleClearancePercent && Number(sub.sampleClearancePercent) > 0 && (
            <div className="text-xs text-muted-foreground">{Number(sub.sampleClearancePercent)}% clearance</div>
          )}
        </div>
      </div>
      {sub.description && <p className="text-xs text-muted-foreground mb-3">{sub.description}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">by {sub.user?.username}</span>
        {!isOwner && (
          alreadyUnlocked ? (
            <div className="flex items-center gap-1 text-xs text-emerald-400" data-testid={`license-unlocked-${sub.id}`}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Licensed
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => unlock.mutate()}
              disabled={unlock.isPending}
              data-testid={`button-unlock-license-${sub.id}`}
            >
              <Key className="w-3 h-3 mr-1" />
              {unlock.isPending ? "Unlocking..." : "Unlock License"}
            </Button>
          )
        )}
        {isOwner && (
          <span className="text-xs text-muted-foreground italic">Your beat</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  const { data: project, isLoading } = useProject(projectId);
  const { data: offerings } = useProjectOfferings(projectId);
  const { user } = useAuth();

  const createFile = useCreateFile(projectId);
  const createInvestment = useCreateInvestment(projectId);
  const createSubmission = useCreateSubmission(projectId);
  const { playTrack, togglePlay, state: playerState, currentTrack } = usePlayer();

  const [isFileOpen, setIsFileOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("stem");
  const [fileVisibility, setFileVisibility] = useState<"private" | "public">("private");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isInvestOpen, setIsInvestOpen] = useState(false);
  const [investAmount, setInvestAmount] = useState("");
  const [investPercent, setInvestPercent] = useState("");

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [subType, setSubType] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subVisibility, setSubVisibility] = useState<"private" | "public">("private");
  const [subLicenseAmount, setSubLicenseAmount] = useState("");
  const [subClearancePercent, setSubClearancePercent] = useState("");

  if (isLoading) return (
    <div className="min-h-screen pt-24 px-8 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!project) return (
    <div className="min-h-screen pt-24 px-8 text-center text-xl text-muted-foreground">
      Project not found
    </div>
  );

  const totalPercentage = project.investments.reduce((sum, inv) => sum + inv.percentage, 0);
  const availablePercentage = 100 - totalPercentage;
  const investorCount = project.investments.length;
  const canInvest = investorCount < 3 && availablePercentage > 0;

  const userRoles = user?.roles ?? [];
  const allowedSubmissionTypes = getSubmissionTypesForRoles(userRoles);
  const isCreator = user?.id === project.creatorId;
  const hasOfferings = (offerings ?? []).length > 0;
  const userHasNegotiableRole = hasNegotiableRole(userRoles);

  const showLicenseFields = subType && PRODUCER_BEAT_TYPES.includes(subType);

  const projectSubmissions = project.submissions ?? [];
  const licensedSubmissions = projectSubmissions.filter(
    s => s.licenseBestowalAmount && Number(s.licenseBestowalAmount) > 0
  ) as (Submission & { user: User })[];

  const resetFileForm = () => {
    setFileName("");
    setFileVisibility("private");
    setPickedFile(null);
    setUploadPercent(null);
    setUploadError(null);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedFile) return;
    setUploadError(null);
    setUploadPercent(0);
    try {
      // Straight to object storage; only the resulting key reaches our API.
      const uploaded = await uploadFile(pickedFile, "files", setUploadPercent);
      await createFile.mutateAsync({
        name: fileName.trim() || uploaded.filename,
        type: fileType,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        visibility: fileVisibility,
      });
      setIsFileOpen(false);
      resetFileForm();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadPercent(null);
    }
  };

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInvestment.mutateAsync({
      amount: parseFloat(investAmount),
      percentage: parseInt(investPercent, 10),
    });
    setIsInvestOpen(false);
    setInvestAmount("");
    setInvestPercent("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSubmission.mutateAsync({
      type: subType,
      title: subTitle,
      description: subDesc,
      visibility: subVisibility,
      licenseBestowalAmount: showLicenseFields && subLicenseAmount ? parseFloat(subLicenseAmount) : undefined,
      sampleClearancePercent: showLicenseFields && subClearancePercent ? parseFloat(subClearancePercent) : undefined,
    });
    setIsSubmitOpen(false);
    setSubType("");
    setSubTitle("");
    setSubDesc("");
    setSubVisibility("private");
    setSubLicenseAmount("");
    setSubClearancePercent("");
  };

  const getFileIcon = (type: string) => {
    if (type === 'stem') return <FileAudio className="w-5 h-5 text-primary" />;
    if (type === 'artwork') return <FileImage className="w-5 h-5 text-accent" />;
    return <FileCode className="w-5 h-5 text-muted-foreground" />;
  };

  const getSubmissionGroupIcon = (group: string) => {
    if (group === "Beats & Production") return <Headphones className="w-4 h-4" />;
    if (group === "Writing & Vocals") return <Mic2 className="w-4 h-4" />;
    if (group === "Video & Marketing") return <Film className="w-4 h-4" />;
    if (group === "Audio Engineering") return <SlidersHorizontal className="w-4 h-4" />;
    if (group === "Performance") return <PersonStanding className="w-4 h-4" />;
    return <Lightbulb className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Details, Submissions, Files, Circle Split */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">{project.title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">{project.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span className="text-muted-foreground">Creator:</span>
                <span className="font-medium text-white">{project.creator.username}</span>
                {(project.creator.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
              </div>
              <div className="text-muted-foreground">
                {project.createdAt ? format(new Date(project.createdAt), "MMMM d, yyyy") : ""}
              </div>
            </div>
          </div>

          {/* Tabs: Submissions, Files, Licenses, Circle Split */}
          <Tabs defaultValue="submissions">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="submissions" className="data-[state=active]:bg-white/10">
                  Contributions ({projectSubmissions.length})
                </TabsTrigger>
                <TabsTrigger value="files" className="data-[state=active]:bg-white/10">
                  Files ({project.files.length})
                </TabsTrigger>
                {licensedSubmissions.length > 0 && (
                  <TabsTrigger value="licenses" className="data-[state=active]:bg-white/10 gap-1.5" data-testid="tab-licenses">
                    <Banknote className="w-3.5 h-3.5" />
                    Licenses ({licensedSubmissions.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="split" className="data-[state=active]:bg-white/10 gap-1.5" data-testid="tab-circle-split">
                  <Sparkles className="w-3.5 h-3.5" />
                  Circle Split
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                {/* Submit Contribution */}
                {userRoles.length > 0 && (
                  user?.isSubscribed ? (
                  <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5" data-testid="button-submit-contribution">
                        <Plus className="w-4 h-4" /> Submit Idea
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-panel border-white/10 sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Submit a Contribution</DialogTitle>
                        <DialogDescription>Share your creative input for this project.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Contribution Type</label>
                          <Select required value={subType} onValueChange={setSubType}>
                            <SelectTrigger className="bg-background/50 border-white/10" data-testid="select-submission-type">
                              <SelectValue placeholder="Select a type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(SUBMISSION_TYPE_GROUPS).map(([group, types]) => {
                                const available = types.filter(t => allowedSubmissionTypes.includes(t));
                                if (available.length === 0) return null;
                                return (
                                  <SelectGroup key={group}>
                                    <SelectLabel>{group}</SelectLabel>
                                    {available.map(t => (
                                      <SelectItem key={t} value={t} data-testid={`option-${t}`}>
                                        {SUBMISSION_TYPE_LABELS[t] ?? t}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Title</label>
                          <Input
                            required
                            value={subTitle}
                            onChange={e => setSubTitle(e.target.value)}
                            placeholder="e.g. Midnight Hook Idea"
                            className="bg-background/50 border-white/10"
                            data-testid="input-submission-title"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <Textarea
                            value={subDesc}
                            onChange={e => setSubDesc(e.target.value)}
                            placeholder="Describe your idea, its energy, and how it fits the project..."
                            className="bg-background/50 border-white/10 min-h-[80px]"
                            data-testid="textarea-submission-desc"
                          />
                        </div>

                        {/* Visibility toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                          <div>
                            <p className="text-sm font-medium">Visibility</p>
                            <p className="text-xs text-muted-foreground">
                              {subVisibility === "public" ? "Visible to everyone" : "Members only"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSubVisibility(v => v === "private" ? "public" : "private")}
                            className="flex items-center gap-1.5 text-xs"
                            data-testid="toggle-submission-visibility"
                          >
                            {subVisibility === "public" ? (
                              <><Globe className="w-4 h-4 text-sky-400" /><span className="text-sky-400">Public</span></>
                            ) : (
                              <><EyeOff className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Private</span></>
                            )}
                          </button>
                        </div>

                        {/* Beat licensing fields (producer beat types only) */}
                        {showLicenseFields && (
                          <div className="space-y-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5" /> Beat License (optional)
                            </p>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">License Bestowal Amount ($)</label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={subLicenseAmount}
                                onChange={e => setSubLicenseAmount(e.target.value)}
                                placeholder="e.g. 50 (leave blank for no license)"
                                className="bg-background/50 border-white/10 font-mono text-sm"
                                data-testid="input-license-amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Sample Clearance Reserve (%)</label>
                              <Input
                                type="number"
                                min="0"
                                max="30"
                                step="1"
                                value={subClearancePercent}
                                onChange={e => setSubClearancePercent(e.target.value)}
                                placeholder="e.g. 10"
                                className="bg-background/50 border-white/10 font-mono text-sm"
                                data-testid="input-clearance-percent"
                              />
                            </div>
                          </div>
                        )}

                        <Button type="submit" className="w-full" disabled={createSubmission.isPending} data-testid="button-submit-form">
                          {createSubmission.isPending ? "Submitting..." : "Submit Contribution"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 opacity-60 cursor-not-allowed" disabled data-testid="button-submit-contribution-locked" title="Active membership required">
                      <Lock className="w-4 h-4" /> Members Only
                    </Button>
                  )
                )}

                {/* Upload File */}
                {user?.isSubscribed ? (
                <Dialog open={isFileOpen} onOpenChange={setIsFileOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5" data-testid="button-upload-file">
                      <UploadCloud className="w-4 h-4" /> File
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-panel border-white/10 sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upload Contribution</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFileUpload} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Choose a file</label>
                        <input
                          type="file"
                          required
                          onChange={e => {
                            const f = e.target.files?.[0] ?? null;
                            setPickedFile(f);
                            setUploadError(null);
                            // Default the display name to the filename, minus extension.
                            if (f && !fileName.trim()) {
                              setFileName(f.name.replace(/\.[^.]+$/, ""));
                            }
                          }}
                          className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4
                                     file:rounded-lg file:border-0 file:text-sm file:font-medium
                                     file:bg-primary/20 file:text-primary hover:file:bg-primary/30
                                     file:cursor-pointer cursor-pointer"
                          data-testid="input-file-picker"
                        />
                        {pickedFile && (
                          <p className="text-xs text-muted-foreground" data-testid="picked-file-info">
                            {pickedFile.name} — {formatBytes(pickedFile.size)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60">
                          Up to {formatBytes(MAX_UPLOAD_BYTES)}. Uploads go straight to storage.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Display Name</label>
                        <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. Bass Synth Stem" className="bg-background/50 border-white/10" data-testid="input-file-name" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select
                          value={fileType}
                          onChange={e => setFileType(e.target.value)}
                          className="w-full h-10 rounded-md border border-white/10 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          data-testid="select-file-type"
                        >
                          <option value="stem">Audio Stem</option>
                          <option value="artwork">Artwork</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* File visibility toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-medium">Visibility</p>
                          <p className="text-xs text-muted-foreground">
                            {fileVisibility === "public" ? "Visible to everyone" : "Members only"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFileVisibility(v => v === "private" ? "public" : "private")}
                          className="flex items-center gap-1.5 text-xs"
                          data-testid="toggle-file-visibility"
                        >
                          {fileVisibility === "public" ? (
                            <><Globe className="w-4 h-4 text-sky-400" /><span className="text-sky-400">Public</span></>
                          ) : (
                            <><EyeOff className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Private</span></>
                          )}
                        </button>
                      </div>

                      {uploadPercent !== null && (
                        <div className="space-y-1" data-testid="upload-progress">
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${uploadPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">{uploadPercent}%</p>
                        </div>
                      )}

                      {uploadError && (
                        <p className="text-xs text-rose-400" data-testid="upload-error">{uploadError}</p>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={!pickedFile || uploadPercent !== null || createFile.isPending}
                        data-testid="button-upload-submit"
                      >
                        {uploadPercent !== null
                          ? `Uploading ${uploadPercent}%`
                          : createFile.isPending ? "Saving..." : "Upload File"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 border-white/10 opacity-60 cursor-not-allowed" disabled data-testid="button-upload-file-locked" title="Active membership required">
                    <Lock className="w-4 h-4" /> File
                  </Button>
                )}
              </div>
            </div>

            {/* Submissions Tab */}
            <TabsContent value="submissions" className="mt-0">
              {projectSubmissions.length === 0 ? (
                <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No contributions yet. Be the first to share your creative energy.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(SUBMISSION_TYPE_GROUPS).map(([group, groupTypes]) => {
                    const groupSubs = projectSubmissions.filter(s => groupTypes.includes(s.type));
                    if (groupSubs.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                          {getSubmissionGroupIcon(group)}
                          {group}
                        </div>
                        <div className="grid gap-3">
                          {groupSubs.map(sub => {
                            const track = {
                              id: sub.id,
                              title: sub.title,
                              type: sub.type,
                              artist: sub.user?.displayName ?? sub.user?.username ?? "Unknown",
                              fileUrl: sub.fileUrl ?? null,
                              projectTitle: project.title,
                              projectId: project.id,
                            };
                            const isCurrentTrack = currentTrack?.id === sub.id;
                            const isPlayingThis = isCurrentTrack && playerState.playing;
                            return (
                            <div key={sub.id} data-testid={`submission-card-${sub.id}`} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => isCurrentTrack ? togglePlay() : playTrack(track)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isCurrentTrack ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-primary/80 hover:text-primary-foreground text-muted-foreground"}`}
                                    data-testid={`button-play-submission-${sub.id}`}
                                    title={isPlayingThis ? "Pause" : "Play"}
                                  >
                                    {isPlayingThis ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  </button>
                                  <span className="font-semibold text-sm">{sub.title}</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                                    {SUBMISSION_TYPE_LABELS[sub.type] ?? sub.type}
                                  </span>
                                  {sub.visibility === "public" ? (
                                    <span className="flex items-center gap-0.5 text-xs text-sky-400" data-testid={`visibility-badge-${sub.id}`}>
                                      <Globe className="w-3 h-3" /> Public
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground/50" data-testid={`visibility-badge-${sub.id}`}>
                                      <EyeOff className="w-3 h-3" /> Private
                                    </span>
                                  )}
                                  {sub.licenseBestowalAmount && Number(sub.licenseBestowalAmount) > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs text-primary" data-testid={`license-badge-${sub.id}`}>
                                      <Key className="w-3 h-3" /> ${Number(sub.licenseBestowalAmount)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {(sub.user?.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                                  <span className="text-xs text-muted-foreground">{sub.user?.username}</span>
                                </div>
                              </div>
                              {sub.description && (
                                <p className="text-sm text-muted-foreground">{sub.description}</p>
                              )}
                              <div className="flex justify-end mt-2">
                                <AddToPlaylistMenu submissionId={sub.id} />
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="mt-0">
              {project.files.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  No files contributed yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {project.files.map(f => {
                    const fileTrack = {
                      id: -(f.id),
                      title: f.name,
                      type: f.type,
                      artist: f.uploader?.displayName ?? f.uploader?.username ?? "Unknown",
                      fileUrl: f.url,
                      projectTitle: project.title,
                      projectId: project.id,
                    };
                    const isCurrentFileTrack = currentTrack?.id === -(f.id);
                    const isPlayingFile = isCurrentFileTrack && playerState.playing;
                    return (
                    <div key={f.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => isCurrentFileTrack ? togglePlay() : playTrack(fileTrack)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${isCurrentFileTrack ? "bg-primary/20 border-primary/30" : "bg-background border-white/5 hover:bg-primary/10 hover:border-primary/20"}`}
                          data-testid={`button-play-file-${f.id}`}
                          title={isPlayingFile ? "Pause" : "Play"}
                        >
                          {isPlayingFile
                            ? <Pause className="w-4 h-4 text-primary" />
                            : (f.type === 'stem' || f.type === 'other'
                              ? <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                              : getFileIcon(f.type))}
                        </button>
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded by {f.uploader?.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.visibility === "public" ? (
                          <span className="flex items-center gap-0.5 text-xs text-sky-400">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground/50">
                            <EyeOff className="w-3 h-3" /> Private
                          </span>
                        )}
                        <div className="text-xs px-2 py-1 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                          {f.type}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Licenses Tab */}
            <TabsContent value="licenses" className="mt-0">
              {licensedSubmissions.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  No licensed beats available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4">
                    Producers in this project have made their beats available for licensing. Unlock a license to use the beat in your work.
                  </p>
                  {licensedSubmissions.map(sub => (
                    <LicenseCard key={sub.id} sub={sub} currentUserId={user?.id} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Circle Split Tab */}
            <TabsContent value="split" className="mt-0">
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold">Free Soul Default Publishing Split</h3>
                </div>
                <CircleSplitPanel royaltySplits={project.royaltySplits ?? []} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Investments Panel */}
          <div className="glass-panel rounded-3xl p-6 border-primary/20 bg-gradient-to-b from-card/60 to-primary/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold">Investments</h3>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Invested</span>
                <span className="font-mono font-medium">${project.investments.reduce((sum, i) => sum + Number(i.amount), 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Equity Claimed</span>
                <span className="font-mono font-medium">{totalPercentage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Investors</span>
                <span className="font-mono font-medium">{investorCount} / 3</span>
              </div>

              <div className="w-full bg-background rounded-full h-2 mt-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                  style={{ width: `${totalPercentage}%` }}
                />
              </div>
            </div>

            {canInvest ? (
              !user?.isSubscribed ? (
                <Link href="/account">
                  <Button className="w-full bg-white/10 text-muted-foreground border border-white/10 hover:bg-white/15" data-testid="button-invest-locked">
                    <Lock className="w-4 h-4 mr-2" /> Members Only — Activate Membership
                  </Button>
                </Link>
              ) : (
              <Dialog open={isInvestOpen} onOpenChange={setIsInvestOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]" data-testid="button-invest">
                    Invest in Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel border-primary/20 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Make an Investment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInvest} className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex gap-3 text-sm mb-4">
                      <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                      <p className="text-primary-foreground/80">Up to 10% equity per investor. Only {Math.min(10, availablePercentage)}% currently available.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Investment Amount ($)</label>
                      <Input type="number" required min="1" step="0.01" value={investAmount} onChange={e => setInvestAmount(e.target.value)} placeholder="e.g. 100" className="bg-background/50 border-white/10 font-mono" data-testid="input-invest-amount" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Requested Equity (%)</label>
                      <Input type="number" required min="1" max={Math.min(10, availablePercentage)} value={investPercent} onChange={e => setInvestPercent(e.target.value)} placeholder={`Max ${Math.min(10, availablePercentage)}%`} className="bg-background/50 border-white/10 font-mono" data-testid="input-invest-percent" />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={createInvestment.isPending} data-testid="button-confirm-invest">
                      {createInvestment.isPending ? "Processing..." : "Confirm Investment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              )
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-sm text-muted-foreground">
                Investment cap reached for this project.
              </div>
            )}

            {/* Investors list */}
            {project.investments.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Backers</p>
                {project.investments.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {inv.investor?.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-muted-foreground">{inv.investor?.username}</span>
                    </div>
                    <span className="font-mono text-primary font-medium">{inv.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offering Panel */}
          <OfferingPanel projectId={projectId} />

          {/* Co-Producers Panel */}
          <CoproducerPanel isCreator={isCreator} projectId={projectId} hasOfferings={hasOfferings} />

          {/* Public Launch Tracker */}
          <LaunchTrackerPanel projectId={projectId} />

          {/* Negotiation Panel (for users with negotiable roles) */}
          {userHasNegotiableRole && !isCreator && (
            <NegotiationPanel projectId={projectId} />
          )}

          {/* Creator's Negotiations Review */}
          {isCreator && (
            <CreatorNegotiationsPanel projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
