// src/hooks/useProfile.ts
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-expo";

export interface ProfileFormData {
  firstName: string;
  username: string;
  bio: string;
  avatar: string;
}

export const useProfile = () => {
  const { user, isLoaded } = useUser();

  // ✅ Hooks sempre no topo
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: "",
    username: "",
    bio: "",
    avatar: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);

  // Preenche dados do Clerk automaticamente
  useEffect(() => {
    if (isLoaded && user) {
      setFormData({
        firstName: user.firstName || "",
        username: user.username || "",
        bio: user.publicMetadata?.bio || "",
        avatar: user.imageUrl || "",
      });
    }
  }, [isLoaded, user]);

  // Atualiza campos individuais
  const updateFormField = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Atualiza múltiplos campos de uma vez
  const setProfileData = useCallback((data: Partial<ProfileFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  // Salva perfil no Clerk
  const saveProfile = useCallback(async (avatarFile?: File) => {
    if (!user) return;

    try {
      setIsUpdating(true);
      await user.update({
        firstName: formData.firstName,
        username: formData.username,
        profileImageFile: avatarFile,
        publicMetadata: { bio: formData.bio },
      });
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [user, formData]);

  return {
    formData,
    updateFormField,
    setProfileData,
    saveProfile,
    isUpdating,
  };
};