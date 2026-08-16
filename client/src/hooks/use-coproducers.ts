import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Coproducer, User } from "@shared/schema";

type CoproducerWithUser = Coproducer & { user: User };

export function useCoproducers(projectId: number) {
  return useQuery<CoproducerWithUser[]>({
    queryKey: [api.coproducers.list.path, projectId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.coproducers.list.path, { projectId }), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch co-producers");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useSelectCoproducers(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(buildUrl(api.coproducers.select.path, { projectId }), {
        method: api.coproducers.select.method,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Selection failed" }));
        throw new Error(err.message || "Selection failed");
      }
      return res.json();
    },
    onSuccess: (selected: CoproducerWithUser[]) => {
      qc.invalidateQueries({ queryKey: [api.coproducers.list.path, projectId] });
      qc.invalidateQueries({ queryKey: [api.projects.get.path, projectId] });
      toast({
        title: "Co-Producers Selected",
        description: `${selected.length} creators have been blessed into this project.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Selection Failed", description: err.message, variant: "destructive" });
    },
  });
}
