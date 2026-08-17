import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return api.auth.me.responses[200].parse(data);
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const payload = api.auth.login.input.parse(credentials);
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Login failed" }));
        throw new Error(err.message || "Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Welcome back", description: "Successfully logged in." });
    },
    onError: (err: Error) => {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; username: string }) => {
      const payload = api.auth.register.input.parse(data);
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Registration failed" }));
        throw new Error(err.message || "Registration failed");
      }
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Welcome to the Circle", description: "Your account is ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not create account", description: err.message, variant: "destructive" });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const payload = api.auth.changePassword.input.parse(data);
      const res = await fetch(api.auth.changePassword.path, {
        method: api.auth.changePassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Could not change password" }));
        throw new Error(err.message || "Could not change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Updated", description: "Your password has been changed." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not change password", description: err.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
      toast({ title: "Logged out", description: "See you next time." });
    },
  });

  const verifyStripeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch("/api/stripe/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.user) {
        queryClient.setQueryData([api.auth.me.path], data.user);
        toast({ title: "Welcome to the Circle!", description: "Your membership is now active." });
      }
    },
    onError: () => {
      toast({ title: "Verification failed", description: "Please contact support if payment was charged.", variant: "destructive" });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      const res = await fetch(api.auth.updateRoles.path, {
        method: api.auth.updateRoles.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update roles");
      return api.auth.updateRoles.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Roles Updated", description: "Your creative roles have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update roles.", variant: "destructive" });
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    changePassword: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
    logout: logoutMutation.mutateAsync,
    verifyStripeSession: verifyStripeSessionMutation.mutateAsync,
    isVerifyingSession: verifyStripeSessionMutation.isPending,
    updateRoles: updateRolesMutation.mutateAsync,
    isUpdatingRoles: updateRolesMutation.isPending,
  };
}
