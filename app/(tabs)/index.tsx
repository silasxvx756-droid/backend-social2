// src/screens/HomeScreen.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { usePosts } from "@/hooks/usePosts";
import * as PostsListModule from "@/components/PostsList"; // IMPORT SEGURO
import { useScrollToTop } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createUserOnBackend } from "@/hooks/useCreateUser";

// Pega o default export se existir, senão pega o módulo inteiro
const PostsList = PostsListModule.default || PostsListModule.PostsList;

// ------------------------- FUNÇÃO DE NOTIFICAÇÃO -------------------------
const createNotificationForPost = async (
  post: any,
  currentUserId: string,
  existingNotifications: any[] = []
) => {
  const alreadyExists = existingNotifications.some(
    (n) => n.postId === post.id && n.type === "post"
  );
  if (alreadyExists) return;

  const storedNotifs = await AsyncStorage.getItem(`@notifications:${currentUserId}`);
  const notifications: any[] = storedNotifs ? JSON.parse(storedNotifs) : [];

  const newNotification = {
    id: `${Date.now()}-${Math.random()}`,
    type: "post",
    createdAt: Date.now(),
    read: false,
    postId: post.id,
    actor: post.actor,
  };

  const updatedNotifs = [newNotification, ...notifications];
  await AsyncStorage.setItem(
    `@notifications:${currentUserId}`,
    JSON.stringify(updatedNotifs)
  );
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= 1024;

  const router = useRouter();
  const { posts, reload } = usePosts();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const [isRefetching, setIsRefetching] = useState(false);
  const { currentUser } = useCurrentUser();

  // 🔹 Sincroniza usuário no backend assim que ele estiver logado
  useEffect(() => {
    if (!currentUser) return;

    createUserOnBackend({
      clerkId: currentUser.id,
      username: currentUser.username || currentUser.firstName.toLowerCase(),
      fullName: currentUser.firstName + " " + currentUser.lastName,
      avatarUrl: currentUser.profileImageUrl,
    });
  }, [currentUser]);

  const handlePullToRefresh = async () => {
    if (isDesktop) return;
    setIsRefetching(true);
    await reload();
    setIsRefetching(false);
  };

  // 🔹 Cria notificações para novos posts
  useEffect(() => {
    if (!currentUser?.id || !posts) return;

    posts.forEach((post) => {
      createNotificationForPost(post, currentUser.id);
    });
  }, [posts, currentUser?.id]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#fff" }} // fundo fixo branco
      edges={['top', 'left', 'right']}
    >
      {/* FEED */}
      <ScrollView
        ref={scrollRef}
        refreshControl={
          !isDesktop ? (
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handlePullToRefresh}
              tintColor="#000" // cor fixa
            />
          ) : undefined
        }
        contentContainerStyle={{
          alignItems: isDesktop ? "center" : "stretch",
          paddingVertical: isDesktop ? 24 : 0,
        }}
      >
        <View style={{ width: "100%", maxWidth: isDesktop ? 620 : "100%" }}>
          <PostsList />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}