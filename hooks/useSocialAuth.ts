// src/hooks/useSocialAuth.ts
import { useSSO, useUser, useClerk } from "@clerk/clerk-expo";
import { useState } from "react";
import { Platform } from "react-native";
import { createUserOnBackend } from "./useCreateUser";

const generateUsername = () => {
  const randomPart = Math.random().toString(36).substring(2, 8);
  const number = Math.floor(100 + Math.random() * 900);
  return `user_${randomPart}_${number}`.toLowerCase();
};

export const useSocialAuth = () => {
  const [isLoading, setIsLoading] = useState(false);

  const { startSSOFlow } = useSSO();
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSocialAuth = async (
    strategy: "oauth_google" | "oauth_apple"
  ) => {
    setIsLoading(true);

    try {
      // força limpar sessão atual no web
      if (Platform.OS === "web") {
        await signOut();
      }

      const ssoResult = await startSSOFlow({
        strategy,

        redirectUrl:
          Platform.OS === "web"
            ? window.location.origin
            : undefined,

        additionalParameters: {
          prompt: "select_account",
        },
      });

      if (!ssoResult?.createdSessionId || !ssoResult?.setActive) {
        return false;
      }

      const { createdSessionId, setActive } = ssoResult;

      await setActive({ session: createdSessionId });

      if (!user) {
        return false;
      }

      if (!user.username) {
        let attempts = 0;
        let success = false;

        while (attempts < 5 && !success) {
          try {
            const username = generateUsername();
            await user.update({ username });
            success = true;
          } catch {
            attempts++;
          }
        }
      }

      if (user.username) {
        await createUserOnBackend({
          clerkId: user.id,
          username: user.username,
          fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          avatarUrl: user.profileImageUrl,
        });
      }

      return true;
    } catch (err) {
      console.log("Erro no social auth:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSocialAuth };
};