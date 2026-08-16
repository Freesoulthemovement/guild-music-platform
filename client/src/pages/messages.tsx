import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, ArrowLeft, Users, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Conversation = {
  partnerId: number;
  partnerUsername: string;
  partnerDisplayName: string | null;
  partnerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type MessageItem = {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
  receiver: { id: number; username: string; displayName: string | null; avatarUrl: string | null };
};

function UserAvatar({ user, size = 40 }: { user: { username: string; displayName?: string | null; avatarUrl?: string | null }; size?: number }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.username} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const init = (user.displayName ?? user.username).charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>{init}</span>
    </div>
  );
}

function ConversationSidebar({
  convos,
  activeUsername,
  onSelect,
}: {
  convos: Conversation[];
  activeUsername: string | null;
  onSelect: (u: string) => void;
}) {
  return (
    <div className="w-full sm:w-72 flex-shrink-0 space-y-1" data-testid="conversation-list">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-2">Messages</h2>
      {convos.length === 0 && (
        <p className="text-sm text-muted-foreground px-2 py-4 text-center" data-testid="empty-conversations">No conversations yet</p>
      )}
      {convos.map(c => (
        <button
          key={c.partnerUsername}
          onClick={() => onSelect(c.partnerUsername)}
          data-testid={`convo-${c.partnerUsername}`}
          className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${
            activeUsername === c.partnerUsername
              ? "bg-primary/10 border border-primary/20"
              : "hover:bg-white/5 border border-transparent"
          }`}
        >
          <div className="relative">
            <UserAvatar user={{ username: c.partnerUsername, displayName: c.partnerDisplayName, avatarUrl: c.partnerAvatarUrl }} size={40} />
            {c.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-white flex items-center justify-center">
                {c.unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${c.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
              {c.partnerDisplayName ?? c.partnerUsername}
            </p>
            <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
          </div>
          <p className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: false })}
          </p>
        </button>
      ))}
    </div>
  );
}

function MessageThread({ partnerUsername, myId }: { partnerUsername: string; myId: number }) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread = [], isLoading } = useQuery<MessageItem[]>({
    queryKey: ["/api/messages", partnerUsername],
    queryFn: () => fetch(`/api/messages/${partnerUsername}`).then(r => r.json()),
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
  }, [thread.length]);

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", "/api/messages", { receiverUsername: partnerUsername, body: text }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", partnerUsername] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: async (err: any) => {
      let msg = "Failed to send";
      try { msg = (await err.json?.())?.message ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid={`thread-${partnerUsername}`}>
      {/* Thread header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-4 flex-shrink-0">
        <Link href={`/profile/${partnerUsername}`}>
          <span className="font-bold hover:text-primary transition-colors">@{partnerUsername}</span>
        </Link>
        <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 animate-pulse" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <AnimatePresence initial={false}>
          {thread.map(msg => {
            const isMe = msg.senderId === myId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                {!isMe && <UserAvatar user={msg.sender} size={28} />}
                <div
                  className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white/10 text-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="leading-relaxed">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {isMe && <UserAvatar user={msg.sender} size={28} />}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex gap-2 mt-4 flex-shrink-0">
        <Input
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message…"
          className="bg-white/5 border-white/10 flex-1"
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={!body.trim() || sendMutation.isPending}
          size="icon"
          data-testid="button-send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [location] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const withParam = params.get("with");

  const [activePartner, setActivePartner] = useState<string | null>(withParam);

  const { data: convos = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (withParam && !activePartner) setActivePartner(withParam);
  }, [withParam]);

  if (!user) return null;

  return (
    <div className="min-h-screen pt-24 pb-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/20">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold">Messages</h1>
      </div>

      <div className="glass-panel rounded-3xl p-6 flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Sidebar */}
        <ConversationSidebar
          convos={convos}
          activeUsername={activePartner}
          onSelect={u => setActivePartner(u)}
        />

        {/* Divider */}
        <div className="hidden sm:block w-px bg-white/5 flex-shrink-0" />

        {/* Thread / Empty state */}
        <div className="flex-1 flex flex-col min-h-0">
          {activePartner ? (
            <MessageThread partnerUsername={activePartner} myId={user.id} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4" data-testid="empty-thread">
              <Users className="w-12 h-12 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">
                Select a conversation or visit a creator's profile to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
8