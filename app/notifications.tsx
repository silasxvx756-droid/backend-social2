import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import axios from "axios";
import { useUser } from "@clerk/clerk-expo";
import { useFocusEffect } from "expo-router";
import { io } from "socket.io-client";

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

type Notification = {
  _id: string;
  type: "like" | "comment" | "follow" | "post";
  createdAt: string;
  read: boolean;
  postId?: string;
  actor?: {
    id: string;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const navigating = useRef(false);
  const { user } = useUser();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = "https://backend-social-app-1.onrender.com";

  const getCurrentUser = () => ({
    id: user?.id || "",
    displayName: user?.fullName || user?.username || "Usuário",
    avatar: user?.imageUrl || "https://via.placeholder.com/32",
  });

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API_URL}/api/notifications/${user.id}`);
      setNotifications(res.data);
      if (scrollRef.current)
        scrollRef.current.scrollTo({ y: 0, animated: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const s = io(API_URL);

    if (user?.id) s.emit("join", user.id);

    s.on("new-notification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    s.on("notification-updated", ({ notificationId, actor }) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId
            ? { ...n, actor: { ...n.actor, ...actor } }
            : n
        )
      );
    });

    return () => s.disconnect();
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await axios.post(`${API_URL}/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handlePress = async (item: Notification) => {
    if (navigating.current) return;
    navigating.current = true;

    if (!item.read) await markAsRead(item._id);

    setTimeout(() => (navigating.current = false), 300);
  };

  const getTimeAgo = (timestamp?: string) => {
    if (!timestamp) return "";
    const diff = Date.now() - new Date(timestamp).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);

    if (m < 1) return "agora";
    if (m < 60) return `${m} min`;
    if (h < 24) return `${h} h`;
    return `${d} d`;
  };

  const renderItem = (item: Notification) => {
    const actor =
      item.actor?.id === user?.id ? getCurrentUser() : item.actor;
    const actorName =
      actor?.displayName || actor?.username || "Alguém";

    return (
      <TouchableOpacity
        key={item._id}
        style={[styles.card, !item.read && styles.unreadCard]}
        onPress={() => handlePress(item)}
      >
        <Image
          source={{ uri: actor?.avatar || "https://via.placeholder.com/44" }}
          style={styles.avatar}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.text}>
            <Text style={styles.username}>{actorName}</Text>{" "}
            {item.type === "like" && "curtiu seu post"}
            {item.type === "comment" && "comentou no seu post"}
            {item.type === "follow" && "começou a seguir você"}
            {item.type === "post" && "criou um post"}
          </Text>

          <Text style={styles.time}>
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>

        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  const now = Date.now();
  const last7Days = notifications.filter(
    (n) => now - new Date(n.createdAt).getTime() <= ONE_WEEK
  );
  const last30Days = notifications.filter(
    (n) =>
      now - new Date(n.createdAt).getTime() > ONE_WEEK &&
      now - new Date(n.createdAt).getTime() <= ONE_MONTH
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        notifications.forEach((n) => {
          if (!n.read) markAsRead(n._id);
        });
      };
    }, [notifications])
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0095f6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ width: 22 }} /> {/* placeholder */}
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 22 }} /> {/* placeholder */}
      </View>

      <ScrollView ref={scrollRef}>
        {last7Days.length > 0 && (
          <>
            <Text style={styles.section}>Últimos 7 dias</Text>
            {last7Days.map(renderItem)}
          </>
        )}

        {last30Days.length > 0 && (
          <>
            <Text style={styles.section}>Últimos 30 dias</Text>
            {last30Days.map(renderItem)}
          </>
        )}

        {last7Days.length === 0 && last30Days.length === 0 && (
          <Text style={styles.empty}>Nenhuma notificação</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  headerTitle: { fontSize: 20, fontWeight: "600" },

  section: {
    fontSize: 16,
    fontWeight: "600",
    padding: 16,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 14,
    backgroundColor: "#fff",
    elevation: 2,
  },

  unreadCard: {
    backgroundColor: "#f0f8ff",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },

  text: { fontSize: 15 },

  username: { fontWeight: "bold" },

  time: {
    fontSize: 13,
    color: "#777",
    marginTop: 4,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0095f6",
  },

  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#777",
  },
});