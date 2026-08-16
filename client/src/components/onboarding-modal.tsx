import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Disc3, ScrollText, Shield, Zap, Loader2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PMA_AGREEMENT = `PRIVATE MEMBERSHIP ASSOCIATION COMMUNITY AGREEMENT

Free Soul Ecclesiastical Movement — Producers Circle

By joining the Producers Circle, you agree to participate as a private member of the Free Soul Ecclesiastical Movement, a sovereign Private Membership Association (PMA). This membership is private and ecclesiastical in nature.

1. SOVEREIGN PARTICIPATION
You acknowledge that this community operates outside the jurisdiction of commercial regulation under the principles of ecclesiastical and private membership law. All creative works, investments, and royalty agreements are entered into voluntarily and privately between members.

2. COMMUNITY STANDARDS
Members agree to treat all creative contributions with respect and integrity. Unauthorized reproduction, distribution, or commercial exploitation of another member's work outside this PMA is strictly prohibited.

3. ROYALTY & INVESTMENT FRAMEWORK
You understand the 3+4 co-producer model, treasury allocation (50% Land & Housing / 25% Equipment / 15% Savings / 10% Celebration), and the cypher pass system. All royalty splits are final when executed on-platform.

4. CONFIDENTIALITY
Members agree to hold all unpublished creative work, private business discussions, and financial arrangements discussed within the Producers Circle in strict confidence.

5. PMA PROTECTION
This Agreement invokes the full protections available under the law of Private Membership Associations. You enter this community as a private individual, not as a commercial entity.

6. DISPUTE RESOLUTION
Any disputes shall be resolved first through private mediation within the PMA community, consistent with our ecclesiastical principles.

By continuing, you affirm your understanding and voluntary acceptance of these terms as a sovereign individual.`;

const AI_PLEDGE_TEXT = `As a member of the Free Soul Ecclesiastical Movement Producers Circle, I solemnly pledge:

• I will not submit AI-generated beats, stems, hooks, lyrics, or melodies as my own original work without clear disclosure.

• I acknowledge the 30% Rule: no submitted creative work may contain more than 30% AI-generated content. Any submission exceeding this threshold must be disclosed, and co-production credits will reflect AI-assisted origins.

• If I use AI tools as part of my creative process, I will disclose this in my submission notes so the community can make informed decisions about collaboration and co-production credits.

• I acknowledge that I am a real, living human being and not an automated system, bot, or AI agent. My participation in this PMA is of my own free will as a sovereign individual.

• I understand that authentic human creativity is the foundation of this sovereign circle, and that transparency builds the trust our community requires.

• I commit to protecting the integrity of every member's contribution by honoring this pledge in all my creative submissions.

This pledge is made freely and willingly as a member of this Private Membership Association.`;

type Step = 1 | 2 | 3;

interface OnboardingModalProps {
  isOpen: boolean;
  isAlreadySubscribed?: boolean;
  onAgreementComplete?: (user: any) => void;
}

const LIVING_DICTIONARY = `FREE SOUL LIVING DICTIONARY — Key Definitions

"Private" — pertaining solely to PMA members; existing outside the public commercial domain
"Ecclesiastical" — of or relating to the sacred, sovereign body of this faith community
"Member" — a free individual who voluntarily enters this Private Membership Association
"Sovereign" — self-governing; not subject to commercial statutory jurisdiction
"Bestowal" — a voluntary sacred gift freely given with no commercial expectation
"PMA" — Private Membership Association; a private, faith-based sovereign community
"Ministry Artist" — a sovereign creator designated by the movement to serve its sacred artistic expression`;

