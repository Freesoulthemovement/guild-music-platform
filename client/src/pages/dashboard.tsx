import { useState } from "react";
import { Link } from "wouter";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useAllSubmissions } from "@/hooks/use-submissions";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Music, Users, ArrowRight, Headphones, Mic2, Heart, Lightbulb, TrendingUp, Sparkles, Lock } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RoleBadge, SUBMISSION_TYPE_LABELS } from "@/components/role-badge";
import type { Submission, User, Project } from "@shared/schema";

type SubmissionWithContext = Submission & { user: User; project: Project };

const ROLE_CALLOUTS = [
  { role: "producer", icon: Headphones, message: "Drop beats, stems, loops" },
  { role: "writer", icon: Mic2, message: "Write hooks, verses, concepts" },
  { role: "supporter", icon: Heart, message: "Back projects and get credited" },
  { role: "collaborator", icon: Lightbulb, message: "Pitch themes and challenges" },
] as const;

// For each role, what submission types appear in THEIR feed (what they consume/look for):
// - Producer: sees own-type content (their peers' beats/loops) + collabs
// - Writer: sees BEATS to write on (producer types) — opportunities to add vocals/lyrics
// - Supporter: handled separately via ProjectsToBack component (projects with open investment)
// - Collaborator: sees themes/challenges open for response
const ROLE_FEED_CONFIG: Record<string, { heading: string; description: string; icon: typeof Headphones; color: string; submissionTypes: string[] }> = {
  producer: {
    heading: "Recent Beats & Production",
    description: "Latest stems, beats, and loops across the Circle",
    icon: Headphones,
    color: "text-violet-400",
    submissionTypes: ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"],
  },
  writer: {
    heading: "Beats Available to Write On",
    description: "Producer submissions open for hooks, verses, and vocal concepts",
    icon: Mic2,
    color: "text-sky-400",
    // Writers see PRODUCER-type submissions as opportunities to write on
    submissionTypes: ["beat", "loop", "stem", "collab-beat"],
  },
  collaborator: {
    heading: "Open Challenges & Themes",
    description: "Themes and concepts open for producer and artist responses",
    icon: Lightbulb,
    color: "text-amber-400",
    submissionTypes: ["theme", "challenge", "concept"],
  },
};

