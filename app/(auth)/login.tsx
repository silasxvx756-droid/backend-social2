import { useSocialAuth } from "@/hooks/useSocialAuth";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  Pressable,
  View,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";

const API_URL = "https://backend-social-app-1.onrender.com";

export default function Index() {
  const { handleSocialAuth, isLoading: isSocialLoading } = useSocialAuth();
  const { user } = useUser();
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const [hoverGoogle, setHoverGoogle] = useState(false);

  const GRAY_BORDER = "#D1D5DB";
  const LIGHT_GRAY_BG = "#F3F4F6";

  async function syncUserWithMongo() {
    try {
      if (!user) return;

      await fetch(`${API_URL}/api/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
          image: user.imageUrl,
        }),
      });
    } catch (error) {
      console.log("Erro ao sincronizar usuário:", error);
    }
  }

  async function handleLogin(provider: "oauth_google") {
    const success = await handleSocialAuth(provider);

    if (success) {
      await syncUserWithMongo();
      router.replace("/(tabs)");
    }
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#0F172A",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      {/* BOTÃO VOLTAR */}
      <Pressable
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: "#111827",
          borderWidth: 1,
          borderColor: "#1F2937",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
          ← Voltar
        </Text>
      </Pressable>

      {/* CARD LOGIN */}
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "#111827",
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: "#1F2937",
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#FFFFFF",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Admin Login
        </Text>

        {/* GOOGLE LOGIN */}
        <Pressable
          onPress={() => handleLogin("oauth_google")}
          disabled={isSocialLoading}
          onMouseEnter={() => isDesktop && setHoverGoogle(true)}
          onMouseLeave={() => isDesktop && setHoverGoogle(false)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            borderRadius: 10,
            width: "100%",
            borderWidth: 1,
            borderColor: GRAY_BORDER,
            backgroundColor: hoverGoogle ? LIGHT_GRAY_BG : "#FFFFFF",
            paddingHorizontal: 18,
          }}
        >
          {isSocialLoading ? (
            <ActivityIndicator color="#9CA3AF" />
          ) : (
            <>
              <Image
                source={require("../../assets/images/google.png")}
                style={{ width: 18, height: 18, marginRight: 10 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  color: "#111827",
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Entrar com Google
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}