 justify-center">
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold">Co-Producers (3+4)</h3>
            <p className="text-xs text-muted-foreground">3% Master each</p>
          </div>
        </div>
        {selected && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {coproducers.length} selected
          </span>
        )}
      </div>

      {!selected ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-center space-y-2">
            <Shuffle className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Co-producers not yet selected.</p>
            <p className="text-xs text-muted-foreground/60">
              Top 3 supporters by offering + 4 blessed at random from remaining backers.
            </p>
          </div>
          {isCreator && (
            <Button
              onClick={() => selectCoproducers.mutate()}
              disabled={selectCoproducers.isPending || !hasOfferings}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
              data-testid="button-select-coproducers"
            >
              {selectCoproducers.isPending ? "Selecting..." : "Select Co-Producers"}
            </Button>
          )}
          {isCreator && !hasOfferings && (
            <p className="text-xs text-muted-foreground text-center">Supporters must submit offerings first.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {coproducers.map((cp, i) => (
            <div
              key={cp.id}
              data-testid={`coproducer-card-${cp.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                cp.selectionType === 'top' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{cp.user?.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    cp.selectionType === 'top'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {cp.selectionType === 'top' ? 'Top Supporter' : 'Blessed Random'}
                  </span>
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-amber-400">{cp.percentage}%</div>
            </div>
          ))}
          {isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectCoproducers.mutate()}
              disabled={selectCoproducers.isPending}
              className="w-full mt-2 border-white/10 text-xs"
              data-testid="button-reselect-coproducers"
            >
              {selectCoproducers.isPending ? "Re-selecting..." : "Re-select Co-Producers"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OfferingPanel({ projectId }: { projectId: number }) {
  const { data: offerings } = useProjectOfferings(projectId);
  const createOffering = useCreateOffering(projectId);
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const totalOfferings = (offerings ?? []).reduce((sum, o) => sum + Number(o.amount), 0);
  const offerCount = (offerings ?? []).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOffering.mutateAsync({ amount: parseFloat(amount) });
    setAmount("");
    setIsOpen(false);
  };

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="offering-panel">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-400/20 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold">Supporter Offerings</h3>
            <p className="text-xs text-muted-foreground">Pledge toward the mission</p>
          </div>
        </div>
        {offerCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-400/10 text-rose-400 border border-rose-400/20">
            {offerCount} {offerCount === 1 ? "backer" : "backers"}
          </span>
        )}
      </div>

      <div className="flex justify-between text-sm mb-4">
        <span className="text-muted-foreground">Total pledged</span>
        <span className="font-mono font-bold text-rose-400">${totalOfferings}</span>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-rose-400/30 text-rose-400 hover:bg-rose-400/10 hover:border-rose-400/50"
            data-testid="button-make-offering"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Make an Offering
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-panel border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit an Offering</DialogTitle>
            <DialogDescription>
              Offerings are logged as pledges — no payment is charged. Top supporters by offering amount may be selected as co-producers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Offering Amount ($)</label>
              <Input
                type="number"
                required
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 25"
                className="bg-background/50 border-white/10 font-mono"
                data-testid="input-offering-amount"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-400 text-white"
              disabled={createOffering.isPending}
              data-testid="button-confirm-offering"
            >
              {createOffering.isPending ? "Submitting..." : "Submit Offering"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {(offerings ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          {offerings!.slice(0, 5).map(o => (
            <div key={o.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{o.user?.username}</span>
              <span className="font-mono text-rose-400">${Number(o.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NegotiationPanel({ projectId }: { projectId: number }) {
  const submitNegotiation = useSubmitNegotiation(projectId);
  const { data: myNeg } = useMyNegotiation(projectId);
  const [requestedPercent, setRequestedPercent] = useState("5");
  const [exchangeType, setExchangeType] = useState<"percentage" | "equal">("percentage");
  const [isOpen, setIsOpen] = useState(false);

  const statusColor = {
    pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    accepted: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    rejected: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  }[myNeg?.status ?? "pending"] ?? "text-amber-400 bg-amber-400/10 border-amber-400/20";

  const statusLabel = {
    pending: "Pending Review",
    accepted: "Accepted",
    rejected: "Declined",
  }[myNeg?.status ?? "pending"] ?? "Pending Review";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitNegotiation.mutateAsync({
      requestedPercent: parseFloat(requestedPercent),
      exchangeType,
    });
    setIsOpen(false);
  };

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="negotiation-panel">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
          <Handshake className="w-4 h-4 text-fuchsia-400" />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Contribution Negotiation</h3>
          <p className="text-xs text-muted-foreground">Request a bestowal for your work</p>
        </div>
      </div>

      {myNeg ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your request</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>{statusLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{myNeg.exchangeType === "equal" ? "Equal Bestowal Exchange" : `${Number(myNeg.requestedPercent)}% Contribution`}</span>
            </div>
            {myNeg.exchangeType === "percentage" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Requested %</span>
                <span className="font-mono font-bold text-fuchsia-400">{Number(myNeg.requestedPercent)}%</span>
              </div>
            )}
          </div>

          {(myNeg.status === "rejected" || myNeg.status === "pending") ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/10 text-xs"
              onClick={() => setIsOpen(true)}
              data-testid="button-update-negotiation"
            >
              {myNeg.status === "rejected" ? "Submit New Request" : "Update Request"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            As a creative specialist, you can request up to 10% bestowal from this project, or propose an equal-value exchange.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-fuchsia-400/30 text-fuchsia-400 hover:bg-fuchsia-400/10"
            onClick={() => setIsOpen(true)}
            data-testid="button-open-negotiation"
          >
            <Handshake className="w-4 h-4 mr-2" />
            Request Bestowal
          </Button>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Contribution Negotiation</DialogTitle>
            <DialogDescription>
              Set your requested bestowal percentage (0–10%) or toggle Equal Bestowal Exchange. The creator will review and accept or decline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Exchange Type</label>
                <button
                  type="button"
                  onClick={() => setExchangeType(t => t === "percentage" ? "equal" : "percentage")}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
                  data-testid="toggle-exchange-type"
                >
                  {exchangeType === "equal" ? (
                    <><ToggleRight className="w-5 h-5 text-fuchsia-400" /> Equal Exchange</>
                  ) : (
                    <><ToggleLeft className="w-5 h-5 text-muted-foreground" /> Percentage</>
                  )}
                </button>
              </div>

              {exchangeType === "percentage" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Requested Bestowal (%)</label>
                  <Input
                    type="number"
                    required
                    min="0"
                    max="10"
                    step="0.5"
                    value={requestedPercent}
                    onChange={e => setRequestedPercent(e.target.value)}
                    placeholder="e.g. 5"
                    className="bg-background/50 border-white/10 font-mono"
                    data-testid="input-requested-percent"
                  />
                  <p className="text-xs text-muted-foreground">Max 10% of project private or public value.</p>
                </div>
              )}

              {exchangeType === "equal" && (
                <div className="p-3 rounded-xl bg-fuchsia-400/5 border border-fuchsia-400/20 text-xs text-fuchsia-300">
                  Equal Bestowal Exchange — both parties agree to a mutual fair-value exchange with no fixed percentage. The creator accepts or proposes terms directly.
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
              disabled={submitNegotiation.isPending}
              data-testid="button-submit-negotiation"
            >
              {submitNegotiation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreatorNegotiationsPanel({ projectId }: { projectId: number }) {
  const { data: negotiations = [] } = useProjectNegotiations(projectId);
  const respond = useRespondNegotiation(projectId);
  const pending = negotiations.filter(n => n.status === "pending");

  if (negotiations.length === 0) return null;

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="creator-negotiations-panel">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
          <Handshake className="w-4 h-4 text-fuchsia-400" />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Contribution Negotiations</h3>
          <p className="text-xs text-muted-foreground">
            {pending.length > 0 ? `${pending.length} pending request${pending.length !== 1 ? "s" : ""}` : "All resolved"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {negotiations.map(neg => (
          <div
            key={neg.id}
            data-testid={`negotiation-card-${neg.id}`}
            className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium">{neg.user?.username}</span>
                <div className="flex gap-1 mt-1">
                  {(neg.user?.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                neg.status === "pending" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                neg.status === "accepted" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                "text-rose-400 bg-rose-400/10 border-rose-400/20"
              }`}>
                {neg.status === "pending" ? "Pending" : neg.status === "accepted" ? "Accepted" : "Declined"}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              {neg.exchangeType === "equal" ? (
                <p>Requesting <strong className="text-white">Equal Bestowal Exchange</strong></p>
              ) : (
                <p>Requesting <strong className="text-fuchsia-400 font-mono">{Number(neg.requestedPercent)}%</strong> contribution bestowal</p>
              )}
            </div>

            {neg.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  onClick={() => respond.mutate({ nId: neg.id, status: "accepted" })}
                  disabled={respond.isPending}
                  data-testid={`button-accept-negotiation-${neg.id}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-rose-400/30 text-rose-400 hover:bg-rose-400/10 text-xs"
                  onClick={() => respond.mutate({ nId: neg.id, status: "rejected" })}
                  disabled={respond.isPending}
                  data-testid={`button-reject-negotiation-${neg.id}`}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Public Launch Tracker ──────────────────────────────────────────────────────
function LaunchTrackerPanel({ projectId }: { projectId: number }) {
  const { data: launch } = useProjectLaunchStatus(projectId);

  if (!launch) return null;

  const LAUNCH_CATEGORIES_ORDER = ["producer", "writer", "supporter", "collaborator", "videographer", "engineer", "dancer", "ministry"];

  return (
    <div className="glass-panel rounded-3xl p-6" data-testid="launch-tracker-panel">
      <div className="flex items-center gap-2 mb-5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          launch.canLaunch ? "bg-emerald-500/20" : "bg-sky-500/20"
        }`}>
          <Rocket className={`w-4 h-4 ${launch.canLaunch ? "text-emerald-400" : "text-sky-400"}`} />
        </div>
        <div>
          <h3 className="text-base font-display font-bold">Public Launch</h3>
          <p className="text-xs text-muted-foreground">
            {launch.canLaunch ? "Ready to launch!" : `${launch.categoriesFulfilled}/8 categories (need 4+) • $${launch.backerTotal}/$${launch.backerGoal}`}
          </p>
        </div>
        {launch.canLaunch && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Unlocked
          </span>
        )}
      </div>

      {/* Backer goal progress */}
      <div className="space-y-2 mb-5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Backer contributions</span>
          <span className="font-mono font-bold">
            <span className={launch.backerTotal >= launch.backerGoal ? "text-emerald-400" : "text-sky-400"}>
              ${launch.backerTotal}
            </span>
            <span className="text-muted-foreground"> / ${launch.backerGoal}</span>
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all ${
              launch.backerTotal >= launch.backerGoal ? "bg-emerald-500" : "bg-sky-500"
            }`}
            style={{ width: `${launch.backerProgress}%` }}
          />
        </div>
      </div>

      {/* Category checklist */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium">Creative categories</p>
          <span className={`text-xs font-mono ${launch.categoriesFulfilled >= 4 ? "text-emerald-400" : "text-muted-foreground"}`}>
            {launch.categoriesFulfilled}/8 <span className="text-muted-foreground">(need 4)</span>
          </span>
        </div>
        {LAUNCH_CATEGORIES_ORDER.map(cat => {
          const fulfilled = launch.categories[cat] ?? false;
          return (
            <div
              key={cat}
              data-testid={`launch-category-${cat}`}
              className="flex items-center gap-2 text-xs"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                fulfilled ? "bg-emerald-500/20" : "bg-white/5"
              }`}>
                {fulfilled
                  ? <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />
                  : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                }
              </div>
              <span className={fulfilled ? "text-white" : "text-muted-foreground"}>
                {LAUNCH_CATEGORY_LABELS[cat] ?? cat}
              </span>
            </div>
          );
        })}
      </div>

      <Button
        className={`w-full font-bold ${
          launch.canLaunch
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-white/5 border border-white/10 text-muted-foreground cursor-not-allowed"
        }`}
        disabled={!launch.canLaunch}
        data-testid="button-public-launch"
        title={launch.canLaunch ? undefined : "Coming Soon — complete all requirements to enable public launch"}
      >
        <Rocket className="w-4 h-4 mr-2" />
        {launch.canLaunch ? "Launch to Public" : "Coming Soon — Complete Requirements"}
      </Button>
    </div>
  );
}

