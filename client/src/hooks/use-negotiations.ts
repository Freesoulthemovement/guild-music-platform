import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ContributionNegotiation, User } from "@shared/schema";

// These endpoints are registered directly in server/routes.ts rather than
// through the shared `api` contract, so the paths are built here.
const listPath = (projectId: number) => `/api/projects/${projectId}/negotiations`;
const minePath = (projectId: number) => `/api/projects/${projectId}/negotiations/me`;
const respondPath = (projectId: number, nId: number) =>
  `/api/projects/${projectId}/negotiations/${nId}`;

type NegotiationWithUser = ContributionNegotiation & { user: User };
type ExchangeType = "percentage" | "equal";
type NegotiationStatus = "accepted" | "rejected";

/** Creator-only: every negotiation request submitted against this project. */
export function useProjectNegotiations(projectId: number) {
  return useQuery<NegotiationWithUser[]>({
    queryKey: [listPath(projectId)],
    queryFn: async () => {
      const res = await fetch(listPath(projectId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch negotiations");
      return res.json();
    },
    enabled: !!projectId,
  });
}

/** The current user's own negotiation for this project, or null if none yet. */
export function useMyNegotiation(projectId: number) {
  return useQuery<ContributionNegotiation | null>({
    queryKey: [minePath(projectId)],
    queryFn: async () => {
      const res = await fetch(minePath(projectId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch negotiation");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useSubmitNegotiation(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { requestedPercent: number; exchangeType: ExchangeType }) => {
      const res = await fetch(listPath(projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [minePath(projectId)] });
      qc.invalidateQueries({ queryKey: [listPath(projectId)] });
      toast({
        title: "Request Submitted",
        description: "The project creator will review your bestowal request.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Request Failed", description: err.message, variant: "destructive" });
    },
  });
}

/** Creator-only: accept or decline a pending negotiation. */
export function useRespondNegotiation(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ nId, status }: { nId: number; status: NegotiationStatus }) => {
      const res = await fetch(respondPath(projectId, nId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Response failed" }));
        throw new Error(err.message || "Response failed");
      }
      return res.json();
    },
    onSuccess: (_data, { status }) => {
      qc.invalidateQueries({ queryKey: [listPath(projectId)] });
      qc.invalidateQueries({ queryKey: [minePath(projectId)] });
      toast({
        title: status === "accepted" ? "Request Accepted" : "Request Declined",
        description: "The contributor has been notified of your decision.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Response Failed", description: err.message, variant: "destructive" });
    },
  });
}
