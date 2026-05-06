import { useSocialAuth } from "@/hooks/useSocialAuth";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  Pressable,
  View,
  Platform,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";

const API_URL = "https://backend-social-app-1.onrender.com";

export default function Index() {
  const { handleSocialAuth, isLoading: isSocialLoading } = useSocialAuth();
  const { user } = useUser();
  const router = useRouter();

  const { width, height } = Dimensions.get("window");
  const isDesktop = width > 768;

  const LOGO_SIZE = isDesktop ? 140 : 180;

  const [hoverGoogle, setHoverGoogle] = useState(false);
  const [hoverComece, setHoverComece] = useState(false);

  const THEME_BLUE = "#2563EB";
  const THEME_BLUE_HOVER = "#1D4ED8";
  const GRAY_BORDER = "#D1D5DB";
  const LIGHT_GRAY_BG = "#E5E7EB";

  async function syncUserWithMongo() {
    try {
      if (!user) return;

      const response = await fetch(`${API_URL}/api/users/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
          image: user.imageUrl,
        }),
      });

      const data = await response.json();
      console.log("Mongo Sync:", data);
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
    <SafeAreaView className="flex-1 bg-white dark:bg-white">
      <ScrollView
        contentContainerStyle={{
          minHeight: height,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 40,
          paddingBottom: 60,
        }}
        className="bg-white dark:bg-white"
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 900,
            flexDirection: isDesktop ? "row" : "column",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* LADO ESQUERDO */}
          <View
            style={{
              flex: 1,
              padding: isDesktop ? 40 : 20,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* LOGO */}
            <View className="items-center mb-10">
              <Image
                source={require("../../assets/images/logo1.png")}
                style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
                resizeMode="contain"
              />
            </View>

            {/* BOTÕES SOCIAIS */}
            <View
              style={{
                width: isDesktop ? 400 : "100%",
              }}
              className="gap-3"
            >
              {/* Google */}
              <Pressable
                onPress={() => handleLogin("oauth_google")}
                disabled={isSocialLoading}
                onMouseEnter={() => isDesktop && setHoverGoogle(true)}
                onMouseLeave={() => isDesktop && setHoverGoogle(false)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: isDesktop ? 36 : 48,
                  borderRadius: 9999,
                  width: "100%",
                  borderWidth: 2,
                  borderColor: GRAY_BORDER,
                  backgroundColor: hoverGoogle ? LIGHT_GRAY_BG : "transparent",
                  paddingHorizontal: 16,
                }}
              >
                {isSocialLoading ? (
                  <ActivityIndicator color="#9CA3AF" />
                ) : (
                  <>
                    <Image
                      source={require("../../assets/images/google.png")}
                      style={{ width: 18, height: 18 }}
                      resizeMode="contain"
                    />

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <Text className="text-black font-semibold text-base">
                        Continuar com Google
                      </Text>
                    </View>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* LADO DIREITO DESKTOP */}
          {isDesktop && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                padding: 40,
              }}
            >
              <Text className="text-4xl font-bold text-gray-800 mb-4 text-center">
                Conecte-se. Crie. Inspire.
              </Text>

              <Text className="text-lg text-gray-600 mb-6 text-center">
                Entre para nossa comunidade e compartilhe suas ideias com o
                mundo. Experimente recursos exclusivos e colaboração em tempo
                real.
              </Text>

              <Pressable
                onPress={() => router.push("/(auth)/register-email")}
                onMouseEnter={() => setHoverComece(true)}
                onMouseLeave={() => setHoverComece(false)}
                style={{
                  backgroundColor: hoverComece ? THEME_BLUE_HOVER : THEME_BLUE,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 9999,
                  alignItems: "center",
                }}
              >
                <Text className="text-white font-semibold text-base text-center">
                  Comece agora
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}