import { Link, useLocation } from "wouter";
import { Disc3, UserCircle, LogOut, Zap, Star, ShieldCheck, Radio, MessageSquare, ListMusic, Book, Sprout } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();
  const [_, setLocation] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = unreadData?.count ?? 0;

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-start gap-0 group cursor-pointer">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Disc3 className="w-5 h-5 text-primary group-hover:rotate-180 transition-transform duration-700" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight hidden sm:block">
                Producers Circle
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium ml-10 -mt-1 leading-none">
              by Free Soul the Movement
            </span>
          </Link>

        <div className="flex items-center gap-4">
          {/* Supporting is optional — the badge thanks supporters rather than
              marking anyone else as lesser. */}
          {!user.isSubscribed && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-3 py-1 rounded-full border border-white/10 bg-white/5">
              <Link href="/account" className="text-primary hover:text-primary/80 transition-colors">
                Support the Movement
              </Link>
            </div>
          )}

          {user.isSubscribed && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-accent bg-accent/10 px-3 py-1.5 rounded-full border border-accent/20">
              <Zap className="w-3.5 h-3.5" />
              Supporter
            </div>
          )}

          <div className="flex items-center gap-1 border-l border-white/10 pl-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-feed">
                <Radio className="w-3.5 h-3.5 mr-1.5" />
                Feed
              </Button>
            </Link>
            <Link href="/playlists">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-playlists">
                <ListMusic className="w-3.5 h-3.5 mr-1.5" />
                Playlists
              </Button>
            </Link>
            <Link href="/events">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-events">
                <Star className="w-3.5 h-3.5 mr-1.5" />
                Cypher
              </Button>
            </Link>
            <Link href="/ministry">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-ministry">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Ministry
              </Button>
            </Link>
            <Link href="/stewardship">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-stewardship">
                <Sprout className="w-4 h-4 mr-1.5" />
                Stewardship
              </Button>
            </Link>
            <Link href="/library">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex" data-testid="nav-library">
                <Book className="w-4 h-4 mr-1.5" />
                Dictionary
              </Button>
            </Link>
            <Link href="/charter">
              <Button variant="ghost" size="sm" className="text-sm font-medium hover:bg-white/5 hidden sm:inline-flex">
                Our Charter
              </Button>
            </Link>
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5 relative" data-testid="nav-messages">
                <MessageSquare className="w-5 h-5" />
                <UnreadBadge count={unreadCount} />
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5" data-testid="nav-account">
                <UserCircle className="w-5 h-5" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                logout();
                setLocation("/");
              }}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              data-testid="nav-logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
