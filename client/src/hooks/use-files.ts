import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useCreateFile(projectId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.files.create.input>) => {
      const validated = api.files.create.input.parse(data);
      const url = buildUrl(api.files.create.path, { projectId });
      const res = await fetch(url, {
        method: api.files.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to upload file");
      return api.files.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, projectId] });
      toast({ title: "File Added", description: "Successfully contributed to the project." });
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  });
}
