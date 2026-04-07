// ProfileScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import PostsList from "@/components/PostsList";
import { useProfile } from "@/hooks/useProfile";

const HEADER_OFFSET = 10;
const API_URL = "https://backend-social-app-1.onrender.com";

type FollowUser = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
};

export default function ProfileScreen() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const { formData, updateFormField } = useProfile();
  const insets = useSafeAreaInsets();

  // ------------------- STATES -------------------
  const [postsCount, setPostsCount] = useState(0);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followType, setFollowType] = useState<"followers" | "following">("followers");
  const imageOpacity = useRef(new Animated.Value(0)).current;

  // ------------------- LOAD CLERK -------------------
  const loadFromClerk = useCallback(() => {
    if (!user) return;
    updateFormField("username", user.username || "");
    updateFormField("firstName", user.firstName || "");
    updateFormField("avatar", user.imageUrl || "");
  }, [user]);

  useEffect(() => {
    loadFromClerk();
  }, [loadFromClerk]);

  // ------------------- FETCH FOLLOWERS -------------------
  const fetchFollowers = useCallback(async () => {
    if (!user) return;
    setLoadingFollow(true);
    try {
      const res = await fetch(`${API_URL}/followers/${user.id}`);
      const data: FollowUser[] = await res.json();
      setFollowers(data);
    } catch (err) {
      console.log("Erro ao buscar seguidores:", err);
    } finally {
      setLoadingFollow(false);
    }
  }, [user]);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    setLoadingFollow(true);
    try {
      const res = await fetch(`${API_URL}/following/${user.id}`);
      const data: FollowUser[] = await res.json();
      setFollowing(data);
    } catch (err) {
      console.log("Erro ao buscar seguindo:", err);
    } finally {
      setLoadingFollow(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchFollowers();
      fetchFollowing();
      fetchPostsCount();
    }, [fetchFollowers, fetchFollowing])
  );

  // ------------------- POSTS COUNT -------------------
  const fetchPostsCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/users/${user.id}`);
      const data = await res.json();
      setPostsCount(data.posts || 0);
    } catch (err) {
      console.log("Erro ao buscar contador de posts:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchPostsCount();
  }, [fetchPostsCount]);

  // ------------------- HANDLERS -------------------
  const handleFollowClick = (type: "followers" | "following") => {
    if (type === "followers") fetchFollowers();
    else fetchFollowing();
    setFollowType(type);
    setShowFollowModal(true);
  };

  const handleSignOut = async () => {
    let logOutput = "==== LOG DE LOGOUT ====\n";
    try {
      logOutput += "Botão Sair clicado!\n";

      await clerk.signOut();
      logOutput += "Logout realizado com sucesso!\n";

      router.replace("/(auth)");

      logOutput += "Navegou para (auth)/index.tsx.\n";
    } catch (err) {
      logOutput += `Erro ao tentar sair: ${err}\n`;
    } finally {
      logOutput += "====================\n";
      console.log(logOutput);
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
            <Text style={{ color: "#000", fontWeight: "600" }}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, alignItems: "center" }}>
          <Animated.Image
            source={{ uri: formData.avatar }}
            style={{ width: 96, height: 96, borderRadius: 48, opacity: imageOpacity }}
            onLoad={() =>
              Animated.timing(imageOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start()
            }
          />

          <Text style={{ fontSize: 16, fontWeight: "600", color: "#000", marginTop: 12 }}>
            {formData.firstName || "Usuário"}
          </Text>

          {/* EDIT PROFILE BUTTON */}
          <TouchableOpacity
            onPress={() => router.push("/EditProfile")}
            style={{
              marginTop: 12,
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: "#eee",
            }}
          >
            <Text style={{ color: "#000", fontWeight: "600" }}>Editar Perfil</Text>
          </TouchableOpacity>

          {/* STATS OCULTOS */}
          {/*
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "80%",
              marginVertical: 12,
            }}
          >
            {[
              { label: "posts", value: postsCount },
              { label: "seguidores", value: followers.length, type: "followers" },
              { label: "seguindo", value: following.length, type: "following" },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={{ alignItems: "center", flex: 1 }}
                disabled={!item.type}
                onPress={() => item.type && handleFollowClick(item.type)}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>{item.value}</Text>
                <Text style={{ fontSize: 12, color: "#666" }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          */}
        </View>

        {/* POSTS */}
        {user ? (
          <PostsList username={user.id} showNewPostButton={false} />
        ) : (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 24 }} />
        )}
      </ScrollView>

      {/* FOLLOW MODAL */}
      <Modal visible={showFollowModal} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
            }}
          >
            <TouchableOpacity onPress={() => setShowFollowModal(false)}>
              <Feather name="arrow-left" size={22} color="#000" />
            </TouchableOpacity>

            <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>
              {followType === "followers" ? "Seguidores" : "Seguindo"}
            </Text>

            <View style={{ width: 22 }} />
          </View>

          {loadingFollow ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={followType === "followers" ? followers : following}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
                  <Image
                    source={{ uri: item.avatar || "https://via.placeholder.com/40" }}
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                  />
                  <View>
                    <Text style={{ color: "#000", fontWeight: "600" }}>{item.displayName}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}