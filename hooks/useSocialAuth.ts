// src/hooks/useSocialAuth.ts
import { useSSO, useUser } from "@clerk/clerk-expo";
import { useState } from "react";
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

  const handleSocialAuth = async (
    strategy: "oauth_google" | "oauth_apple"
  ) => {
    setIsLoading(true);

    try {
      const ssoResult = await startSSOFlow({ strategy });

      if (!ssoResult?.createdSessionId || !ssoResult?.setActive) {
        // login cancelado pelo usuário — apenas retorna false sem alert
        return false;
      }

      const { createdSessionId, setActive } = ssoResult;

      // ativa sessão
      await setActive({ session: createdSessionId });

      if (!user) {
        // usuário ainda não carregou — retorna false sem alert
        return false;
      }

      // cria username se não existir
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

      // cria usuário no backend
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
      // falha silenciosa — apenas loga e retorna false
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleSocialAuth };
};