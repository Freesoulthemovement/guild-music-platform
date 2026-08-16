import { useState, useEffect } from "react";
import { usePlayer } from "@/context/player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  ChevronUp, ChevronDown, X, Music2,
} from "lucide-react";
import { SUBMISSION_TYPE_LABELS } from "@/components/role-badge";

export function MiniPlayer() {
  const { state, currentTrack, togglePlay, next, prev, setVolume, setExpanded, close, audioRef } = usePlayer();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
    };
  }, []);

  if (!currentTrack) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const seek = (value: number[]) => {
    const audio = audioRef.current;
    if (audio && duration > 0) {
      audio.currentTime = (value[0] / 100) * duration;
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !muted;
      setMuted(!muted);
    }
  };

  if (state.expanded) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-2xl"
        data-testid="now-playing-overlay"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <Button variant="ghost" size="icon" onClick={() => setExpanded(false)} className="rounded-full hover:bg-white/5">
            <ChevronDown className="w-5 h-5" />
          </Button>
          <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">Now Playing</span>
          <Button variant="ghost" size="icon" onClick={close} className="rounded-full hover:bg-white/5" data-testid="button-close-player">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
          <div className="w-64 h-64 rounded-3xl bg-gradient-to-br from-primary/30 to-accent/20 border border-white/10 flex items-center justify-center">
            <Music2 className="w-20 h-20 text-primary/50" />
          </div>

          <div className="text-center w-full max-w-sm">
            <h2 className="text-2xl font-display font-bold mb-1 truncate">{currentTrack.title}</h2>
            <p className="text-muted-foreground text-sm">{currentTrack.artist}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{currentTrack.projectTitle}</p>
            <div className="mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                {SUBMISSION_TYPE_LABELS[currentTrack.type] ?? currentTrack.type}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-2">
            <Slider
              value={[pct]}
              onValueChange={seek}
              min={0}
              max={100}
              step={0.1}
              className="w-full"
              data-testid="slider-seek"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={prev} className="rounded-full hover:bg-white/10 h-10 w-10" data-testid="button-prev">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              onClick={togglePlay}
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
              data-testid="button-play-pause-expanded"
            >
              {state.playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={next} className="rounded-full hover:bg-white/10 h-10 w-10" data-testid="button-next">
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-7 w-7 rounded-full hover:bg-white/10 flex-shrink-0">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
              value={[muted ? 0 : state.volume * 100]}
              onValueChange={v => setVolume(v[0] / 100)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
              data-testid="slider-volume-expanded"
            />
            {currentTrack.id > 0 && <AddToPlaylistMenu submissionId={currentTrack.id} />}
          </div>

          {state.queue.length > 1 && (
            <div className="w-full max-w-sm">
              <p className="text-xs text-muted-foreground font-medium mb-2">Queue ({state.queue.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {state.queue.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${i === state.currentIndex ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5"} transition-colors`}
                    data-testid={`queue-item-${t.id}`}
                  >
                    <span className="w-4 text-xs font-mono">{i + 1}</span>
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-xs flex-shrink-0">{t.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-background/90 backdrop-blur-xl"
      data-testid="mini-player"
    >
      <div className="w-full h-0.5 bg-white/5">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(true)}
          data-testid="mini-player-track-info"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Music2 className="w-4 h-4 text-primary/70" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist} · {currentTrack.projectTitle}</p>
          </div>
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8 rounded-full hover:bg-white/10" data-testid="button-prev-mini">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={togglePlay} className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90" data-testid="button-play-pause-mini">
            {state.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 rounded-full hover:bg-white/10" data-testid="button-next-mini">
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        <div className="hidden sm:flex items-center gap-2 w-24 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-7 w-7 rounded-full hover:bg-white/10 flex-shrink-0">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </Button>
          <Slider
            value={[muted ? 0 : state.volume * 100]}
            onValueChange={v => setVolume(v[0] / 100)}
            min={0}
            max={100}
            step={1}
            className="flex-1"
            data-testid="slider-volume-mini"
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {currentTrack.id > 0 && <AddToPlaylistMenu submissionId={currentTrack.id} />}
          <Button variant="ghost" size="icon" onClick={close} className="h-7 w-7 rounded-full hover:bg-white/10" data-testid="button-close-mini">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
