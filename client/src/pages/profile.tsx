import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/role-badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  UserPlus, UserMinus, MessageSquare, Music2, FileText, Disc3,
  Users, Layers, ExternalLink, ArrowLeft
} from "lucide-react";
import type { User, Submission, Project } from "@shared/schema";

type PublicProfile = User & {
  followerCount: number;
  followingCount: number;
  submissionCount: number;
  projectCount: number;
  isFollowing: boolean;
  collaboratedProjects: { id: number; title: string; description: string }[];
};

function AvatarCircle({ user, size = 80 }: { user: PublicProfile; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className="rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (user.displayName ?? user.username).charAt(0).toUpperCase();
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="font-display font-bold text-white" style={{ fontSize: size * 0.4 }}>
        {initials}
      </span>
    </div>
  );
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const typeColors: Record<string, string> = {
    beat: "bg-primary/20 text-primary",
    hook: "bg-accent/20 text-accent",
    stem: "bg-emerald-500/20 text-emerald-400",
    mix: "bg-amber-500/20 text-amber-400",
    loop: "bg-violet-500/20 text-violet-400",
    verse: "bg-rose-500/20 text-rose-400",
  };
  const color = typeColors[sub.type] ?? "bg-white/10 text-muted-foreground";
  return (
    <div className="glass-panel rounded-2xl p-4 flex items-start gap-3" data-testid={`card-submission-${sub.id}`}>
      <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
        <Music2 className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{sub.title}</p>
        {sub.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{sub.description}</p>}
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1.5 ${color}`}>{sub.type}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isMe = me?.username === username;

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: [`/api/users/${username}`],
    enabled: !!username,
  });

  const { data: submissions = [] } = useQuery<Submission[]>({
    queryKey: [`/api/users/${username}/submissions`],
    enabled: !!username,
  });

  const followMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/users/${username}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${username}`] });
      toast({ title: `Following ${username}` });
    },
    onError: async (err: any) => {
      let msg = "Could not follow";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/users/${username}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${username}`] });
      toast({ title: `Unfollowed ${username}` });
    },
    onError: async (err: any) => {
      let msg = "Could not unfollow";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">This creator wasn't found in the Circle.</p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const displayRoles = profile.roles ?? [];
  const beatTypes = ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"];
  const beats = submissions.filter(s => beatTypes.includes(s.type));
  const other = submissions.filter(s => !beatTypes.includes(s.type));

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header card */}
        <div className="glass-panel rounded-3xl p-8 mb-6" data-testid="profile-header">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <AvatarCircle user={profile} size={96} />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-display font-bold truncate" data-testid="text-profile-name">
                {profile.displayName ?? profile.username}
              </h1>
              <p className="text-muted-foreground text-sm mb-2" data-testid="text-profile-username">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-muted-foreground/80 max-w-lg leading-relaxed mb-3" data-testid="text-profile-bio">
                  {profile.bio}
                </p>
              )}
              {displayRoles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {displayRoles.map(r => <RoleBadge key={r} role={r} />)}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {me && !isMe && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                {profile.isFollowing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unfollowMutation.mutate()}
                    disabled={unfollowMutation.isPending}
                    className="border-white/10"
                    data-testid="button-unfollow"
                  >
                    <UserMinus className="w-4 h-4 mr-1.5" />
                    Following
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    data-testid="button-follow"
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Follow
                  </Button>
                )}
                <Link href={`/messages?with=${username}`}>
                  <Button variant="outline" size="sm" className="border-white/10 w-full" data-testid="button-message">
                    <MessageSquare className="w-4 h-4 mr-1.5" />
                    Message
                  </Button>
                </Link>
              </div>
            )}
            {isMe && (
              <Link href="/account">
                <Button variant="outline" size="sm" className="border-white/10" data-testid="button-edit-profile">
                  Edit Profile
                </Button>
              </Link>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-6 pt-6 border-t border-white/5">
            {[
              { label: "Contributions", value: profile.submissionCount, icon: Layers },
              { label: "Followers", value: profile.followerCount, icon: Users },
              { label: "Following", value: profile.followingCount, icon: UserPlus },
              { label: "Projects", value: profile.projectCount, icon: Disc3 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center" data-testid={`stat-${label.toLowerCase()}`}>
                <div className="flex items-center gap-1 justify-center text-muted-foreground mb-0.5">
                  <Icon className="w-3 h-3" />
                </div>
                <p className="text-lg font-bold font-mono">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio */}
        <div className="grid gap-6">
          {beats.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
                <Music2 className="w-4 h-4 text-primary" /> Beat Portfolio
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {beats.map(sub => <SubmissionCard key={sub.id} sub={sub} />)}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> Other Contributions
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {other.map(sub => <SubmissionCard key={sub.id} sub={sub} />)}
              </div>
            </section>
          )}

          {/* Collaborations — projects the user contributed to but didn't create */}
          {profile.collaboratedProjects.length > 0 && (
            <section>
              <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Collaborations
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.collaboratedProjects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 hover:border-primary/20 border border-transparent transition-colors cursor-pointer" data-testid={`collab-project-${p.id}`}>
                      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                        <ExternalLink className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {submissions.length === 0 && (
            <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground" data-testid="empty-submissions">
              <Music2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No public contributions yet</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
