// utils/notify.ts
import * as Notifications from "expo-notifications";

// Configura o comportamento padrão das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // necessário no SDK 52+
    shouldShowList: true,   // necessário no SDK 52+
  }),
});

// Função para exibir uma notificação imediata
export const showNotification = async (title: string, body: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // exibe imediatamente
    });
  } catch (error) {
    console.error("Erro ao exibir notificação:", error);
  }
};
