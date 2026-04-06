// src/hooks/useCurrentUser.ts
import { useUser } from "@clerk/clerk-expo";
import { useMemo, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string | null;
}

export const useCurrentUser = () => {
  const { user, isLoaded } = useUser();

  // Normaliza usuário
  const currentUser: CurrentUser | null = useMemo(() => {
    if (!isLoaded || !user) return null;

    const username =
      user.username ||
      (user.unsafeMetadata?.username as string) ||
      "usuario";

    const displayName =
      (user.unsafeMetadata?.displayName as string) ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      username;

    return {
      id: user.id,
      username,
      displayName,
      avatar: user.imageUrl ?? null,
    };
  }, [isLoaded, user]);

  // Salva ou atualiza no AsyncStorage
  useEffect(() => {
    if (!currentUser) return;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem("@all_users");
        const users: CurrentUser[] = stored ? JSON.parse(stored) : [];

        const index = users.findIndex((u) => u.id === currentUser.id);
        if (index >= 0) {
          users[index] = currentUser; // atualiza
        } else {
          users.push(currentUser);
        }

        await AsyncStorage.setItem("@all_users", JSON.stringify(users));
      } catch (err) {
        console.log("Erro ao salvar usuário no AsyncStorage", err);
      }
    })();
  }, [currentUser]);

  return { currentUser, isLoaded };
};