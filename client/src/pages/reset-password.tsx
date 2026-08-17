import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Disc3, ArrowRight, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { MIN_PASSWORD_LENGTH } from "@shared/schema";

const shell = (children: React.ReactNode) => (
  <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-6">
    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md relative z-10"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-xl shadow-2xl">
          <Disc3 className="w-8 h-8 text-primary" />
        </div>
      </div>
      {children}
    </motion.div>
  </div>
);

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { resetPassword, isResettingPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  // wouter's useSearch is not used here so the page also works on a hard load.
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    token.length > 0 && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isResettingPassword) return;
    try {
      await resetPassword({ token, newPassword: password });
      setDone(true);
    } catch {
      /* toast handled in the mutation */
    }
  };

  if (!token) {
    return shell(
      <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold">Link incomplete</h1>
        <p className="text-sm text-muted-foreground">
          This reset link is missing its token. Request a new one from the sign-in page.
        </p>
        <button
          onClick={() => navigate("/")}
          className="w-full h-11 rounded-xl font-semibold bg-primary text-primary-foreground"
          data-testid="button-back-to-signin"
        >
          Back to sign in
        </button>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="glass-panel rounded-2xl p-8 text-center space-y-4" data-testid="reset-success">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-display font-bold">Password updated</h1>
        <p className="text-sm text-muted-foreground">
          You're signed in with your new password.
        </p>
        <button
          onClick={() => navigate("/")}
          className="w-full h-11 rounded-xl font-semibold bg-primary text-primary-foreground"
          data-testid="button-continue"
        >
          Continue to the Circle
        </button>
      </div>,
    );
  }

  return shell(
    <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-8">
      <h1 className="text-2xl font-display font-bold mb-2">Choose a new password</h1>
      <p className="text-sm text-muted-foreground mb-6">
        This link works once and expires shortly after it was sent.
      </p>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-foreground/80">
            New password
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            className="bg-background/50 border-white/10 h-12 focus-visible:ring-primary/50"
            disabled={isResettingPassword}
            data-testid="input-new-password"
          />
          {tooShort && (
            <p className="text-xs text-amber-400">
              {MIN_PASSWORD_LENGTH - password.length} more character
              {MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} needed
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-foreground/80">
            Confirm password
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            className="bg-background/50 border-white/10 h-12 focus-visible:ring-primary/50"
            disabled={isResettingPassword}
            data-testid="input-confirm-password"
          />
          {mismatch && <p className="text-xs text-rose-400">Passwords do not match</p>}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || isResettingPassword}
          className="w-full h-12 rounded-xl font-semibold bg-primary text-primary-foreground
                     shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]
                     hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]
                     hover:-translate-y-0.5 transition-all duration-300
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                     flex items-center justify-center gap-2"
          data-testid="button-reset-password"
        >
          {isResettingPassword ? "Updating..." : "Update password"}
          {!isResettingPassword && <ArrowRight className="w-5 h-5" />}
        </button>
      </div>
    </form>,
  );
}
