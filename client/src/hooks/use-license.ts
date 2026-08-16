import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// These endpoints are registered directly in server/routes.ts rather than
// through the shared `api` contract, so the paths are built here.
const launchStatusPath = (projectId: number) => `/api/projects/${projectId}/launch-status`;
const unlockPath = (submissionId: number) => `/api/submissions/${submissionId}/unlock-license`;
const myUnlockPath = (submissionId: number) => `/api/submissions/${submissionId}/unlocks/me`;

/** Mirrors LaunchStatus in server/storage.ts. */
export type LaunchStatus = {
  backerTotal: number;
  backerGoal: number;
  backerProgress: number;
  categories: Record<string, boolean>;
  categoriesFulfilled: number;
  canLaunch: boolean;
};

export function useProjectLaunchStatus(projectId: number) {
  return useQuery<LaunchStatus>({
    queryKey: [launchStatusPath(projectId)],
    queryFn: async () => {
      const res = await fetch(launchStatusPath(projectId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch launch status");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useMyLicenseUnlock(submissionId: number) {
  return useQuery<{ unlocked: boolean }>({
    queryKey: [myUnlockPath(submissionId)],
    queryFn: async () => {
      const res = await fetch(myUnlockPath(submissionId), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch license status");
      return res.json();
    },
    enabled: !!submissionId,
  });
}

export function useUnlockLicense(submissionId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(unlockPath(submissionId), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unlock failed" }));
        throw new Error(err.message || "Unlock failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [myUnlockPath(submissionId)] });
      toast({
        title: "License Unlocked",
        description: "You may now use this beat in your work.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Unlock Failed", description: err.message, variant: "destructive" });
    },
  });
}
