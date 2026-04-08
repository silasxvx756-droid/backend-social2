import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { io, Socket } from "socket.io-client";

const API_URL = "https://backend-social-app-1.onrender.com";

type Message = {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

type User = {
  clerkId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  lastMessage?: Message | null;
  unread?: boolean;
  messages?: Message[];
};

export default function ConversationsScreen() {
  const { currentUser } = useCurrentUser();
  const insets = useSafeAreaInsets();

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState("");
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  /* ================= SOCKET ================= */
  useEffect(() => {
    if (!currentUser) return;

    const socket = io(API_URL, {
      transports: ["websocket"], // força websocket
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket conectado:", socket.id);
      socket.emit("join", currentUser.id);
    });

    const loadUserById = async (clerkId: string): Promise<User> => {
      try {
        const res = await fetch(`${API_URL}/users/${clerkId}`);
        const data: User = await res.json();
        return data;
      } catch {
        return { clerkId, username: "Usuário", displayName: "Usuário" };
      }
    };

    socket.on("message", async (msg: Message) => {
      console.log("📨 Mensagem recebida:", msg);

      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });

      const otherUserId =
        msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;

      let realUser = allUsers.find((u) => u.clerkId === otherUserId);
      if (!realUser) {
        realUser = await loadUserById(otherUserId);
        setAllUsers((prev) => [...prev, realUser!]);
      }

      setUsers((prev) => {
        const exists = prev.find((u) => u.clerkId === otherUserId);

        if (exists) {
          return prev
            .map((u) =>
              u.clerkId === otherUserId
                ? {
                    ...u,
                    lastMessage: msg,
                    unread: selectedUser?.clerkId !== otherUserId,
                    messages: [...(u.messages || []), msg],
                  }
                : u
            )
            .sort(sortByLastMessage);
        } else {
          return [
            {
              ...realUser!,
              lastMessage: msg,
              unread: selectedUser?.clerkId !== otherUserId,
              messages: [msg],
            },
            ...prev,
          ].sort(sortByLastMessage);
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, allUsers, selectedUser]);

  /* ================= HELPERS ================= */
  const sortByLastMessage = (a: User, b: User) => {
    const aTime = a.lastMessage
      ? new Date(a.lastMessage.createdAt).getTime()
      : 0;
    const bTime = b.lastMessage
      ? new Date(b.lastMessage.createdAt).getTime()
      : 0;
    return bTime - aTime;
  };

  const fetchWithTimeout = (url: string, options = {}, timeout = 10000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout)
      ),
    ]) as Promise<Response>;
  };

  /* ================= LOAD USERS ================= */
  const loadUsers = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await fetchWithTimeout(
        `${API_URL}/users?exclude=${currentUser.id}`
      );

      const data: User[] = await res.json();
      setAllUsers(data);

      const usersWithLast = await Promise.all(
        data.map(async (user) => {
          try {
            const resMsg = await fetchWithTimeout(
              `${API_URL}/messages?user1=${currentUser.id}&user2=${user.clerkId}`
            );

            const msgs: Message[] = await resMsg.json();
            const last = msgs[msgs.length - 1];

            return {
              ...user,
              lastMessage: last || null,
              messages: msgs || [],
              unread: false,
            };
          } catch {
            return { ...user, lastMessage: null, messages: [], unread: false };
          }
        })
      );

      setUsers((prev) => {
        const merged = [...prev];
        usersWithLast.forEach((u) => {
          const index = merged.findIndex((p) => p.clerkId === u.clerkId);
          if (index >= 0) merged[index] = { ...merged[index], ...u };
          else merged.push(u);
        });
        return merged.sort(sortByLastMessage);
      });
    } catch (err) {
      console.error("Erro loadUsers", err);
    }
  }, [currentUser]);

  const loadMessages = async (user: User) => {
    if (!currentUser) return;

    try {
      const res = await fetchWithTimeout(
        `${API_URL}/messages?user1=${currentUser.id}&user2=${user.clerkId}`
      );

      const data: Message[] = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Erro loadMessages", err);
    }
  };

  /* ================= SEND ================= */
  const sendMessage = async () => {
    if (!currentUser || !selectedUser || !inputText.trim()) return;

    const body = {
      senderId: currentUser.id,
      receiverId: selectedUser.clerkId,
      content: inputText.trim(),
    };

    const tempMessage: Message = {
      _id: Date.now().toString(),
      ...body,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInputText("");

    try {
      const res = await fetchWithTimeout(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const realMsg = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m._id === tempMessage._id ? realMsg : m))
      );
    } catch (err) {
      console.error("Erro sendMessage", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const openChat = (user: User) => {
    setSelectedUser(user);
    setChatVisible(true);

    if (user.messages?.length) setMessages(user.messages);
    else loadMessages(user);

    setUsers((prev) =>
      prev.map((u) => (u.clerkId === user.clerkId ? { ...u, unread: false } : u))
    );
  };

  const getDisplayName = (user: User | null) =>
    user?.displayName || user?.username || "Usuário";

  const getAvatar = (user: User | null) => user?.avatar || null;

  const copyMessage = async (content: string) => {
    await Clipboard.setStringAsync(content);
    Alert.alert("Mensagem copiada!", content);
  };

  const displayedUsers = searchText
    ? allUsers.filter((u) =>
        (u.displayName || u.username)
          .toLowerCase()
          .includes(searchText.toLowerCase())
      )
    : users;

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.headerTitle,
          { paddingTop: insets.top + 20, paddingHorizontal: 16 },
        ]}
      >
        Mensagens
      </Text>

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar usuários..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <FlatList
        data={[...displayedUsers].sort(sortByLastMessage)}
        keyExtractor={(i) => i.clerkId}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => openChat(item)}
          >
            {getAvatar(item) ? (
              <Image source={{ uri: getAvatar(item)! }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={22} color="#999" />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{getDisplayName(item)}</Text>
              {item.lastMessage && (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage.content}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={chatVisible} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setChatVisible(false)}>
              <Feather name="arrow-left" size={20} />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>
              {getDisplayName(selectedUser)}
            </Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(i) => i._id}
            contentContainerStyle={{ padding: 10 }}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            onContentSizeChange={() =>
              setTimeout(
                () => flatListRef.current?.scrollToEnd({ animated: true }),
                50
              )
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === currentUser?.id;
              return (
                <TouchableOpacity
                  onPress={() => copyMessage(item.content)}
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
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Digite uma mensagem..."
              value={inputText}
              onChangeText={setInputText}
            />
            <TouchableOpacity style={styles.send} onPress={sendMessage}>
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  userItem: { flexDirection: "row", padding: 16, alignItems: "center" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 14 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  name: { fontSize: 16, fontWeight: "600" },
  lastMessage: { fontSize: 14, color: "#666", marginTop: 2 },
  chatHeader: { flexDirection: "row", alignItems: "center", padding: 10 },
  chatTitle: { marginLeft: 10, fontWeight: "700", fontSize: 16 },
  bubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: "90%" },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16 },
  send: { backgroundColor: "#000", borderRadius: 20, padding: 10, marginLeft: 8 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8 },
});