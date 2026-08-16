import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ListMusic } from "lucide-react";
import type { Playlist } from "@shared/schema";

type PlaylistWithCount = Playlist & { trackCount: number };

export function AddToPlaylistMenu({
  submissionId,
  buttonClassName,
}: {
  submissionId: number;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: playlists = [] } = useQuery<PlaylistWithCount[]>({
    queryKey: ["/api/playlists"],
    enabled: open,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const addTrack = async (playlistId: number) => {
    await apiRequest("POST", `/api/playlists/${playlistId}/tracks`, { submissionId });
    queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className={buttonClassName ?? "h-7 w-7 rounded-full hover:bg-white/10"}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        data-testid={`button-add-to-playlist-${submissionId}`}
        title="Add to playlist"
      >
        <ListMusic className="w-3.5 h-3.5" />
      </Button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-white/10 bg-[#0d0d14] shadow-2xl z-50 overflow-hidden">
          <div className="p-2">
            <p className="text-xs text-muted-foreground px-2 pb-2 font-medium">Add to playlist</p>
            {playlists.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">No playlists yet</p>
            ) : (
              playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => addTrack(pl.id)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                  data-testid={`menu-add-to-${pl.id}-submission-${submissionId}`}
                >
                  <span className="truncate">{pl.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{pl.trackCount}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
8