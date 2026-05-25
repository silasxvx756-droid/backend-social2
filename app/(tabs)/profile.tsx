// ProfileScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useProfile } from "@/hooks/useProfile";

const HEADER_OFFSET = 10;

export default function ProfileScreen() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const { formData, updateFormField } = useProfile();
  const insets = useSafeAreaInsets();

  const imageOpacity = useRef(new Animated.Value(0)).current;

  // ------------------- LOAD USER -------------------
  const loadUserData = useCallback(() => {
    if (!user) return;

    updateFormField("username", user.username || "");
    updateFormField("firstName", user.firstName || "");
    updateFormField("avatar", user.imageUrl || "");

    // ✅ carregar metadata atualizada
    updateFormField(
      "bio",
      (user.unsafeMetadata?.bio as string) || ""
    );

    updateFormField(
      "whatsapp",
      (user.unsafeMetadata?.whatsapp as string) || ""
    );
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // ✅ atualiza ao voltar da tela EditProfile
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  // ------------------- SIGN OUT -------------------
  const handleSignOut = async () => {
    try {
      await clerk.signOut();
      router.replace("/(auth)");
    } catch (err) {
      console.log("Erro ao tentar sair:", err);
    }
  };

  // ------------------- RENDER -------------------
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: insets.top + HEADER_OFFSET,
          }}
        >
          <Text />

          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: "#eee",
            }}
          >
            <Text
              style={{
                color: "#000",
                fontWeight: "600",
              }}
            >
              Sair
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE */}
        <View
          style={{
            paddingHorizontal: 16,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <Animated.Image
            source={{ uri: formData.avatar }}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              opacity: imageOpacity,
            }}
            onLoad={() =>
              Animated.timing(imageOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start()
            }
          />

          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#000",
              marginTop: 12,
            }}
          >
            {formData.firstName || "Usuário"}
          </Text>

          {/* BIO */}
          <Text
            style={{
              marginTop: 8,
              color: "#555",
              textAlign: "center",
            }}
          >
            {formData.bio || "Sem biografia"}
          </Text>

          {/* WHATSAPP */}
          <Text
            style={{
              marginTop: 4,
              color: "#25D366",
              fontWeight: "600",
            }}
          >
            WhatsApp: {formData.whatsapp || "Não informado"}
          </Text>

          {/* EDIT PROFILE */}
          <TouchableOpacity
            onPress={() => router.push("/EditProfile")}
            style={{
              marginTop: 16,
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: "#eee",
            }}
          >
            <Text
              style={{
                color: "#000",
                fontWeight: "600",
              }}
            >
              Editar Perfil
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}