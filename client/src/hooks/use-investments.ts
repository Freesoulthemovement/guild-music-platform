import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useCreateInvestment(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { amount: number; percentage: number }) => {
      const res = await fetch(buildUrl(api.investments.create.path, { projectId }), {
        method: api.investments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Investment failed" }));
        throw new Error(err.message || "Investment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.projects.get.path, projectId] });
      qc.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({ title: "Investment Confirmed", description: "Your equity stake has been recorded." });
    },
    onError: (err: Error) => {
      toast({ title: "Investment Failed", description: err.message, variant: "destructive" });
    },
  });
}
