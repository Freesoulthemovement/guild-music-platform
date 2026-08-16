import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Disc3, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await login(username);
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Background visual elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center items-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-xl shadow-2xl">
              <Disc3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
              Enter the <span className="text-gradient">Circle</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Collaborate on stems, share ideas, and invest in the future of music production.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-8 relative">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jimi_hendrix"
                  className="bg-background/50 border-white/10 h-12 text-lg focus-visible:ring-primary/50"
                  disabled={isLoggingIn}
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn || !username.trim()}
                className="w-full h-12 rounded-xl font-semibold bg-primary text-primary-foreground 
                           shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] 
                           hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)] 
                           hover:-translate-y-0.5 transition-all duration-300
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                           flex items-center justify-center gap-2"
              >
                {isLoggingIn ? "Entering..." : "Continue"}
                {!isLoggingIn && <ArrowRight className="w-5 h-5" />}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Hero Image Side */}
      <div className="hidden lg:flex flex-1 relative bg-black items-center justify-center overflow-hidden border-l border-white/10">
        {/* abstract music studio dark moody */}
        <img 
          src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1920&h=1080&fit=crop" 
          alt="Studio" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        
        <div className="relative z-10 max-w-lg p-12 text-center">
          <blockquote className="text-2xl font-display font-medium leading-relaxed text-white/90">
            "The magic happens when different minds touch the same frequency."
          </blockquote>
        </div>
      </div>
    </div>
  );
}
