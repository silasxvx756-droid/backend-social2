// PostsList.tsx
import React, { useState } from "react";
import {
  FlatList,
  View,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

const API_URL = "https://backend-social-app-1.onrender.com";
const { width } = Dimensions.get("window");

// Componente de anúncio com imagem local
const AdItem = () => (
  <View style={styles.adContainer}>
    <Text style={styles.adLabel}>Patrocinado</Text>
    <View style={styles.adBox}>
      <Image
        source={require("../assets/images/propaganda.png")} // caminho relativo ao PostsList.tsx
        style={{ width: "100%", height: "100%", borderRadius: 12 }}
        resizeMode="cover"
      />
      <View
        style={{
          position: "absolute",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "700", color: "#000" }}>Seu anúncio aqui</Text>
        <Text style={{ fontSize: 12, color: "#555" }}>
          Venda produtos ou serviços
        </Text>
      </View>
    </View>
  </View>
);

export default function PostsList({
  username,
  showNewPostButton = true,
  initialPosts = [],
  onPostAction,
}) {
  const { user } = useUser();
  const navigation = useNavigation();

  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(!initialPosts.length);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [content, setContent] = useState("");
  const [image, setImage] = useState<any>(null);
  const [posting, setPosting] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  const [commentsModal, setCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");

  const currentUser = {
    id: user?.id,
    username:
      user?.username ||
      user?.primaryEmailAddress?.emailAddress?.split("@")[0],
    displayName: user?.fullName || user?.firstName || "Usuário",
    avatar: user?.imageUrl,
  };

  // Formata tempo
  const formatTime = (date: string) => {
    if (!date) return "";
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
    return past.toLocaleDateString();
  };

  // FETCH POSTS
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/posts`);
      const data = await res.json();
      const filtered = username
        ? data.filter((p: any) => p.actor?.id === username)
        : data;

      const postsWithLiked = (filtered || []).map((p: any) => ({
        ...p,
        likedByMe: p.likes?.some((u: any) => u.id === currentUser.id),
      }));

      setPosts(postsWithLiked);
      if (onPostAction) onPostAction(postsWithLiked);
    } catch (e) {
      console.log("Erro fetchPosts:", e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchPosts();
    }, [username])
  );

  // PICK IMAGE
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    }
  };

  // CREATE POST
  const handleCreatePost = async () => {
    if (!content.trim() && !image) return;
    try {
      setPosting(true);
      const form = new FormData();
      form.append("title", "Post");
      form.append("content", content);
      form.append("actor", JSON.stringify(currentUser));

      if (image) {
        const uriParts = image.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        form.append("image", {
          uri: image.uri,
          name: `photo.${fileType}`,
          type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
        } as any);
      }

      const res = await fetch(`${API_URL}/posts/upload`, {
        method: "POST",
        body: form,
      });

      const newPost = await res.json();
      const newPosts = [newPost, ...posts];
      setPosts(newPosts);
      setModalVisible(false);
      setContent("");
      setImage(null);

      if (onPostAction) onPostAction(newPosts);
    } catch {
      Alert.alert("Erro ao postar");
    } finally {
      setPosting(false);
    }
  };

  // LIKE
  const handleLike = async (postId: string) => {
    if (likingPostId) return;
    setLikingPostId(postId);

    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likes: p.likedByMe
                ? p.likes.filter((u: any) => u.id !== currentUser.id)
                : [...(p.likes || []), currentUser],
            }
          : p
      )
    );

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentUser }),
      });
      const updated = await res.json();

      const updatedPosts = posts.map((p) =>
        p._id === postId
          ? {
              ...p,
              likes: updated.likes,
              likedByMe: updated.likes.some(
                (u: any) => u.id === currentUser.id
              ),
            }
          : p
      );

      setPosts(updatedPosts);
      if (onPostAction) onPostAction(updatedPosts);
    } catch {
      fetchPosts();
    } finally {
      setLikingPostId(null);
    }
  };

  // DELETE POST
  const handleDeletePost = async (postId: string) => {
    Alert.alert("Apagar postagem", "Tem certeza que deseja apagar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_URL}/posts/${postId}`, { method: "DELETE" });
            const updatedPosts = posts.filter((p) => p._id !== postId);
            setPosts(updatedPosts);
            if (onPostAction) onPostAction(updatedPosts);
          } catch {
            Alert.alert("Erro ao apagar postagem");
            fetchPosts();
          }
        },
      },
    ]);
  };

  // COMMENTS
  const openComments = (post: any) => {
    setSelectedPost(post);
    setComments(post.comments || []);
    setCommentsModal(true);
  };

  const handleComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    try {
      const res = await fetch(
        `${API_URL}/posts/${selectedPost._id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: currentUser, text: commentText }),
        }
      );

      const newComment = await res.json();
      const updatedPosts = posts.map((p) =>
        p._id === selectedPost._id
          ? { ...p, comments: [...(p.comments || []), newComment] }
          : p
      );

      setComments((prev) => [...prev, newComment]);
      setPosts(updatedPosts);
      setCommentText("");
      if (onPostAction) onPostAction(updatedPosts);
    } catch {
      Alert.alert("Erro ao comentar");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost) return;

    Alert.alert("Apagar comentário", "Deseja apagar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            const updatedPosts = posts.map((p) =>
              p._id === selectedPost._id
                ? {
                    ...p,
                    comments: p.comments.filter((c) => c._id !== commentId),
                  }
                : p
            );

            setComments((prev) =>
              prev.filter((c) => c._id !== commentId)
            );
            setPosts(updatedPosts);

            await fetch(
              `${API_URL}/posts/${selectedPost._id}/comments/${commentId}`,
              { method: "DELETE" }
            );

            if (onPostAction) onPostAction(updatedPosts);
          } catch {
            Alert.alert("Erro ao apagar comentário");
            fetchPosts();
          }
        },
      },
    ]);
  };

  // 🔥 MISTURA POSTS + ADS
  const mixedData = posts.flatMap((post, index) =>
    (index + 1) % 4 === 0 ? [post, { type: "ad", id: `ad-${index}` }] : post
  );

  if (loading)
    return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;

  return (
    <View style={{ flex: 1 }}>
      {showNewPostButton && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("PostCreate", { onPostCreated: fetchPosts })
            }
          >
            <Ionicons name="add" size={32} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={mixedData}
        keyExtractor={(item: any, index) =>
          item.type === "ad" ? item.id : item._id || item.id || index.toString()
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }: any) => {
          if (item.type === "ad") return <AdItem />;

          const displayName =
            item.actor?.id === currentUser.id
              ? currentUser.displayName
              : item.actor?.displayName;

          return (
            <View style={styles.postCard}>
              <View style={styles.contentPadding}>
                <View style={styles.postHeader}>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("UserProfile", {
                        userId: item.actor?.id,
                      })
                    }
                  >
                    <Image
                      source={{ uri: item.actor?.avatar }}
                      style={styles.postAvatar}
                    />
                  </TouchableOpacity>

                  <View style={styles.nameRowHorizontal}>
                    <Text style={styles.postUsername}>{displayName}</Text>
                    <Text style={styles.postTimeHorizontal}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>

                  {item.actor?.id === currentUser.id && (
                    <TouchableOpacity
                      onPress={() => handleDeletePost(item._id)}
                      style={{ marginLeft: "auto" }}
                    >
                      <Text style={{ fontSize: 20, color: "#999" }}>⋯</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {item.image && (
                <Image source={{ uri: item.image }} style={styles.postImage} />
              )}

              <View style={styles.contentPadding}>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleLike(item._id)}
                  >
                    <Ionicons
                      name={item.likedByMe ? "heart" : "heart-outline"}
                      size={22}
                      color={item.likedByMe ? "#ff3040" : "#222"}
                    />
                    <Text style={styles.count}>
                      {item.likes?.length || 0}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openComments(item)}
                  >
                    <Ionicons name="chatbubble-outline" size={20} />
                    <Text style={styles.count}>
                      {item.comments?.length || 0}
                    </Text>
                  </TouchableOpacity>
                </View>

                {item.content?.trim().length > 0 && (
                  <Text style={{ marginTop: 6 }}>
                    <Text style={{ fontWeight: "600" }}>{displayName} </Text>
                    {item.content}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* MODAL COMENTÁRIOS */}
      <Modal visible={commentsModal} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comentários</Text>
              <TouchableOpacity onPress={() => setCommentsModal(false)}>
                <Ionicons name="close" size={24} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const isMyComment = item.user.id === currentUser.id;
                const displayName = isMyComment
                  ? currentUser.displayName
                  : item.user.displayName;
                const avatarUri = isMyComment
                  ? currentUser.avatar
                  : item.user.avatar;

                return (
                  <View style={{ flexDirection: "row", marginBottom: 12 }}>
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.commentAvatar}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Text style={{ fontWeight: "700" }}>{displayName}</Text>
                          <Text style={{ fontSize: 12, color: "#555" }}>
                            {formatTime(item.createdAt)}
                          </Text>
                        </View>

                        {isMyComment && (
                          <TouchableOpacity
                            onPress={() => handleDeleteComment(item._id)}
                          >
                            <Text style={{ fontSize: 20, color: "#999" }}>⋯</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text>{item.text}</Text>
                    </View>
                  </View>
                );
              }}
            />

            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Comentário..."
                style={[styles.input, { marginRight: 8 }]}
              />
              <TouchableOpacity
                onPress={handleComment}
                style={{
                  backgroundColor: "#000",
                  padding: 10,
                  borderRadius: 20,
                }}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "flex-end", padding: 12 },
  postCard: { marginBottom: 16, backgroundColor: "#fff" },
  postHeader: { flexDirection: "row", alignItems: "center" },
  postAvatar: { width: 32, height: 32, borderRadius: 16 },
  nameRowHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 6,
  },
  postUsername: { fontWeight: "700", fontSize: 14 },
  postTimeHorizontal: { fontSize: 12, color: "#555" },
  postImage: { width: "100%", height: width, marginVertical: 8 },
  contentPadding: { paddingHorizontal: 12, paddingVertical: 6 },
  actionsRow: { flexDirection: "row", marginTop: 6, gap: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  count: { fontSize: 13, color: "#333" },

  // COMMENTS
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  commentsTitle: { fontSize: 18, fontWeight: "700" },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderColor: "#ccc",
  },

  // ADS
  adContainer: {
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  adLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
  },
  adBox: {
    height: 120,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    justifyContent: "center",
    alignItems: "center",
  },
});