function RoleFeedSection({ role, submissions }: { role: string; submissions: SubmissionWithContext[] }) {
  const config = ROLE_FEED_CONFIG[role];
  if (!config) return null;
  const Icon = config.icon;
  const recent = submissions.slice(0, 4);
  return (
    <div className="space-y-3" data-testid={`feed-section-${role}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <div>
            <h3 className="font-display font-bold text-lg">{config.heading}</h3>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        {submissions.length > 0 && (
          <span className="text-xs text-muted-foreground">{submissions.length} total</span>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-xs text-muted-foreground text-center">
          No contributions here yet — be the first to submit one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recent.map(sub => (
            <Link key={sub.id} href={`/projects/${sub.projectId}`}>
              <div
                data-testid={`feed-submission-${sub.id}`}
                className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-sm line-clamp-1">{sub.title}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wide flex-shrink-0">
                    {SUBMISSION_TYPE_LABELS[sub.type] ?? sub.type}
                  </span>
                </div>
                {sub.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{sub.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">on <span className="text-white/70">{sub.project?.title}</span></span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {(sub.user?.roles ?? []).slice(0, 1).map(r => <RoleBadge key={r} role={r} />)}
                    <span>{sub.user?.username}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type ProjectWithCreator = { id: number; title: string; description: string | null; creator: User; investmentCount: number };

function SupporterProjectsSection({ projects }: { projects: ProjectWithCreator[] }) {
  const openProjects = projects.filter(p => p.investmentCount < 3);
  return (
    <div className="space-y-3" data-testid="feed-section-supporter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-rose-400" />
          <div>
            <h3 className="font-display font-bold text-lg">Projects to Back</h3>
            <p className="text-xs text-muted-foreground">Active projects with open investment slots — back them and earn credits</p>
          </div>
        </div>
        {openProjects.length > 0 && (
          <span className="text-xs text-muted-foreground">{openProjects.length} open</span>
        )}
      </div>
      {openProjects.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-xs text-muted-foreground text-center">
          All projects are fully backed — check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {openProjects.slice(0, 4).map(p => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <div
                data-testid={`supporter-project-${p.id}`}
                className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-rose-400/10 text-rose-400 border border-rose-400/20 flex-shrink-0">
                    {3 - p.investmentCount} slots left
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{p.description}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  by <span className="text-white/70">{p.creator?.username}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleAwareFeed({ userRoles, submissions, projects }: { userRoles: string[]; submissions: SubmissionWithContext[]; projects: ProjectWithCreator[] }) {
  if (userRoles.length === 0) return null;

  const hasSupporter = userRoles.includes('supporter');
  const submissionRoles = userRoles.filter(r => r !== 'ministry' && r !== 'supporter' && ROLE_FEED_CONFIG[r]);
  if (!hasSupporter && submissionRoles.length === 0) return null;

  return (
    <div className="mb-12 space-y-8" data-testid="for-your-circle">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-display font-bold">For Your Circle</h2>
        <span className="text-xs text-muted-foreground ml-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
          Filtered by your roles
        </span>
      </div>
      {hasSupporter && <SupporterProjectsSection projects={projects as ProjectWithCreator[]} />}
      {submissionRoles.map(role => {
        const config = ROLE_FEED_CONFIG[role];
        const roleSubs = submissions.filter(s => config.submissionTypes.includes(s.type));
        return <RoleFeedSection key={role} role={role} submissions={roleSubs} />;
      })}
      <div className="border-t border-white/5" />
    </div>
  );
}

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const { user } = useAuth();
  const createProject = useCreateProject();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const userRoles = user?.roles ?? [];

  // Compute what submission types this user CONSUMES in their feed (differs from what they submit)
  const feedTypes = new Set<string>();
  for (const role of userRoles) {
    const config = ROLE_FEED_CONFIG[role];
    if (config) config.submissionTypes.forEach(t => feedTypes.add(t));
  }
  const feedTypesArr = Array.from(feedTypes);
  const { data: allSubmissions } = useAllSubmissions(feedTypesArr.length > 0 ? feedTypesArr : undefined);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProject.mutateAsync({ title, description });
    setIsOpen(false);
    setTitle("");
    setDescription("");
  };

  const hasRoles = userRoles.length > 0;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Role prompt if user has no roles set */}
      {!hasRoles && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 rounded-2xl border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="font-semibold text-sm mb-1">What's your role in the Circle?</p>
            <p className="text-xs text-muted-foreground">Set your creative roles to see a personalized feed and unlock submission types.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLE_CALLOUTS.map(({ role, icon: Icon, message }) => (
              <div key={role} className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                <Icon className="w-3 h-3" />
                {message}
              </div>
            ))}
            <Link href="/account">
              <button className="text-xs font-semibold text-primary px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10">
                Set My Roles
              </button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Role-aware submissions feed */}
      {hasRoles && (
        <RoleAwareFeed
          userRoles={userRoles}
          submissions={allSubmissions ?? []}
          projects={projects ?? []}
        />
      )}

      {/* All Projects Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight mb-2">Active Sessions</h1>
          <p className="text-muted-foreground text-lg">Discover and contribute to ongoing projects in the Circle.</p>
          {hasRoles && (
            <div className="flex flex-wrap gap-2 mt-3">
              {userRoles.map(r => <RoleBadge key={r} role={r} size="sm" />)}
            </div>
          )}
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button
              data-testid="button-new-project"
              className="px-6 py-3 rounded-xl font-semibold bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          </DialogTrigger>

          <DialogContent className="glass-panel border-white/10 sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Start a Session</DialogTitle>
              <DialogDescription>Open a new creative space for the Circle to contribute to.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-6 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Title</label>
                <Input
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Synthwave"
                  className="bg-background/50 border-white/10"
                  required
                  data-testid="input-project-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description & Direction</label>
                <Textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's the vibe? What do you need from the Circle?"
                  className="bg-background/50 border-white/10 min-h-[120px]"
                  required
                  data-testid="textarea-project-description"
                />
              </div>
              <button
                type="submit" disabled={createProject.isPending}
                className="w-full h-12 rounded-xl font-semibold bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50"
                data-testid="button-create-project"
              >
                {createProject.isPending ? "Creating..." : "Initialize Project"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[280px] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-24 glass-panel rounded-3xl border-dashed">
          <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-display font-medium mb-2">No active sessions</h3>
          <p className="text-muted-foreground">Be the first to open a creative space.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {projects?.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
              >
                <Link href={`/projects/${project.id}`}>
                  <div
                    data-testid={`card-project-${project.id}`}
                    className="group h-full glass-panel rounded-2xl p-6 hover-glow cursor-pointer flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {project.title.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {project.createdAt ? format(new Date(project.createdAt), "MMM d") : ""}
                      </span>
                    </div>

                    <h3 className="text-xl font-display font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-muted-foreground text-sm flex-1 line-clamp-3 mb-4">
                      {project.description}
                    </p>

                    {(project.creator?.roles ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {(project.creator.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>by {project.creator?.username || 'Unknown'}</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
