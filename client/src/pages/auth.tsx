import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Disc3, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@shared/schema";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [resetSent, setResetSent] = useState<string | null>(null);
  const { login, isLoggingIn, register, isRegistering, forgotPassword, isSendingReset } = useAuth();

  const isRegisterMode = mode === "register";
  const isBusy = isLoggingIn || isRegistering;

  const handleForgotPassword = async () => {
    if (!email.trim() || isSendingReset) return;
    try {
      const result = await forgotPassword(email.trim());
      setResetSent(result.message);
    } catch {
      /* toast handled in the mutation */
    }
  };

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (!isRegisterMode || (username.trim().length >= 3 && password.length >= MIN_PASSWORD_LENGTH));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isBusy) return;
    // Errors surface as toasts from the mutation; swallow so the form stays put.
    try {
      if (isRegisterMode) {
        await register({ email: email.trim(), password, username: username.trim() });
      } else {
        await login({ email: email.trim(), password });
      }
    } catch {
      /* handled by the mutation's onError toast */
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword("");
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
            {/* Mode switch */}
            <div
              className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-xl bg-white/5 border border-white/10"
              role="tablist"
            >
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-white/10 text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  data-testid={`tab-${m}`}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-background/50 border-white/10 h-12 focus-visible:ring-primary/50"
                  disabled={isBusy}
                  data-testid="input-email"
                />
              </div>

              {isRegisterMode && (
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-foreground/80">
                    Username
                  </label>
                  <Input
                    id="username"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jimi_hendrix"
                    className="bg-background/50 border-white/10 h-12 focus-visible:ring-primary/50"
                    disabled={isBusy}
                    data-testid="input-username"
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers and underscores. This is how the Circle sees you.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground/80">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isRegisterMode ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegisterMode ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"}
                  className="bg-background/50 border-white/10 h-12 focus-visible:ring-primary/50"
                  disabled={isBusy}
                  data-testid="input-password"
                />
                {isRegisterMode && password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
                  <p className="text-xs text-amber-400" data-testid="password-hint">
                    {MIN_PASSWORD_LENGTH - password.length} more character
                    {MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} needed
                  </p>
                )}
                {!isRegisterMode && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={!email.trim() || isSendingReset}
                      className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      data-testid="button-forgot-password"
                    >
                      {isSendingReset ? "Sending..." : "Forgot password?"}
                    </button>
                  </div>
                )}
              </div>

              {resetSent && (
                <div
                  className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary"
                  data-testid="reset-sent-notice"
                >
                  {resetSent}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || !canSubmit}
                className="w-full h-12 rounded-xl font-semibold bg-primary text-primary-foreground
                           shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]
                           hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]
                           hover:-translate-y-0.5 transition-all duration-300
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                           flex items-center justify-center gap-2"
                data-testid="button-submit-auth"
              >
                {isBusy
                  ? isRegisterMode ? "Creating..." : "Entering..."
                  : isRegisterMode ? "Create Account" : "Continue"}
                {!isBusy && <ArrowRight className="w-5 h-5" />}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                {isRegisterMode ? "Already in the Circle? " : "New here? "}
                <button
                  type="button"
                  onClick={() => switchMode(isRegisterMode ? "login" : "register")}
                  className="text-primary hover:underline"
                >
                  {isRegisterMode ? "Sign in" : "Create an account"}
                </button>
              </p>
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
