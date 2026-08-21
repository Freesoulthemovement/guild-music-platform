import { useQuery } from "@tanstack/react-query";
import { Crown, Vote, Users, ShieldCheck, Music2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MinistryPage() {
  const { data: stats } = useQuery<{ passHolders: number; totalVotes: number }>({
    queryKey: ["/api/ministry/stats"],
  });

  const { data: artists = [] } = useQuery<{ id: number; username: string; displayName: string | null; roles: string[] }[]>({
    queryKey: ["/api/ministry/artists"],
  });

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
          <ShieldCheck className="w-4 h-4" />
          Free Soul Ecclesiastical Movement
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold mb-3">Ministry</h1>
        <p className="text-muted-foreground max-w-xl leading-relaxed">
          The ministry artists of the Movement. Cypher Pass holders bestow votes to shape who performs at each gathering.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10"
        data-testid="ministry-stats-section"
      >
        <div className="glass-panel rounded-2xl p-5 text-center" data-testid="stat-pass-holders-ministry">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">Cypher Pass Holders</span>
          </div>
          <p className="text-3xl font-display font-bold tabular-nums">{stats?.passHolders ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5 text-center" data-testid="stat-total-votes-ministry">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Vote className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Votes Cast</span>
          </div>
          <p className="text-3xl font-display font-bold tabular-nums">{stats?.totalVotes ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5 text-center col-span-2 sm:col-span-1" data-testid="stat-artist-count-ministry">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Users className="w-4 h-4 text-primary/70" />
            <span className="text-xs text-muted-foreground">Ministry Artists</span>
          </div>
          <p className="text-3xl font-display font-bold tabular-nums">{artists.length}</p>
        </div>
      </motion.div>

      {/* Artist roster */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
          <Music2 className="w-5 h-5 text-primary" />
          Artist Roster
        </h2>

        {artists.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center" data-testid="no-artists-message">
            <Music2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No ministry artists designated yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Ministry roles are assigned by movement leadership.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="artist-roster">
            {artists.map((artist, i) => (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="glass-panel rounded-2xl p-4 flex items-center gap-4"
                data-testid={`artist-row-${artist.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {(artist.displayName || artist.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{artist.displayName || artist.username}</p>
                  <p className="text-xs text-muted-foreground">@{artist.username}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 font-medium flex-shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  Ministry
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
