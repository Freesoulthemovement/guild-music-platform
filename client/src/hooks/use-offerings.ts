import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Offering, User } from "@shared/schema";

type OfferingWithUser = Offering & { user: User };

export function useProjectOfferings(projectId: number) {
  return useQuery<OfferingWithUser[]>({
    queryKey: [api.offerings.list.path, projectId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.offerings.list.path, { projectId }), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch offerings");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useCreateOffering(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number }) => {
      const res = await fetch(buildUrl(api.offerings.create.path, { projectId }), {
        method: api.offerings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Offering failed" }));
        throw new Error(err.message || "Offering failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.offerings.list.path, projectId] });
      qc.invalidateQueries({ queryKey: ["/api/projects/:id/launch-status", projectId] });
      toast({ title: "Offering Received", description: "Thank you for backing this project." });
    },
    onError: (err: Error) => {
      toast({ title: "Offering Failed", description: err.message, variant: "destructive" });
    },
  });
}
