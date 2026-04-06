// src/screens/SignInScreen.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { useClerk } from "@clerk/clerk-expo";
import { useNavigation } from "@react-navigation/native";

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const clerk = useClerk();
  const navigation = useNavigation();

  const handleSignIn = async () => {
    try {
      // Aqui você pode usar Clerk para login com SSO ou email/password
      // Por enquanto, vamos só navegar para o Profile como exemplo:
      navigation.replace("Profile");
    } catch (err) {
      console.log("Erro no login:", err);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#000" : "#fff" },
      ]}
    >
      <Text style={[styles.title, { color: isDarkMode ? "#fff" : "#000" }]}>
        Bem-vindo!
      </Text>

      <TouchableOpacity
        onPress={handleSignIn}
        style={[styles.button, { backgroundColor: isDarkMode ? "#1DA1F2" : "#007AFF" }]}
      >
        <Text style={styles.buttonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});