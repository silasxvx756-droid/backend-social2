// TabsLayout.tsx
import React, { useState, useEffect } from "react";
import { Image, ActivityIndicator, View, Keyboard, Platform } from "react-native";
import { Tabs, Redirect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import * as NavigationBar from "expo-navigation-bar";

import { useUserSync } from "../../hooks/useUserSync";

const API_URL = "https://backend-social-app-1.onrender.com";

const TabsLayout = () => {
  // ------------------- CLERK / USER -------------------
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  useUserSync(); // sincroniza dados do usuário

  // ------------------- HOOKS -------------------
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // ------------------- KEYBOARD LISTENERS -------------------
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ------------------- CHECK NOVAS MENSAGENS -------------------
  const checkNewMessages = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();

      const res = await axios.get(
        `${API_URL}/api/messages/unread/${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setHasNewMessages(res.data.unreadCount > 0);
    } catch (err) {
      console.error("Erro ao buscar mensagens não lidas:", err);
    }
  };

  // ------------------- INTERVAL SEGURO -------------------
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      checkNewMessages();
    }, 5000);

    checkNewMessages();

    return () => clearInterval(interval);
  }, [user?.id]);

  // ------------------- RESET NOTIF AO ENTRAR -------------------
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setHasNewMessages(false);
    });

    return () => unsubscribe();
  }, [navigation]);

  // ------------------- ANDROID NAVIGATION BAR -------------------
  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync("#FFF"); // fundo branco
      NavigationBar.setButtonStyleAsync("dark"); // ícones escuros
    }
  }, []);

  // ------------------- LOADING -------------------
  if (!isLoaded || !userLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  // ------------------- REDIRECT -------------------
  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  const backgroundColor = "#FFF";

  // ------------------- TABS -------------------
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          display: keyboardVisible ? "none" : "flex",
          backgroundColor,
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
          height: 55 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarIcon: ({ focused, color }) => {
          // PROFILE
          if (route.name === "profile") {
            if (user?.imageUrl) {
              return (
                <Image
                  source={{ uri: user.imageUrl }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: focused ? 2 : 0,
                    borderColor: focused ? "#000" : "transparent",
                  }}
                />
              );
            }

            return (
              <Ionicons
                name="person-outline"
                size={24}
                color={focused ? "#000" : color}
              />
            );
          }

          // NOTIFICATIONS
          if (route.name === "notifications") {
            return (
              <Ionicons
                name={focused ? "notifications" : "notifications-outline"}
                size={24}
                color={focused ? "#000" : color}
              />
            );
          }

          // MESSAGES
          if (route.name === "messages") {
            return (
              <View>
                <Ionicons
                  name={focused ? "chatbubble" : "chatbubble-outline"}
                  size={24}
                  color={focused ? "#000" : color}
                />
                {hasNewMessages && (
                  <View
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 0,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "red",
                    }}
                  />
                )}
              </View>
            );
          }

          // OUTROS ICONES
          let iconName = "";

          switch (route.name) {
            case "index":
              iconName = focused ? "home" : "home-outline";
              break;
            case "search":
              iconName = focused ? "search" : "search-outline";
              break;
            default:
              iconName = "ellipse";
          }

          return (
            <Ionicons
              name={iconName as any}
              size={24}
              color={focused ? "#000" : color}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
};

export default TabsLayout;