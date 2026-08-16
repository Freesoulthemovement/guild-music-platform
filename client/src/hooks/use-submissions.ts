import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { Submission, User, Project } from "@shared/schema";

type SubmissionWithUser = Submission & { user: User };
type SubmissionWithUserAndProject = Submission & { user: User; project: Project };

export function useSubmissions(projectId: number, types?: string[]) {
  const typesParam = types && types.length > 0 ? `?types=${types.join(',')}` : '';
  return useQuery<SubmissionWithUser[]>({
    queryKey: [api.submissions.list.path, projectId, types],
    queryFn: async () => {
      const url = buildUrl(api.submissions.list.path, { projectId }) + typesParam;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useAllSubmissions(types?: string[]) {
  const typesParam = types && types.length > 0 ? `?types=${types.join(',')}` : '';
  return useQuery<SubmissionWithUserAndProject[]>({
    queryKey: [api.submissions.listAll.path, types],
    queryFn: async () => {
      const res = await fetch(api.submissions.listAll.path + typesParam, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });
}

export function useCreateSubmission(projectId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      type: string;
      title: string;
      description?: string;
      fileUrl?: string;
      visibility?: "private" | "public";
      licenseBestowalAmount?: number;
      sampleClearancePercent?: number;
    }) => {
      const res = await fetch(buildUrl(api.submissions.create.path, { projectId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Submission failed" }));
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.projects.get.path, projectId] });
      qc.invalidateQueries({ queryKey: [api.submissions.listAll.path] });
      toast({ title: "Contribution Submitted", description: "Your idea has been added to this project." });
    },
    onError: (err: Error) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });
}
