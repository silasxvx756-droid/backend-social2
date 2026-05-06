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
    }, [fetchFollowers, fetchFollowing])
  );

  // ------------------- HANDLERS -------------------
  const handleFollowClick = (type: "followers" | "following") => {
    if (type === "followers") fetchFollowers();
    else fetchFollowing();
    setFollowType(type);
    setShowFollowModal(true);
  };

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
        </View>

        {/* FEED OCULTO */}
        {/* <PostsList username={user?.id} showNewPostButton={false} /> */}
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