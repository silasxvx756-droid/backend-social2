import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { useUser } from "@clerk/clerk-expo";
import io from "socket.io-client";

const socket = io("https://backend-social22.onrender.com");

export default function PaymentScreen() {
  const { user } = useUser();

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardBrand, setCardBrand] = useState("");

  // SOCKET
  useEffect(() => {
    if (!user?.id) return;

    socket.emit("join", user.id);

    socket.on("payment-status", (data) => {
      console.log("📡 STATUS:", data);
      setStatus(data.status);

      if (data.status === "approved") {
        setPaymentSuccess(true);
      }
    });

    return () => socket.off("payment-status");
  }, [user]);

  // CARD BRAND (CORRIGIDO)
  const detectCardBrand = (number) => {
    if (/^4/.test(number)) return "visa";
    if (/^(5[1-5]|2[2-7])/.test(number)) return "master";
    if (/^3[47]/.test(number)) return "amex";
    return "visa";
  };

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 16);
    const formatted = cleaned.replace(/(.{4})/g, "$1 ").trim();

    setCardNumber(formatted);
    setCardBrand(detectCardBrand(cleaned));
  };

  const formatExpiry = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 4);

    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }

    setExpiry(formatted);
  };

  // PAYMENT
  const handlePayment = async () => {
    try {
      if (isLoading) return;

      console.log("🟢 CLIQUEI NO PAGAR");

      if (!cardNumber || !cardName || !expiry || !cvv) {
        Alert.alert("Erro", "Preencha todos os campos");
        return;
      }

      setIsLoading(true);

      const cleanCardNumber = cardNumber.replace(/\D/g, "");
      const [mm, yy] = expiry.split("/");

      const emailFinal =
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        "teste@email.com";

      console.log("📧 EMAIL:", emailFinal);
      console.log("💳 BRAND:", cardBrand);

      // 1. TOKEN MP
      const tokenRes = await fetch(
        "https://api.mercadopago.com/v1/card_tokens",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer APP_USR-7108909525650215-060814-1b0387b4db66fdbaf456f67eb37abcda-352899060`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            card_number: cleanCardNumber,
            security_code: cvv,
            expiration_month: Number(mm),
            expiration_year: Number("20" + yy),
            cardholder: {
              name: cardName,
            },
          }),
        }
      );

      const tokenData = await tokenRes.json();

      console.log("📦 TOKEN:", tokenData);

      if (!tokenData.id) {
        throw new Error(tokenData.message || "Erro ao gerar token");
      }

      // 2. BACKEND
      const response = await fetch(
        "https://backend-social22.onrender.com/card-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: tokenData.id,
            installments: 1,
            payment_method_id: cardBrand, // agora vem "master"
            issuer_id: "1",
            transaction_amount: 1,
            email: emailFinal,
            userId: user?.id,
            name: cardName,
          }),
        }
      );

      console.log("📡 STATUS HTTP:", response.status);

      const data = await response.json();
      console.log("📦 BACKEND:", data);

      setIsLoading(false);

      const statusMP = data?.mercadoPago?.status;

      if (statusMP === "approved") {
        setPaymentSuccess(true);
      } else if (statusMP === "pending") {
        Alert.alert("Pagamento em análise ⏳");
      } else {
        Alert.alert("Pagamento recusado ❌", statusMP || "Erro");
      }
    } catch (err) {
      setIsLoading(false);
      console.log("❌ ERRO:", err);
      Alert.alert("Erro", err.message || "Falha no pagamento");
    }
  };

  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successBox}>
          <Text style={styles.successText}>✔ Pagamento aprovado</Text>

          <TouchableOpacity
            onPress={() => setPaymentSuccess(false)}
            style={styles.button}
          >
            <Text style={{ color: "#fff" }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
  <View style={styles.checkoutCard}>
  <Image
    source={{
      uri: "https://cdn-icons-png.flaticon.com/512/2489/2489756.png",
    }}
    style={styles.moneyIcon}
  />

  <Text style={styles.checkoutTitle}>Checkout Premium</Text>
  <Text style={styles.checkoutSubtitle}>Pagamento seguro</Text>

  <View style={styles.priceBox}>
    <Text style={styles.price}>R$ 10,00</Text>
  </View>

  <Text style={styles.label}>Número do cartão</Text>

  <TextInput
    placeholder="0000 0000 0000 0000"
    value={cardNumber}
    onChangeText={formatCardNumber}
    style={styles.cardInput}
    keyboardType="numeric"
  />

  <View style={styles.row}>
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>Validade</Text>

      <TextInput
        placeholder="MM / AA"
        value={expiry}
        onChangeText={formatExpiry}
        style={styles.smallInput}
        keyboardType="numeric"
      />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.label}>CVV</Text>

      <TextInput
        placeholder="CVV"
        value={cvv}
        onChangeText={setCvv}
        style={styles.smallInput}
        keyboardType="numeric"
      />
    </View>
  </View>

  <Text style={styles.label}>Nome no cartão</Text>

  <TextInput
    placeholder="Seu nome"
    value={cardName}
    onChangeText={setCardName}
    style={styles.cardInput}
  />

  <TouchableOpacity
    style={styles.payButton}
    onPress={handlePayment}
    disabled={isLoading}
  >
    {isLoading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.payButtonText}>Pagar agora</Text>
    )}
  </TouchableOpacity>

  <Text style={styles.footerText}>
    Pagamento 100% seguro
  </Text>
</View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
  },

  checkoutCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },

  moneyIcon: {
    width: 55,
    height: 55,
    alignSelf: "center",
    marginBottom: 10,
  },

  checkoutTitle: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    color: "#000",
  },

  checkoutSubtitle: {
    textAlign: "center",
    color: "#8a8a8a",
    marginTop: 2,
    marginBottom: 15,
  },

  priceBox: {
    backgroundColor: "#eef3ff",
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 20,
  },

  price: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: "bold",
    color: "#2563eb",
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },

  cardInput: {
    borderWidth: 1.5,
    borderColor: "#d9d9d9",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 15,
    fontSize: 16,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  smallInput: {
    borderWidth: 1.5,
    borderColor: "#d9d9d9",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 15,
    fontSize: 16,
  },

  payButton: {
    backgroundColor: "#2f63e6",
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  payButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },

  footerText: {
    textAlign: "center",
    color: "#888",
    marginTop: 15,
    fontSize: 13,
  },

  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },

  successBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  successText: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
});