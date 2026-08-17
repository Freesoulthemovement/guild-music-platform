import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Disc3, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@shared/routes";

type Status = "working" | "ok" | "failed";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");
  // React 18 StrictMode mounts effects twice in development; the token is
  // single-use, so a second call would always report failure.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("failed");
      setMessage("This confirmation link is missing its token.");
      return;
    }

    fetch(api.auth.verifyEmail.path, {
      method: api.auth.verifyEmail.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include",
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("ok");
          return;
        }
        const err = await res.json().catch(() => ({ message: "Confirmation failed" }));
        setStatus("failed");
        setMessage(err.message || "Confirmation failed");
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Could not reach the server. Please try again.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-6">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
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

        <div className="glass-panel rounded-2xl p-8 text-center space-y-4" data-testid={`verify-${status}`}>
          {status === "working" && (
            <>
              <div className="w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <h1 className="text-2xl font-display font-bold">Confirming your email</h1>
            </>
          )}

          {status === "ok" && (
            <>
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h1 className="text-2xl font-display font-bold">Email confirmed</h1>
              <p className="text-sm text-muted-foreground">
                Thank you — your address is verified.
              </p>
            </>
          )}

          {status === "failed" && (
            <>
              <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h1 className="text-2xl font-display font-bold">Could not confirm</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <p className="text-xs text-muted-foreground/60">
                You can request a fresh link from your account page.
              </p>
            </>
          )}

          {status !== "working" && (
            <button
              onClick={() => navigate("/")}
              className="w-full h-11 rounded-xl font-semibold bg-primary text-primary-foreground"
              data-testid="button-continue"
            >
              Continue to the Circle
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
