// screens/sso-callback.tsx
import { useEffect, useRef } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

export default function SSOCallback() {
  const { isSignedIn, isLoaded, user } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isLoaded || hasRedirected.current) return;

    if (isSignedIn) {
      hasRedirected.current = true;

      // Se o usuário já tiver foto de perfil, entra direto
      if (user?.profileImageUrl) {
        router.replace("/(tabs)/index");
      } else {
        // Caso não tenha foto, vai para a tela de adicionar foto
        router.replace("/(auth)/profile-photo");
      }

      return;
    }

    // Login cancelado → volta para login
    const timeout = setTimeout(() => {
      hasRedirected.current = true;
      router.replace("/(auth)");
    }, 800);

    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn, user]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
      }}
    >
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12, color: "#666" }}>
        Verificando login...
      </Text>
    </View>
  );
}