export function OnboardingModal({ isOpen, isAlreadySubscribed = false, onAgreementComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [agreedToPma, setAgreedToPma] = useState(false);
  const [agreedToDefinitions, setAgreedToDefinitions] = useState(false);
  const [pledgeName, setPledgeName] = useState("");
  const [agreedToPledge, setAgreedToPledge] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      if (isAlreadySubscribed) {
        // User already has an active subscription — just record agreement completion
        const res = await apiRequest("POST", "/api/stripe/onboarding/complete");
        const data = await res.json();
        if (data.success && onAgreementComplete) {
          onAgreementComplete(data.user);
        }
      } else {
        // New subscriber — redirect to Stripe Checkout
        const res = await apiRequest("POST", "/api/stripe/checkout");
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.message || "Failed to create checkout session");
        }
      }
    } catch (err: any) {
      let msg = "Something went wrong";
      try {
        if (err?.json) {
          const body = await err.json();
          msg = body?.message ?? msg;
        } else if (err?.message) {
          msg = err.message;
        }
      } catch {}
      toast({ title: isAlreadySubscribed ? "Agreement failed" : "Checkout failed", description: msg, variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="onboarding-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-2xl bg-[#0e0e12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20">
              <Disc3 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-medium text-primary/80 uppercase tracking-widest">
              Producers Circle Pro
            </span>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 mt-4">
            {([1, 2, 3] as Step[]).map(s => (
              <div
                key={s}
                className={`h-1 rounded-full flex-1 transition-all duration-500 ${
                  s <= step ? 'bg-primary' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-3">
                  <ScrollText className="w-6 h-6 text-amber-400" />
                  <h2 className="text-2xl font-display font-bold">PMA Community Agreement</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please read and agree to the Free Soul Ecclesiastical Movement's Community Agreement before joining.
                </p>

                <div
                  className="h-56 overflow-y-auto rounded-2xl bg-white/5 border border-white/10 p-5 text-xs text-muted-foreground leading-relaxed whitespace-pre-line font-mono"
                  data-testid="pma-agreement-text"
                >
                  {PMA_AGREEMENT}
                </div>

                <div
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer"
                  onClick={() => setAgreedToPma(v => !v)}
                  data-testid="checkbox-pma-agree"
                >
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${agreedToPma ? 'bg-primary border-primary' : 'border-white/30 bg-transparent'}`}>
                    {agreedToPma && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm leading-relaxed">
                    I have read and voluntarily agree to the Free Soul PMA Community Agreement as a sovereign individual.
                  </span>
                </div>

                {/* Living Dictionary acknowledgment */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Free Soul Living Dictionary</p>
                  <div
                    className="h-36 overflow-y-auto rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-xs text-muted-foreground leading-relaxed whitespace-pre-line font-mono"
                    data-testid="living-dictionary-text"
                  >
                    {LIVING_DICTIONARY}
                  </div>
                  <div
                    className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer"
                    onClick={() => setAgreedToDefinitions(v => !v)}
                    data-testid="checkbox-definitions-agree"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${agreedToDefinitions ? 'bg-amber-500 border-amber-500' : 'border-white/30 bg-transparent'}`}>
                      {agreedToDefinitions && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm leading-relaxed">
                      I acknowledge and accept the Living Dictionary definitions as the sovereign meaning of all terms used in this agreement.
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!agreedToPma || !agreedToDefinitions}
                  className="w-full h-12"
                  data-testid="button-step1-continue"
                >
                  Continue to AI Pledge
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-2xl font-display font-bold">AI Content Pledge</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Authentic human creativity is the foundation of this sovereign circle. Please make your pledge.
                </p>

                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {AI_PLEDGE_TEXT}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground/80">Your full name or creative alias</label>
                  <Input
                    value={pledgeName}
                    onChange={e => setPledgeName(e.target.value)}
                    placeholder="e.g. Free Soul Creator"
                    className="bg-white/5 border-white/10"
                    data-testid="input-pledge-name"
                  />
                </div>

                <div
                  className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer"
                  onClick={() => setAgreedToPledge(v => !v)}
                  data-testid="checkbox-pledge-agree"
                >
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${agreedToPledge ? 'bg-primary border-primary' : 'border-white/30 bg-transparent'}`}>
                    {agreedToPledge && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm leading-relaxed">
                    I, <strong>{pledgeName || "..."}</strong>, solemnly make this AI Content Pledge as a member of the Free Soul Ecclesiastical Movement Producers Circle.
                  </span>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 border-white/10"
                    data-testid="button-step2-back"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!agreedToPledge || !pledgeName.trim()}
                    className="flex-1 h-12"
                    data-testid="button-step2-continue"
                  >
                    I Pledge — Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-display font-bold">Activate Membership</h2>
                </div>

                {isAlreadySubscribed ? (
                  <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-6 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-400 mb-1">Membership Already Active</p>
                      <p className="text-sm text-muted-foreground">Your subscription is confirmed. Complete the agreement steps to gain full access to the Producers Circle. No additional charge will be made.</p>
                    </div>
                  </div>
                ) : (
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6">
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-display font-bold">$8.88</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Submit beats, hooks, ideas & stems",
                      "Invest in projects and earn credits",
                      "Become a Co-Producer in the 3+4 model",
                      "PMA protection on all contributions",
                      "Early access to top tier collaborations",
                    ].map((feat, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                <p className="text-xs text-muted-foreground/60 text-center">
                  {isAlreadySubscribed
                    ? "Your signed agreements will be recorded on your account."
                    : "You'll be redirected to Stripe's secure checkout. Cancel anytime."}
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1 border-white/10"
                    disabled={isLoading}
                    data-testid="button-step3-back"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleActivate}
                    disabled={isLoading}
                    className="flex-1 h-12 bg-white text-black hover:bg-white/90 font-bold"
                    data-testid="button-activate-membership"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isAlreadySubscribed ? "Saving…" : "Redirecting…"}
                      </>
                    ) : (
                      <>
                        {isAlreadySubscribed ? "Complete Agreement" : "Activate Membership"}
                        <Zap className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
