import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Post = { id: string; image: string; caption?: string };
type User = {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts?: Post[];
};

// ⚠️ Coloque aqui o URL público do seu backend
const API_URL = "https://backend-social-app-1.onrender.com";

const SearchScreen = ({ currentUserId }: { currentUserId?: string }) => {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  /* ================= BUSCA ================= */
  const performSearch = (query: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setFilteredUsers([]);
      setSearching(false);
      setError("");
      return;
    }

    setSearching(true);
    setError("");

    debounceTimer.current = setTimeout(async () => {
      try {
        let url = `${API_URL}/users?search=${encodeURIComponent(trimmed)}`;
        if (currentUserId) url += `&exclude=${currentUserId}`;

        const res = await fetch(url);
        if (!res.ok) {
          console.log("Erro HTTP:", res.status);
          setFilteredUsers([]);
          setError("Erro ao buscar usuários");
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.log("Resposta não é array:", data);
          setFilteredUsers([]);
          setError("Resposta inválida do servidor");
          return;
        }

        const users: User[] = data.map((u: any) => ({
          id: u.clerkId,
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          bio: u.bio,
          followers: u.followers,
          following: u.following,
          posts: u.posts,
        }));

        setFilteredUsers(users);
      } catch (err) {
        console.log("Erro na busca:", err);
        setFilteredUsers([]);
        setError("Não foi possível conectar ao backend");
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  /* ================= CLICAR USUÁRIO ================= */
  const handleUserPress = (user: User) => {
    Keyboard.dismiss();

    router.push({
      pathname: "/UserProfile",
      params: { userId: user.id },
    });
  };

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery]);

  /* ================= RENDER USER ================= */
  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Feather name="user" size={20} color="#657786" />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.displayName || item.username}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
    >
      <SafeAreaView style={styles.container}>
        {/* Search Box */}
        <View style={styles.searchBox}>
          <Feather name="search" size={20} color="#657786" />
          <TextInput
            placeholder="Pesquisar"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#657786"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Feather name="x" size={18} color="#657786" />
            </TouchableOpacity>
          )}
        </View>

        {searching && (
          <View style={styles.searchingContainer}>
            <ActivityIndicator size="small" color="#1da1f2" />
            <Text style={{ marginLeft: 8 }}>Pesquisando...</Text>
          </View>
        )}

        {error ? (
          <Text style={{ textAlign: "center", marginTop: 20, color: "red" }}>
            {error}
          </Text>
        ) : null}

        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !error && searchQuery ? (
              <Text style={{ textAlign: "center", marginTop: 30 }}>
                Nenhum usuário encontrado 😕
              </Text>
            ) : null
          }
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f8fa",
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: "#14171a" },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  userInfo: { marginLeft: 10, flexShrink: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  displayName: { fontWeight: "600", color: "#14171a" },
  searchingContainer: { flexDirection: "row", justifyContent: "center", paddingVertical: 10 },
});

export default SearchScreen;