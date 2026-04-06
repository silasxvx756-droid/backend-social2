import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useApiClient } from "../utils/api";

export const useUserSync = () => {
  const { isSignedIn } = useAuth();
  const { user, isLoaded } = useUser();
  const api = useApiClient();

  const syncUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user found");

      const body = {
        clerkId: user.id,
        username:
          user.username ||
          user.primaryEmailAddress?.emailAddress?.split("@")[0],
        displayName:
          user.firstName +
          (user.lastName ? ` ${user.lastName}` : ""),
        avatar: user.imageUrl,
      };

      console.log("🚀 Sync enviando:", body);

      const res = await fetch(`${api.baseURL}/api/users/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data = await res.json();
      console.log("✅ Sync concluído:", data);

      return data;
    },
  });

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      syncUserMutation.mutate();
    }
  }, [isLoaded, isSignedIn, user]);

  return {
    isSyncing: syncUserMutation.isPending,
  };
};