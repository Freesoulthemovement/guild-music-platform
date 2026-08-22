import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Bestowal, User } from "@shared/schema";

type BestowalWithMember = Bestowal & { member: User };

export function useProjectBestowals(projectId: number) {
  return useQuery<BestowalWithMember[]>({
    queryKey: [api.bestowals.list.path, projectId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.bestowals.list.path, { projectId }), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch bestowals");
      return res.json();
    },
    enabled: !!projectId,
  });
}

/** A gift toward a project. Confers no share of anything it produces. */
export function useCreateBestowal(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; note?: string }) => {
      const res = await fetch(buildUrl(api.bestowals.create.path, { projectId }), {
        method: api.bestowals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Bestowal failed" }));
        throw new Error(err.message || "Bestowal failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bestowals.list.path, projectId] });
      qc.invalidateQueries({ queryKey: [api.projects.get.path, projectId] });
      qc.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({ title: "Bestowal Received", description: "Thank you for carrying this work." });
    },
    onError: (err: Error) => {
      toast({ title: "Bestowal Failed", description: err.message, variant: "destructive" });
    },
  });
}