// ── Beat License Card ──────────────────────────────────────────────────────────
function LicenseCard({ sub, currentUserId }: { sub: Submission & { user: User }; currentUserId?: number }) {
  const unlock = useUnlockLicense(sub.id);
  const { data: myUnlock } = useMyLicenseUnlock(sub.id);
  const isOwner = sub.userId === currentUserId;
  const alreadyUnlocked = myUnlock?.unlocked ?? false;

  return (
    <div
      data-testid={`license-card-${sub.id}`}
      className="p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="font-semibold text-sm">{sub.title}</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
            {SUBMISSION_TYPE_LABELS[sub.type] ?? sub.type}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-bold text-primary text-sm">${Number(sub.licenseBestowalAmount)}</div>
          {sub.sampleClearancePercent && Number(sub.sampleClearancePercent) > 0 && (
            <div className="text-xs text-muted-foreground">{Number(sub.sampleClearancePercent)}% clearance</div>
          )}
        </div>
      </div>
      {sub.description && <p className="text-xs text-muted-foreground mb-3">{sub.description}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">by {sub.user?.username}</span>
        {!isOwner && (
          alreadyUnlocked ? (
            <div className="flex items-center gap-1 text-xs text-emerald-400" data-testid={`license-unlocked-${sub.id}`}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Licensed
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-primary/9one" : "Members only"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSubVisibility(v => v === "private" ? "public" : "private")}
                            className="flex items-center gap-1.5 text-xs"
                            data-testid="toggle-submission-visibility"
                          >
                            {subVisibility === "public" ? (
                              <><Globe className="w-4 h-4 text-sky-400" /><span className="text-sky-400">Public</span></>
                            ) : (
                              <><EyeOff className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Private</span></>
                            )}
                          </button>
                        </div>

                        {/* Beat licensing fields (producer beat types only) */}
                        {showLicenseFields && (
                          <div className="space-y-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5" /> Beat License (optional)
                            </p>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">License Bestowal Amount ($)</label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={subLicenseAmount}
                                onChange={e => setSubLicenseAmount(e.target.value)}
                                placeholder="e.g. 50 (leave blank for no license)"
                                className="bg-background/50 border-white/10 font-mono text-sm"
                                data-testid="input-license-amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground">Sample Clearance Reserve (%)</label>
                              <Input
                                type="number"
                                min="0"
                                max="30"
                                step="1"
                                value={subClearancePercent}
                                onChange={e => setSubClearancePercent(e.target.value)}
                                placeholder="e.g. 10"
                                className="bg-background/50 border-white/10 font-mono text-sm"
                                data-testid="input-clearance-percent"
                              />
                            </div>
                          </div>
                        )}

                        <Button type="submit" className="w-full" disabled={createSubmission.isPending} data-testid="button-submit-form">
                          {createSubmission.isPending ? "Submitting..." : "Submit Contribution"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 opacity-60 cursor-not-allowed" disabled data-testid="button-submit-contribution-locked" title="Active membership required">
                      <Lock className="w-4 h-4" /> Members Only
                    </Button>
                  )
                )}

                {/* Upload File */}
                {user?.isSubscribed ? (
                <Dialog open={isFileOpen} onOpenChange={setIsFileOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5" data-testid="button-upload-file">
                      <UploadCloud className="w-4 h-4" /> File
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-panel border-white/10 sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upload Contribution</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFileUpload} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">File Name</label>
                        <Input required value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. Bass Synth Stem" className="bg-background/50 border-white/10" data-testid="input-file-name" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select
                          value={fileType}
                          onChange={e => setFileType(e.target.value)}
                          className="w-full h-10 rounded-md border border-white/10 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          data-testid="select-file-type"
                        >
                          <option value="stem">Audio Stem</option>
                          <option value="artwork">Artwork</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* File visibility toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-medium">Visibility</p>
                          <p className="text-xs text-muted-foreground">
                            {fileVisibility === "public" ? "Visible to everyone" : "Members only"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFileVisibility(v => v === "private" ? "public" : "private")}
                          className="flex items-center gap-1.5 text-xs"
                          data-testid="toggle-file-visibility"
                        >
                          {fileVisibility === "public" ? (
                            <><Globe className="w-4 h-4 text-sky-400" /><span className="text-sky-400">Public</span></>
                          ) : (
                            <><EyeOff className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Private</span></>
                          )}
                        </button>
                      </div>

                      <Button type="submit" className="w-full" disabled={createFile.isPending} data-testid="button-upload-submit">
                        {createFile.isPending ? "Uploading..." : "Upload File"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 border-white/10 opacity-60 cursor-not-allowed" disabled data-testid="button-upload-file-locked" title="Active membership required">
                    <Lock className="w-4 h-4" /> File
                  </Button>
                )}
              </div>
            </div>

            {/* Submissions Tab */}
            <TabsContent value="submissions" className="mt-0">
              {projectSubmissions.length === 0 ? (
                <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No contributions yet. Be the first to share your creative energy.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(SUBMISSION_TYPE_GROUPS).map(([group, groupTypes]) => {
                    const groupSubs = projectSubmissions.filter(s => groupTypes.includes(s.type));
                    if (groupSubs.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                          {getSubmissionGroupIcon(group)}
                          {group}
                        </div>
                        <div className="grid gap-3">
                          {groupSubs.map(sub => {
                            const track = {
                              id: sub.id,
                              title: sub.title,
                              type: sub.type,
                              artist: sub.user?.displayName ?? sub.user?.username ?? "Unknown",
                              fileUrl: sub.fileUrl ?? null,
                              projectTitle: project.title,
                              projectId: project.id,
                            };
                            const isCurrentTrack = currentTrack?.id === sub.id;
                            const isPlayingThis = isCurrentTrack && playerState.playing;
                            return (
                            <div key={sub.id} data-testid={`submission-card-${sub.id}`} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => isCurrentTrack ? togglePlay() : playTrack(track)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isCurrentTrack ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-primary/80 hover:text-primary-foreground text-muted-foreground"}`}
                                    data-testid={`button-play-submission-${sub.id}`}
                                    title={isPlayingThis ? "Pause" : "Play"}
                                  >
                                    {isPlayingThis ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  </button>
                                  <span className="font-semibold text-sm">{sub.title}</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                                    {SUBMISSION_TYPE_LABELS[sub.type] ?? sub.type}
                                  </span>
                                  {sub.visibility === "public" ? (
                                    <span className="flex items-center gap-0.5 text-xs text-sky-400" data-testid={`visibility-badge-${sub.id}`}>
                                      <Globe className="w-3 h-3" /> Public
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground/50" data-testid={`visibility-badge-${sub.id}`}>
                                      <EyeOff className="w-3 h-3" /> Private
                                    </span>
                                  )}
                                  {sub.licenseBestowalAmount && Number(sub.licenseBestowalAmount) > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs text-primary" data-testid={`license-badge-${sub.id}`}>
                                      <Key className="w-3 h-3" /> ${Number(sub.licenseBestowalAmount)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {(sub.user?.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                                  <span className="text-xs text-muted-foreground">{sub.user?.username}</span>
                                </div>
                              </div>
                              {sub.description && (
                                <p className="text-sm text-muted-foreground">{sub.description}</p>
                              )}
                              <div className="flex justify-end mt-2">
                                <AddToPlaylistMenu submissionId={sub.id} />
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="mt-0">
              {project.files.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  No files contributed yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {project.files.map(f => {
                    const fileTrack = {
                      id: -(f.id),
                      title: f.name,
                      type: f.type,
                      artist: f.uploader?.displayName ?? f.uploader?.username ?? "Unknown",
                      fileUrl: f.url,
                      projectTitle: project.title,
                      projectId: project.id,
                    };
                    const isCurrentFileTrack = currentTrack?.id === -(f.id);
                    const isPlayingFile = isCurrentFileTrack && playerState.playing;
                    return (
                    <div key={f.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => isCurrentFileTrack ? togglePlay() : playTrack(fileTrack)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${isCurrentFileTrack ? "bg-primary/20 border-primary/30" : "bg-background border-white/5 hover:bg-primary/10 hover:border-primary/20"}`}
                          data-testid={`button-play-file-${f.id}`}
                          title={isPlayingFile ? "Pause" : "Play"}
                        >
                          {isPlayingFile
                            ? <Pause className="w-4 h-4 text-primary" />
                            : (f.type === 'stem' || f.type === 'other'
                              ? <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                              : getFileIcon(f.type))}
                        </button>
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded by {f.uploader?.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.visibility === "public" ? (
                          <span className="flex items-center gap-0.5 text-xs text-sky-400">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground/50">
                            <EyeOff className="w-3 h-3" /> Private
                          </span>
                        )}
                        <div className="text-xs px-2 py-1 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                          {f.type}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Licenses Tab */}
            <TabsContent value="licenses" className="mt-0">
              {licensedSubmissions.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-muted-foreground bg-white/5">
                  No licensed beats available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4">
                    Producers in this project have made their beats available for licensing. Unlock a license to use the beat in your work.
                  </p>
                  {licensedSubmissions.map(sub => (
                    <LicenseCard key={sub.id} sub={sub} currentUserId={user?.id} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Circle Split Tab */}
            <TabsContent value="split" className="mt-0">
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold">Free Soul Default Publishing Split</h3>
                </div>
                <CircleSplitPanel royaltySplits={project.royaltySplits ?? []} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Investments Panel */}
          <div className="glass-panel rounded-3xl p-6 border-primary/20 bg-gradient-to-b from-card/60 to-primary/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold">Investments</h3>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Invested</span>
                <span className="font-mono font-medium">${project.investments.reduce((sum, i) => sum + Number(i.amount), 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Equity Claimed</span>
                <span className="font-mono font-medium">{totalPercentage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Investors</span>
                <span className="font-mono font-medium">{investorCount} / 3</span>
              </div>

              <div className="w-full bg-background rounded-full h-2 mt-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                  style={{ width: `${totalPercentage}%` }}
                />
              </div>
            </div>

            {canInvest ? (
              !user?.isSubscribed ? (
                <Link href="/account">
                  <Button className="w-full bg-white/10 text-muted-foreground border border-white/10 hover:bg-white/15" data-testid="button-invest-locked">
                    <Lock className="w-4 h-4 mr-2" /> Members Only — Activate Membership
                  </Button>
                </Link>
              ) : (
              <Dialog open={isInvestOpen} onOpenChange={setIsInvestOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]" data-testid="button-invest">
                    Invest in Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel border-primary/20 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Make an Investment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInvest} className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex gap-3 text-sm mb-4">
                      <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                      <p className="text-primary-foreground/80">Up to 10% equity per investor. Only {Math.min(10, availablePercentage)}% currently available.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Investment Amount ($)</label>
                      <Input type="number" required min="1" step="0.01" value={investAmount} onChange={e => setInvestAmount(e.target.value)} placeholder="e.g. 100" className="bg-background/50 border-white/10 font-mono" data-testid="input-invest-amount" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Requested Equity (%)</label>
                      <Input type="number" required min="1" max={Math.min(10, availablePercentage)} value={investPercent} onChange={e => setInvestPercent(e.target.value)} placeholder={`Max ${Math.min(10, availablePercentage)}%`} className="bg-background/50 border-white/10 font-mono" data-testid="input-invest-percent" />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={createInvestment.isPending} data-testid="button-confirm-invest">
                      {createInvestment.isPending ? "Processing..." : "Confirm Investment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              )
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-sm text-muted-foreground">
                Investment cap reached for this project.
              </div>
            )}

            {/* Investors list */}
            {project.investments.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Backers</p>
                {project.investments.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {inv.investor?.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-muted-foreground">{inv.investor?.username}</span>
                    </div>
                    <span className="font-mono text-primary font-medium">{inv.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offering Panel */}
          <OfferingPanel projectId={projectId} />

          {/* Co-Producers Panel */}
          <CoproducerPanel isCreator={isCreator} projectId={projectId} hasOfferings={hasOfferings} />

          {/* Public Launch Tracker */}
          <LaunchTrackerPanel projectId={projectId} />

          {/* Negotiation Panel (for users with negotiable roles) */}
          {userHasNegotiableRole && !isCreator && (
            <NegotiationPanel projectId={projectId} />
          )}

          {/* Creator's Negotiations Review */}
          {isCreator && (
            <CreatorNegotiationsPanel projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
8