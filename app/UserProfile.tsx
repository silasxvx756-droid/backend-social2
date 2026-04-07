// UserProfile.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PostsList from "../components/PostsList";

const API_URL = "https://backend-social-app-1.onrender.com";

export default function UserProfile() {
  const { user } = useUser();
  const route = useRoute();
  const router = useRouter();
  const { userId } = route.params || {};

  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [listModalVisible, setListModalVisible] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listData, setListData] = useState<any[]>([]);

  const followersRef = useRef<number>(0);

  const isMyProfile = !userId || userId === user?.id;

  // ================= LOG PARA BASH =================
  useEffect(() => {
    if (user) {
      console.log("=== USERPROFILE LOG ===");
      console.log("Usuário logado (quem abriu o perfil):", {
        id: user.id,
        username: user.username,
        displayName: user.fullName || user.firstName,
      });
      console.log("Perfil sendo visualizado (userId da rota):", userId || user.id);
      console.log("É próprio perfil?", isMyProfile);
      console.log("=======================");
    }
  }, [user, userId, isMyProfile]);
  // ================================================

  // ================= COUNTS =================
  const refreshCounts = async (clerkId: string) => {
    try {
      const [postsRes, followersRes, followingRes] = await Promise.all([
        fetch(`${API_URL}/posts`),
        fetch(`${API_URL}/followers/${clerkId}`),
        fetch(`${API_URL}/following/${clerkId}`),
      ]);

      const postsData: any[] = await postsRes.json();
      const followersData: any[] = await followersRes.json();
      const followingData: any[] = await followingRes.json();

      const userPosts = postsData.filter((post) => post.actor.id === clerkId);
      followersRef.current = followersData.length;

      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              posts: userPosts.length,
              followers: followersRef.current,
              following: followingData.length,
            }
          : prev
      );
    } catch (err) {
      console.error("Erro refreshCounts:", err);
    }
  };

  // ================= PROFILE =================
  const fetchProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);

    try {
      if (isMyProfile) {
        const myProfile = {
          id: user.id,
          clerkId: user.id,
          displayName: user.fullName || user.firstName || "Usuário",
          avatar: user.imageUrl,
          posts: 0,
          followers: 0,
          following: 0,
        };

        setProfileData(myProfile);
        await refreshCounts(user.id);
      } else {
        const res = await fetch(`${API_URL}/users/${userId}`);
        const data = await res.json();
        if (!data) return;

        setProfileData(data);
        await refreshCounts(data.clerkId);
      }
    } catch (err) {
      console.error("Erro profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // ================= FOLLOW =================
  const checkFollowStatus = async (clerkIdParam?: string) => {
    if (!user) return;
    const clerkId = clerkIdParam || profileData?.clerkId;
    if (!clerkId) return;

    try {
      const res = await fetch(
        `${API_URL}/follow/check?followerId=${user.id}&followingId=${clerkId}`
      );
      const data = await res.json();
      setIsFollowing(data.following);
    } catch (err) {
      console.error("Erro checar follow:", err);
    }
  };

  const handleFollow = async () => {
    if (!profileData || !user) return;

    const previous = isFollowing;
    const next = !previous;

    setIsFollowing(next);
    followersRef.current += next ? 1 : -1;

    setProfileData((prev) =>
      prev
        ? {
            ...prev,
            followers: followersRef.current,
          }
        : prev
    );

    try {
      await fetch(`${API_URL}/${next ? "follow" : "unfollow"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: user.id,
          followingId: profileData.clerkId,
        }),
      });

      await refreshCounts(profileData.clerkId);
    } catch (err) {
      console.error("Erro follow:", err);

      // rollback
      setIsFollowing(previous);
      followersRef.current += previous ? 1 : -1;
    }
  };

  // ================= CHAT =================
  const fetchMessages = async (receiverClerkId: string) => {
    if (!user) return;
    try {
      const res = await fetch(
        `${API_URL}/messages?user1=${user.id}&user2=${receiverClerkId}`
      );
      const msgs = await res.json();

      const sorted = msgs.sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setMessages(sorted);
    } catch (err) {
      console.error("Erro messages:", err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !profileData || !user) return;

    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: profileData.clerkId,
          content: newMessage.trim(),
        }),
      });

      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
    } catch (err) {
      console.error("Erro send:", err);
    }
  };

  // ================= LISTA =================
  const fetchList = async (type: "followers" | "following") => {
    if (!profileData?.clerkId) return;

    try {
      const res = await fetch(`${API_URL}/${type}/${profileData.clerkId}`);
      const data = await res.json();
      setListData(data || []);
      setListTitle(type === "followers" ? "Seguidores" : "Seguindo");
      setListModalVisible(true);
    } catch (err) {
      console.error("Erro fetchList:", err);
    }
  };

  // ================= EFFECTS =================
  useEffect(() => {
    if (user) fetchProfile();
  }, [userId, user]);

  useEffect(() => {
    if (!isMyProfile && profileData?.clerkId) {
      checkFollowStatus(profileData.clerkId);
    }
  }, [profileData?.clerkId]);

  useFocusEffect(
    useCallback(() => {
      if (profileData?.clerkId) {
        refreshCounts(profileData.clerkId);
        if (!isMyProfile) checkFollowStatus(profileData.clerkId);
      }
    }, [profileData?.clerkId])
  );

  useEffect(() => {
    if (isModalVisible && profileData?.clerkId) fetchMessages(profileData.clerkId);

    const interval =
      isModalVisible && profileData?.clerkId
        ? setInterval(() => fetchMessages(profileData.clerkId), 3000)
        : undefined;

    return () => interval && clearInterval(interval);
  }, [isModalVisible, profileData]);

  // ================= UI =================
  if (loadingProfile || !profileData)
    return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: "absolute", left: 16, top: 60 }}
        >
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>

        <Image source={{ uri: profileData.avatar }} style={styles.avatar} />
        <Text style={styles.name}>{profileData.displayName}</Text>

        {/* STATS */}
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.statNumber}>{profileData.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>

          <View style={styles.stat}>
            <TouchableOpacity
              onPress={() => fetchList("followers")}
              style={{ alignItems: "center" }}
            >
              <Text style={styles.statNumber}>{profileData.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stat}>
            <TouchableOpacity
              onPress={() => fetchList("following")}
              style={{ alignItems: "center" }}
            >
              <Text style={styles.statNumber}>{profileData.following}</Text>
              <Text style={styles.statLabel}>Seguindo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isMyProfile && (
          <View style={styles.actionsTop}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                isFollowing ? styles.followingBtn : styles.primaryBtn,
              ]}
              onPress={handleFollow}
            >
              <Text
                style={[
                  styles.followText,
                  isFollowing ? styles.followingText : styles.primaryText,
                ]}
              >
                {isFollowing ? "Seguindo" : "Seguir"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => setIsModalVisible(true)}
            >
              <Text style={styles.messageText}>Mensagem</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* POSTS */}
      <View style={{ flex: 1, marginTop: 20 }}>
        <PostsList
          showNewPostButton={false}
          username={profileData.clerkId}
          onPostAction={(updatedPosts) =>
            setProfileData((prev) =>
              prev ? { ...prev, posts: updatedPosts.length } : prev
            )
          }
        />
      </View>

      {/* CHAT MODAL */}
      {!isMyProfile && (
        <Modal visible={isModalVisible} animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="arrow-back" size={20} />
              </TouchableOpacity>
              <Text style={styles.chatTitle}>{profileData.displayName}</Text>
            </View>

            <FlatList
              data={messages}
              keyExtractor={(item) => item._id || item.createdAt}
              contentContainerStyle={{ padding: 10 }}
              renderItem={({ item }) => {
                const isMe = item.senderId === user.id;
                return (
                  <View
                    style={[
                      styles.bubble,
                      {
                        alignSelf: isMe ? "flex-end" : "flex-start",
                        backgroundColor: isMe ? "#000" : "#e5e5e5",
                      },
                    ]}
                  >
                    <Text style={{ color: isMe ? "#fff" : "#000" }}>
                      {item.content}
                    </Text>
                  </View>
                );
              }}
            />

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Digite uma mensagem..."
                value={newMessage}
                onChangeText={setNewMessage}
              />
              <TouchableOpacity style={styles.send} onPress={sendMessage}>
                <Ionicons name="send" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* LISTA SEGUIDORES / SEGUINDO */}
      <Modal visible={listModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setListModalVisible(false)}>
              <Ionicons name="arrow-back" size={20} />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>{listTitle}</Text>
          </View>

          <FlatList
            data={listData}
            keyExtractor={(item) => item.clerkId || item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setListModalVisible(false);
                  router.push({ pathname: "/UserProfile", params: { userId: item.clerkId } });
                }}
                style={{ flexDirection: "row", alignItems: "center", padding: 12 }}
              >
                <Image
                  source={{ uri: item.avatar }}
                  style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                />
                <View>
                  <Text style={{ fontWeight: "700" }}>{item.displayName}</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eee" }} />}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { alignItems: "center", paddingTop: 60, paddingHorizontal: 16 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginLeft: -5 },
  name: { fontSize: 20, fontWeight: "700", marginTop: 12, marginLeft: -5 },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
    marginTop: 16,
    marginBottom: 16,
  },
  stat: { alignItems: "center" },
  statNumber: { fontWeight: "700", fontSize: 16 },
  statLabel: { fontSize: 12, color: "#666" },
  actionsTop: { flexDirection: "row", justifyContent: "center", marginTop: 8, gap: 12 },
  followBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  primaryBtn: { backgroundColor: "#000" },
  followingBtn: { backgroundColor: "#f2f2f2" },
  followText: { fontWeight: "600", fontSize: 14 },
  primaryText: { color: "#fff" },
  followingText: { color: "#000" },
  messageBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: "#ddd" },
  messageText: { fontWeight: "600", fontSize: 14 },
  chatHeader: { flexDirection: "row", padding: 10, alignItems: "center" },
  chatTitle: { marginLeft: 10, fontWeight: "700" },
  bubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: "80%" },
  inputRow: { flexDirection: "row", padding: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16 },
  send: { backgroundColor: "#000", borderRadius: 20, padding: 12, marginLeft: 8 },
});