import { Mic2, Headphones, Heart, Lightbulb, ShieldCheck, Film, SlidersHorizontal, PersonStanding } from "lucide-react";

export const ROLE_CONFIG = {
  producer: {
    label: "Producer",
    icon: Headphones,
    color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    description: "Submit beats, loops, stems, and full production ideas",
    submissionTypes: ["beat", "loop", "stem", "melody", "drum-kit", "collab-beat"],
  },
  writer: {
    label: "Writer / Artist",
    icon: Mic2,
    color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    description: "Contribute hooks, verses, song concepts, and vocal samples",
    submissionTypes: ["hook", "song-concept", "verse", "theme", "song-title", "vocal-sample"],
  },
  supporter: {
    label: "Supporter / Patron",
    icon: Heart,
    color: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    description: "Share mood boards, visual ideas, and narrative directions",
    submissionTypes: ["mood-board", "song-concept", "visual-idea", "narrative-idea"],
  },
  collaborator: {
    label: "Collaborator",
    icon: Lightbulb,
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    description: "Propose themes, challenges, and creative concepts",
    submissionTypes: ["theme", "challenge", "concept"],
  },
  videographer: {
    label: "Videographer / Marketing",
    icon: Film,
    color: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
    description: "Create music video concepts, promo assets, and visual campaigns. Negotiate up to 10% contribution bestowal.",
    submissionTypes: ["music-video-concept", "promo-asset", "social-media-pack", "visual-campaign"],
  },
  engineer: {
    label: "Recording Engineer",
    icon: SlidersHorizontal,
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    description: "Mix, master, and shape the sonic identity of projects. Negotiate up to 10% contribution bestowal.",
    submissionTypes: ["mix", "master", "vocal-production", "sound-design"],
  },
  dancer: {
    label: "Dancer / Actor",
    icon: PersonStanding,
    color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    description: "Choreography concepts, performance videos, and acting reels. Negotiate up to 10% contribution bestowal.",
    submissionTypes: ["choreography-concept", "performance-video", "acting-reel"],
  },
  ministry: {
    label: "Ministry",
    icon: ShieldCheck,
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    description: "Free Soul ecclesiastical stewards — assigned only",
    submissionTypes: [] as string[],
  },
} as const;

export type RoleKey = keyof typeof ROLE_CONFIG;

export function RoleBadge({ role, size = "sm" }: { role: string; size?: "sm" | "md" }) {
  const config = ROLE_CONFIG[role as RoleKey];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${config.color} ${size === "sm" ? "text-xs" : "text-sm px-3 py-1"}`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {config.label}
    </span>
  );
}

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  beat: "Beat",
  loop: "Loop",
  stem: "Stem",
  melody: "Melody Idea",
  "drum-kit": "Drum Kit",
  "collab-beat": "Collab Beat",
  hook: "Hook",
  "song-concept": "Song Concept",
  verse: "Verse",
  theme: "Theme",
  "song-title": "Song Title",
  "vocal-sample": "Vocal Sample",
  "mood-board": "Mood Board",
  "visual-idea": "Visual Idea",
  "narrative-idea": "Narrative Idea",
  challenge: "Challenge",
  concept: "Concept",
  "music-video-concept": "Music Video Concept",
  "promo-asset": "Promo Asset",
  "social-media-pack": "Social Media Pack",
  "visual-campaign": "Visual Campaign",
  mix: "Mix",
  master: "Master",
  "vocal-production": "Vocal Production",
  "sound-design": "Sound Design",
  "choreography-concept": "Choreography Concept",
  "performance-video": "Performance Video",
  "acting-reel": "Acting Reel",
};

export function getSubmissionTypesForRoles(roles: string[]): string[] {
  const types = new Set<string>();
  for (const role of roles) {
    const config = ROLE_CONFIG[role as RoleKey];
    if (config) config.submissionTypes.forEach(t => types.add(t));
  }
  return Array.from(types);
}

export const NEGOTIABLE_ROLES = ["videographer", "engineer", "dancer"] as const;
export function hasNegotiableRole(roles: string[]): boolean {
  return roles.some(r => (NEGOTIABLE_ROLES as readonly string[]).includes(r));
}
