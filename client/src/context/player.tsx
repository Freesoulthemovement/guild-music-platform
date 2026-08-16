import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from "react";
import type { Submission, User, Project } from "@shared/schema";

export type PlayerTrack = {
  id: number;
  title: string;
  type: string;
  artist: string;
  fileUrl: string | null;
  projectTitle: string;
  projectId: number;
};

export function submissionToTrack(sub: Submission & { user: User; project: Project }): PlayerTrack {
  return {
    id: sub.id,
    title: sub.title,
    type: sub.type,
    artist: sub.user?.displayName ?? sub.user?.username ?? "Unknown",
    fileUrl: sub.fileUrl ?? null,
    projectTitle: sub.project?.title ?? "",
    projectId: sub.projectId,
  };
}

type PlayerState = {
  queue: PlayerTrack[];
  currentIndex: number;
  playing: boolean;
  volume: number;
  expanded: boolean;
};

type PlayerAction =
  | { type: "PLAY_TRACK"; track: PlayerTrack }
  | { type: "PLAY_QUEUE"; queue: PlayerTrack[]; startIndex: number }
  | { type: "ADD_TO_QUEUE"; track: PlayerTrack }
  | { type: "TOGGLE_PLAY" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "SET_EXPANDED"; expanded: boolean }
  | { type: "CLOSE" };

const initialState: PlayerState = {
  queue: [],
  currentIndex: 0,
  playing: false,
  volume: 0.8,
  expanded: false,
};

function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "PLAY_TRACK":
      return { ...state, queue: [action.track], currentIndex: 0, playing: true };
    case "PLAY_QUEUE":
      return { ...state, queue: action.queue, currentIndex: action.startIndex, playing: true };
    case "ADD_TO_QUEUE":
      return { ...state, queue: [...state.queue, action.track] };
    case "TOGGLE_PLAY":
      return { ...state, playing: !state.playing };
    case "NEXT": {
      const nextIndex = (state.currentIndex + 1) % Math.max(state.queue.length, 1);
      return { ...state, currentIndex: nextIndex, playing: state.queue.length > 0 };
    }
    case "PREV": {
      const prevIndex = (state.currentIndex - 1 + state.queue.length) % Math.max(state.queue.length, 1);
      return { ...state, currentIndex: prevIndex, playing: state.queue.length > 0 };
    }
    case "SET_VOLUME":
      return { ...state, volume: action.volume };
    case "SET_EXPANDED":
      return { ...state, expanded: action.expanded };
    case "CLOSE":
      return { ...state, queue: [], currentIndex: 0, playing: false, expanded: false };
    default:
      return state;
  }
}

type PlayerContextType = {
  state: PlayerState;
  currentTrack: PlayerTrack | null;
  playTrack: (track: PlayerTrack) => void;
  playQueue: (queue: PlayerTrack[], startIndex?: number) => void;
  addToQueue: (track: PlayerTrack) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  setExpanded: (e: boolean) => void;
  close: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const currentTrack = state.queue[state.currentIndex] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack?.fileUrl) {
      if (audio.src !== currentTrack.fileUrl) {
        audio.src = currentTrack.fileUrl;
      }
    } else {
      audio.src = "";
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.playing, currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = state.volume;
  }, [state.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => dispatch({ type: "NEXT" });
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const playTrack = useCallback((track: PlayerTrack) => dispatch({ type: "PLAY_TRACK", track }), []);
  const playQueue = useCallback((queue: PlayerTrack[], startIndex = 0) => dispatch({ type: "PLAY_QUEUE", queue, startIndex }), []);
  const addToQueue = useCallback((track: PlayerTrack) => dispatch({ type: "ADD_TO_QUEUE", track }), []);
  const togglePlay = useCallback(() => dispatch({ type: "TOGGLE_PLAY" }), []);
  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const prev = useCallback(() => dispatch({ type: "PREV" }), []);
  const setVolume = useCallback((volume: number) => dispatch({ type: "SET_VOLUME", volume }), []);
  const setExpanded = useCallback((expanded: boolean) => dispatch({ type: "SET_EXPANDED", expanded }), []);
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);

  return (
    <PlayerContext.Provider value={{ state, currentTrack, playTrack, playQueue, addToQueue, togglePlay, next, prev, setVolume, setExpanded, close, audioRef }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
