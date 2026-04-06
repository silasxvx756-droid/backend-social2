import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { showNotification } from "./notify";

/* ------------------------------------ */
/* TIPOS */
/* ------------------------------------ */
type UserActor = {
  id: string;
  username: string;
  avatar?: string;
};

type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "message"
  | "post";

/* ------------------------------------ */
/* FUNÇÃO PRINCIPAL */
/* ------------------------------------ */
export const addNotification = async (
  actor: UserActor,
  type: NotificationType = "like",
  postId?: string,
  targetUserId?: string,      // 👤 quem recebe
  currentUserId?: string,     // 👤 quem está usando o app
  forceNotify: boolean = false
) => {
  try {
    /* ---------------- PROTEÇÕES ---------------- */

    if (!targetUserId) return;

    // ❌ nunca notificar a si mesmo
    if (actor.id === targetUserId) return;

    /* ---------------- MENSAGEM ---------------- */

    let message = "";

    switch (type) {
      case "like":
        message = `@${actor.username} curtiu seu post ❤️`;
        break;

      case "comment":
        message = `@${actor.username} comentou em seu post 💬`;
        break;

      case "follow":
        message = `@${actor.username} começou a seguir você 👤`;
        break;

      case "message":
        message = `Nova mensagem de @${actor.username} ✉️`;
        break;

      case "post":
        message = `@${actor.username} criou uma nova publicação 🚀`;
        break;

      default:
        return;
    }

    /* ---------------- STORAGE KEY ---------------- */

    const storageKey = `@notifications:${targetUserId}`;

    const stored = await AsyncStorage.getItem(storageKey);
    const list = stored ? JSON.parse(stored) : [];

    /* ---------------- EVITAR DUPLICAÇÃO ---------------- */

    const alreadyExists = list.some(
      (n: any) =>
        n.type === type &&
        n.postId === postId &&
        n.actor?.id === actor.id
    );

    if (alreadyExists) return;

    /* ---------------- CRIA NOTIFICAÇÃO ---------------- */

    const newNotification = {
      id: `${Date.now()}_${actor.id}`,
      type,
      message,
      read: false,
      createdAt: Date.now(),
      postId: postId ?? null,
      actor,
    };

    const updatedList = [newNotification, ...list];

    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify(updatedList)
    );

    /* ---------------- NOTIFICAÇÃO LOCAL ---------------- */

    // 🔕 só dispara se for o usuário logado
    if (!forceNotify && currentUserId !== targetUserId) return;

    try {
      // vibração
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      // som
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/notify.mp3")
      );

      await sound.playAsync();
      setTimeout(() => sound.unloadAsync(), 2000);
    } catch (e) {
      console.log("Erro som/vibração:", e);
    }

    await showNotification("Nova notificação", message);

  } catch (err) {
    console.error("❌ Erro ao enviar notificação:", err);
  }
};