import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Music2, Users, Disc3, Radio, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

type FeedItem = {
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
  createdAt: string;
};

function ActorAvatar({ item }: { item: FeedItem }) {
  if (item.actorAvatarUrl) {
    return (
      <img
        src={item.actorAvatarUrl}
        alt={item.actorUsername}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initial = (item.actorDisplayName ?? item.actorUsername).charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-white">{initial}</span>
    </div>
  );
}

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const typeColors: Record<string, string> = {
    beat: "bg-primary/20 text-primary",
    hook: "bg-accent/20 text-accent",
    stem: "bg-emerald-500/20 text-emerald-400",
    mix: "bg-amber-500/20 text-amber-400",
    loop: "bg-violet-500/20 text-violet-400",
    verse: "bg-rose-500/20 text-rose-400",
  };
  const color = item.subType ? (typeColors[item.subType] ?? "bg-white/10 text-muted-foreground") : "bg-white/10 text-muted-foreground";
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-panel rounded-2xl p-4 flex items-start gap-4"
      data-testid={`feed-item-${item.id}`}
    >
      <Link href={`/profile/${item.actorUsername}`}>
        <ActorAvatar item={item} />
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <Link href={`/profile/${item.actorUsername}`} className="font-bold hover:text-primary transition-colors">
            {item.actorDisplayName ?? item.actorUsername}
          </Link>
          {" "}
          <span className="text-muted-foreground">
            {item.type === "submission" ? "contributed" : "started a project"}
          </span>
        </p>

        <Link href={`/projects/${item.projectId}`} className="group">
          <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
            <div className="flex items-start gap-2">
              <div className={`p-1.5 rounded-lg ${color} flex-shrink-0`}>
                <Music2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{item.title}</p>
                {item.projectTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    on <span className="text-foreground/70">{item.projectTitle}</span>
                  </p>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {item.subType && (
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-2 ${color}`}>{item.subType}</span>
            )}
          </div>
        </Link>

        <p className="text-xs text-muted-foreground mt-2">{timeAgo}</p>
      </div>
    </motion.div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();

  const { data: feed = [], isLoading } = useQuery<FeedItem[]>({
    queryKey: ["/api/feed"],
  });

  if (!user) return null;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-primary/20">
          <Radio className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Circle Feed</h1>
          <p className="text-sm text-muted-foreground">Latest from creators you follow</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && feed.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-3xl p-12 text-center"
          data-testid="empty-feed"
        >
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-display font-bold mb-2">Your feed is quiet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Follow creators in the Circle to see their contributions here.
          </p>
          <Link href="/">
            <Button>
              <Disc3 className="w-4 h-4 mr-2" />
              Explore Projects
            </Button>
          </Link>
        </motion.div>
      )}

      {!isLoading && feed.length > 0 && (
        <div className="space-y-4">
          {feed.map((item, i) => (
            <FeedCard key={`${item.type}-${item.id}`} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
8