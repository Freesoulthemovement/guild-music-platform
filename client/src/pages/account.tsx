import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Disc3, Zap, ShieldCheck, CheckCircle2, Crown, Home, PiggyBank, Wrench, PartyPopper, Ticket, Star, UserCheck, ExternalLink, Loader2, AlertTriangle, XCircle, User2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ROLE_CONFIG, RoleBadge, type RoleKey } from "@/components/role-badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SELF_ASSIGNABLE_ROLES: RoleKey[] = ["producer", "writer", "supporter", "collaborator", "videographer", "engineer", "dancer"];

// Ministry Treasury allocation of the 5% platform bestowal
const TREASURY_ALLOCATIONS = [
  { label: "Land & Housing", percent: 50, color: "bg-emerald-500", icon: Home, description: "Acquiring and sustaining private land" },
  { label: "Equipment", percent: 25, color: "bg-primary", description: "Studio gear, tools & creative infrastructure", icon: Wrench },
  { label: "Savings", percent: 15, color: "bg-amber-500", description: "Movement reserve & long-term treasury", icon: PiggyBank },
  { label: "Celebration", percent: 10, color: "bg-rose-400", description: "Community gatherings & cultural events", icon: PartyPopper },
];

function MinistryTreasuryWidget({ isMinistry }: { isMinistry: boolean }) {
  return (
    <div className="glass-panel rounded-3xl p-8" data-testid="ministry-treasury-widget">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <Crown className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold">Ministry Treasury</h3>
          <p className="text-sm text-muted-foreground">
            5% Platform Bestowal Allocation
          </p>
        </div>
        {isMinistry && (
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Ministry Access
          </span>
        )}
      </div>

      {/* Stacked bar */}
      <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5 mb-6" data-testid="treasury-bar">
        {TREASURY_ALLOCATIONS.map(a => (
          <div
            key={a.label}
            className={`${a.color} h-full transition-all`}
            style={{ width: `${a.percent}%` }}
            title={`${a.label}: ${a.percent}%`}
          />
        ))}
      </div>

      <div className="space-y-4">
        {TREASURY_ALLOCATIONS.map(a => {
          const Icon = a.icon;
          return (
            <div key={a.label} className="flex items-start gap-3" data-testid={`treasury-row-${a.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className={`w-3 h-3 rounded-sm mt-1 flex-shrink-0 ${a.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {a.label}
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums">{a.percent}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-white/5">
        <p className="text-xs text-muted-foreground/60 italic leading-relaxed">
          Of every project's 5% bestowal, these portions flow directly into the Free Soul Movement's private treasury — sustaining land, tools, savings, and celebration for all members of the PMA.
        </p>
      </div>
    </div>
  );
}

function CypherPassWidget() {
  const { data: summary } = useQuery<{ yearTotal: number; hasPass: boolean; pass: any | null; donations: any[] }>({
    queryKey: ["/api/donations/me"],
  });

  const hasPass = summary?.hasPass ?? false;
  const yearTotal = summary?.yearTotal ?? 0;
  const passYear = summary?.pass?.year ?? new Date().getFullYear();

  if (!hasPass && yearTotal === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-3xl p-6 border ${hasPass ? "border-primary/30 bg-gradient-to-b from-primary/5 to-transparent" : "border-white/10"}`}
      data-testid="cypher-pass-widget"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPass ? "bg-primary/20" : "bg-white/10"}`}>
          {hasPass ? <Crown className="w-5 h-5 text-primary" /> : <Ticket className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-lg">
            {hasPass ? `Cypher Pass ${passYear}` : "Cypher Pass"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {hasPass ? "Active — 4 votes bestowed" : "Log $700+ or $1,000 cumulative to qualify"}
          </p>
        </div>
        {hasPass && <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />}
      </div>

      {hasPass ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <Star className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">You are a sacred holder of the Cypher Pass. Your votes shape who performs at the annual gathering.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Year bestowal total</span>
            <span className="font-mono font-bold">${yearTotal.toFixed(0)} / $1,000</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (yearTotal / 1000) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link href="/events">
          <Button variant="outline" size="sm" className="w-full border-white/10 text-xs" data-testid="link-view-cypher">
            {hasPass ? "Go to Cypher Events & Vote" : "View Cypher Events"}
            <Star className="w-3 h-3 ml-1.5" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function GrantMinistryPanel() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");

  const grantMutation = useMutation({
    mutationFn: (uname: string) =>
      apiRequest("PATCH", "/api/admin/grant-ministry", { username: uname }),
    onSuccess: () => {
      toast({ title: "Ministry role granted", description: `${username} is now a ministry artist.` });
      setUsername("");
      queryClient.invalidateQueries({ queryKey: ["/api/ministry/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ministry/stats"] });
    },
    onError: async (err: any) => {
      let message = "Something went wrong";
      try { message = (await err.json?.())?.message ?? message; } catch {}
      toast({ title: "Failed to grant role", description: message, variant: "destructive" });
    },
  });

  const handleGrant = () => {
    if (!username.trim()) return;
    grantMutation.mutate(username.trim());
  };

  return (
    <div className="glass-panel rounded-3xl p-8" data-testid="grant-ministry-panel">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20">
          <UserCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold">Grant Ministry Role</h3>
          <p className="text-sm text-muted-foreground">Ministry access only — designate a user as a ministry artist</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Enter username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleGrant()}
          className="bg-white/5 border-white/10"
          data-testid="input-grant-ministry-username"
        />
        <Button
          onClick={handleGrant}
          disabled={grantMutation.isPending || !username.trim()}
          data-testid="button-grant-ministry"
        >
          {grantMutation.isPending ? "Granting..." : "Grant"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        The user must already have an account. The ministry role allows them to appear on the Cypher voting panel as an eligible artist.
      </p>
    </div>
  );
}

function ProfileEditPanel({ user }: { user: { id: number; username: string; displayName?: string | null; bio?: string | null; avatarUrl?: string | null } }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    setDirty(false);
  }, [user.id]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/users/me", {
        displayName: displayName || undefined,
        bio: bio || undefined,
        avatarUrl: avatarUrl || undefined,
      }),
    onSuccess: async (res) => {
      const updated = await res.json();
      queryClient.setQueryData(["/api/auth/me"], updated);
      setDirty(false);
      toast({ title: "Profile updated" });
    },
    onError: async (err: any) => {
      let msg = "Failed to update profile";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleChange = (fn: () => void) => {
    fn();
    setDirty(true);
  };

  return (
    <div className="glass-panel rounded-3xl p-8" data-testid="profile-edit-panel">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/20">
          <User2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-display font-bold">Public Profile</h3>
          <p className="text-sm text-muted-foreground">How others see you in the Circle</p>
        </div>
        <Link href={`/profile/${user.username}`} className="ml-auto">
          <Button variant="outline" size="sm" className="border-white/10" data-testid="link-view-profile">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            View Profile
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display Name</label>
          <Input
            value={displayName}
            onChange={e => handleChange(() => setDisplayName(e.target.value))}
            placeholder={user.username}
            maxLength={60}
            className="bg-white/5 border-white/10"
            data-testid="input-display-name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bio</label>
          <Textarea
            value={bio}
            onChange={e => handleChange(() => setBio(e.target.value))}
            placeholder="Tell the Circle who you are…"
            maxLength={500}
            rows={3}
            className="bg-white/5 border-white/10 resize-none"
            data-testid="input-bio"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Avatar URL</label>
          <Input
            value={avatarUrl}
            onChange={e => handleChange(() => setAvatarUrl(e.target.value))}
            placeholder="https://…"
            className="bg-white/5 border-white/10"
            data-testid="input-avatar-url"
          />
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="avatar preview"
              className="mt-3 w-16 h-16 rounded-2xl object-cover border border-white/10"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        {dirty && (
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="w-full"
            data-testid="button-save-profile"
          >
            {updateMutation.isPending ? "Saving…" : "Save Profile"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, updateRoles, isUpdatingRoles } = useAuth();
  const { toast } = useToast();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rolesDirty, setRolesDirty] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const { data: subStatus } = useQuery<{ status: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: number }>({
    queryKey: ["/api/stripe/subscription-status"],
    enabled: !!user?.stripeCustomerId,
  });

  useEffect(() => {
    if (user && !rolesDirty) {
      setSelectedRoles(user.roles ?? []);
    }
  }, [user, rolesDirty]);

  if (!user) return null;

  /** Starts a recurring bestowal. Optional — nothing in the app requires it. */
  const startSupporting = async () => {
    setStartingCheckout(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/checkout");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.message || "Could not open checkout");
    } catch (err: any) {
      let msg = "Could not open checkout";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Checkout error", description: msg, variant: "destructive" });
      setStartingCheckout(false);
    }
  };

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.message || "Failed to open billing portal");
    } catch (err: any) {
      let msg = "Could not open billing portal";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Billing portal error", description: msg, variant: "destructive" });
    } finally {
      setOpeningPortal(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => {
      const next = prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role];
      setRolesDirty(true);
      return next;
    });
  };

  const handleSaveRoles = async () => {
    await updateRoles(selectedRoles);
    setRolesDirty(false);
  };

  const displayRoles = user.roles ?? [];
  const isMinistry = displayRoles.includes("ministry");

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <h1 className="text-4xl font-display font-bold mb-8">Account Settings</h1>

      <div className="grid gap-8">
        {/* Public Profile Editor */}
        <ProfileEditPanel user={user} />

        {/* Profile Card */}
        <div className="glass-panel rounded-3xl p-8 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-3xl font-display font-bold text-white">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-bold">{user.username}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground text-sm">Credits:</span>
              <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-sm">
                {user.credits || 0}
              </span>
            </div>
            {displayRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {displayRoles.map(r => <RoleBadge key={r} role={r} />)}
              </div>
            )}
          </div>
        </div>

        {/* Role Picker Card */}
        <div className="glass-panel rounded-3xl p-8">
          <div className="mb-6">
            <h3 className="text-2xl font-display font-bold mb-1">Your Roles in the Circle</h3>
            <p className="text-sm text-muted-foreground">Select every role that represents you. You can hold multiple roles.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {SELF_ASSIGNABLE_ROLES.map(role => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              const active = selectedRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  data-testid={`role-tile-${role}`}
                  className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                    active
                      ? `${config.color} border-current`
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`w-5 h-5 ${active ? "" : "text-muted-foreground"}`} />
                    <span className={`font-bold ${active ? "" : "text-foreground"}`}>{config.label}</span>
                    {active && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                  </div>
                  <p className={`text-xs leading-relaxed ${active ? "opacity-80" : "text-muted-foreground"}`}>
                    {config.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Ministry note */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${ROLE_CONFIG.ministry.color} mb-6`}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">
              <span className="font-bold">Ministry Role</span> is assigned exclusively by the Free Soul Movement — it cannot be self-selected.
            </p>
          </div>

          {rolesDirty && (
            <Button
              onClick={handleSaveRoles}
              disabled={isUpdatingRoles}
              className="w-full"
              data-testid="button-save-roles"
            >
              {isUpdatingRoles ? "Saving..." : "Save Roles"}
            </Button>
          )}
        </div>

        {/* Cypher Pass badge / progress — visible once user has any donations */}
        <CypherPassWidget />

        {/* Grant Ministry Role — ministry holders only */}
        {isMinistry && <GrantMinistryPanel />}

        {/* Ministry Treasury Widget — always visible as educational context */}
        <MinistryTreasuryWidget isMinistry={isMinistry} />

        {/* Subscription Card - anchor for Stripe return */}
        {/* Stripe return is handled globally in App.tsx */}
        <motion.div
          className={`rounded-3xl p-8 border relative overflow-hidden transition-colors duration-500
            ${user.isSubscribed ? 'bg-primary/5 border-primary/20' : 'glass-panel border-white/10'}`}
        >
          {user.isSubscribed && (
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          )}

          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${user.isSubscribed ? 'bg-primary text-white' : 'bg-white/10 text-white/50'}`}>
                  <Disc3 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-display font-bold">Support the Movement</h3>
              </div>

              {user.isSubscribed ? (
                <>
                  {subStatus?.status === 'canceled' || subStatus?.status === 'cancelled' ? (
                    <div className="flex items-center gap-2" data-testid="status-subscription-cancelled">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span className="text-rose-400 font-semibold">Cancelled</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-400/10 text-rose-400 border border-rose-400/20">Access ended</span>
                    </div>
                  ) : subStatus?.status === 'past_due' ? (
                    <div className="flex items-center gap-2" data-testid="status-subscription-past-due">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span className="text-amber-400 font-semibold">Past Due</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">Payment required</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2" data-testid="status-subscription-active">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <span className="text-primary font-semibold">Supporting</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">$8.88/mo</span>
                      {subStatus?.cancelAtPeriodEnd && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20" data-testid="status-cancel-at-period-end">
                          Cancels at period end
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Thank you. Your monthly bestowal sustains the land, tools and
                    gatherings of the Free Soul PMA. Every member may create,
                    contribute and take part whether or not they give.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground max-w-md" data-testid="text-support-explainer">
                    The Circle is open. Creating projects, uploading stems,
                    submitting contributions and taking part are free to every
                    member — nothing here is behind a payment.
                  </p>
                  <p className="text-2xl font-bold font-mono mt-4" data-testid="text-subscription-price">
                    $8.88<span className="text-base text-muted-foreground font-sans font-normal">/month</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    If you are able, a recurring bestowal sustains what the
                    Movement carries for everyone:
                  </p>
                  <ul className="space-y-3 mt-4">
                    {[
                      "Land, housing and gathering space for the tribe",
                      "Tools and studio resources shared across the Circle",
                      "Bestowals to ministry artists",
                      "Keeping the Circle free for those who cannot give",
                    ].map((feat, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> {feat}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {user.isSubscribed ? (
              <Button
                variant="outline"
                onClick={openBillingPortal}
                disabled={openingPortal}
                data-testid="button-manage-billing"
                className="w-full md:w-auto border-white/10 flex items-center gap-2"
              >
                {openingPortal ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</>
                ) : (
                  <><ExternalLink className="w-4 h-4" /> Manage Billing</>
                )}
              </Button>
            ) : (
              <Button
                onClick={startSupporting}
                disabled={startingCheckout}
                data-testid="button-subscribe"
                className="w-full md:w-auto px-8 py-4 h-auto rounded-xl font-semibold flex items-center gap-2"
              >
                {startingCheckout ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</>
                ) : (
                  <><Zap className="w-4 h-4 flex-shrink-0" /> Give monthly</>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
