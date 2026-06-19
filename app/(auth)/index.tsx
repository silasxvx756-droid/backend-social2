import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useUser } from "@clerk/clerk-expo";

export default function PaymentScreen() {
  const { user } = useUser();

  const [preferenceId, setPreferenceId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createPreference();
  }, []);

  const createPreference = async () => {
    try {
      const res = await fetch(
        "https://backend-social22.onrender.com/create-preference",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id,
          }),
        }
      );

      const data = await res.json();
      setPreferenceId(data.preferenceId);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Carregando pagamento...</Text>
      </View>
    );
  }

  if (!preferenceId) {
    return (
      <View style={styles.center}>
        <Text>Erro ao carregar pagamento</Text>
      </View>
    );
  }

  const url =
    `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`;

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Plano Premium - R$ 10</Text>

      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    fontSize: 18,
    marginVertical: 10,
    fontWeight: "600",
  },
});