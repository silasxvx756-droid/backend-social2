// app/_layout.tsx
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";

const queryClient = new QueryClient();

// Chave pública do Clerk e URL da API do backend
const publishableKey = Constants.manifest?.extra?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
export const API_URL = Constants.manifest?.extra?.EXPO_PUBLIC_API_URL!;

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </ClerkProvider>
  );
}