import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePlayer, submissionToTrack } from "@/context/player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ListMusic, Plus, Trash2, Play, Radio, Music2, Loader2, ChevronUp, ChevronDown,
} from "lucide-react";
import { SUBMISSION_TYPE_LABELS } from "@/components/role-badge";
import type { Playlist, Submission, User, Project } from "@shared/schema";

type PlaylistWithCount = Playlist & { trackCount: number };
type FullPlaylist = Playlist & {
  tracks: Array<{
    id: number;
    submissionId: number;
    position: number;
    submission: Submission & { user: User };
  }>;
};
type RadioTrack = Submission & { user: User; project: Project };

export default function PlaylistsPage() {
  const { playQueue, playTrack, state } = usePlayer();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [radioPlaying, setRadioPlaying] = useState(false);

  const { data: playlists = [], isLoading } = useQuery<PlaylistWithCount[]>({
    queryKey: ["/api/playlists"],
  });

  const { data: fullPlaylist } = useQuery<FullPlaylist>({
    queryKey: ["/api/playlists", selectedPlaylist],
    enabled: selectedPlaylist !== null,
  });

  const { data: radioTracks = [], isFetching: radioFetching } = useQuery<RadioTrack[]>({
    queryKey: ["/api/radio"],
    enabled: false,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/playlists", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setCreateOpen(false);
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/playlists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      if (selectedPlaylist !== null) setSelectedPlaylist(null);
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: ({ playlistId, submissionId }: { playlistId: number; submissionId: number }) =>
      apiRequest("DELETE", `/api/playlists/${playlistId}/tracks/${submissionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      if (selectedPlaylist !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", selectedPlaylist] });
      }
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ playlistId, order }: { playlistId: number; order: number[] }) =>
      apiRequest("PATCH", `/api/playlists/${playlistId}/tracks/reorder`, { order }),
    onSuccess: () => {
      if (selectedPlaylist !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", selectedPlaylist] });
      }
    },
  });

  const moveTrack = (playlistId: number, tracks: FullPlaylist["tracks"], fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= tracks.length) return;
    const newOrder = [...tracks];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    reorderMutation.mutate({ playlistId, order: newOrder.map(t => t.submissionId) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  };

  const handlePlayPlaylist = async (playlistId: number) => {
    const pl = await queryClient.fetchQuery<FullPlaylist>({
      queryKey: ["/api/playlists", playlistId],
    });
    if (!pl || pl.tracks.length === 0) return;
    const tracks = pl.tracks.map(t => ({
      id: t.submission.id,
      title: t.submission.title,
      type: t.submission.type,
      artist: t.submission.user?.displayName ?? t.submission.user?.username ?? "Unknown",
      fileUrl: t.submission.fileUrl ?? null,
      projectTitle: "",
      projectId: t.submission.projectId,
    }));
    playQueue(tracks, 0);
  };

  const handlePlayRadio = async () => {
    setRadioPlaying(true);
    try {
      const tracks = await queryClient.fetchQuery<RadioTrack[]>({
        queryKey: ["/api/radio"],
      });
      if (!tracks || tracks.length === 0) return;
      const playerTracks = tracks.map(submissionToTrack);
      playQueue(playerTracks, 0);
    } finally {
      setRadioPlaying(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Playlists</h1>
          <p className="text-muted-foreground text-sm mt-1">Curate your creative listening experience</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-playlist">
              <Plus className="w-4 h-4" /> New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <Input
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Playlist name…"
                className="bg-background/50 border-white/10"
                data-testid="input-playlist-name"
              />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-confirm-create-playlist">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Private Radio Banner */}
      <div className="glass-panel rounded-3xl p-6 mb-8 relative overflow-hidden" data-testid="radio-banner">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/20 flex items-center justify-center">
              <Radio className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">Private Radio</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Stream all accessible submissions in shuffle mode</p>
            </div>
          </div>
          <Button
            className="bg-accent hover:bg-accent/90 text-background font-bold gap-2 flex-shrink-0"
            onClick={handlePlayRadio}
            disabled={radioPlaying}
            data-testid="button-play-radio"
          >
            {radioPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {radioPlaying ? "Loading…" : "Start Radio"}
          </Button>
        </div>
      </div>

      {/* Playlist List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && playlists.length === 0 && (
          <div className="glass-panel rounded-3xl p-12 text-center" data-testid="empty-playlists">
            <ListMusic className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No playlists yet. Create one to start curating.</p>
          </div>
        )}

        {playlists.map(pl => (
          <div key={pl.id} data-testid={`playlist-card-${pl.id}`} className="glass-panel rounded-2xl overflow-hidden">
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setSelectedPlaylist(selectedPlaylist === pl.id ? null : pl.id)}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Music2 className="w-6 h-6 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{pl.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-primary/10"
                  onClick={e => { e.stopPropagation(); handlePlayPlaylist(pl.id); }}
                  disabled={pl.trackCount === 0}
                  data-testid={`button-play-playlist-${pl.id}`}
                  title="Play playlist"
                >
                  <Play className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={e => { e.stopPropagation(); deleteMutation.mutate(pl.id); }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-playlist-${pl.id}`}
                  title="Delete playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {selectedPlaylist === pl.id && fullPlaylist && (
              <div className="border-t border-white/5 px-5 pb-5">
                {fullPlaylist.tracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No tracks yet. Add them from project pages.</p>
                ) : (
                  <div className="space-y-1 mt-3">
                    {fullPlaylist.tracks.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group"
                        data-testid={`track-item-${t.id}`}
                      >
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => moveTrack(pl.id, fullPlaylist.tracks, i, i - 1)}
                            disabled={i === 0 || reorderMutation.isPending}
                            data-testid={`button-move-up-${t.id}`}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => moveTrack(pl.id, fullPlaylist.tracks, i, i + 1)}
                            disabled={i === fullPlaylist.tracks.length - 1 || reorderMutation.isPending}
                            data-testid={`button-move-down-${t.id}`}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.submission.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.submission.user?.displayName ?? t.submission.user?.username} · {SUBMISSION_TYPE_LABELS[t.submission.type] ?? t.submission.type}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeTrackMutation.mutate({ playlistId: pl.id, submissionId: t.submission.id })}
                          data-testid={`button-remove-track-${t.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
