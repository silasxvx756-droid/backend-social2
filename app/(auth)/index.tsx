import React, { useRef, useState, useEffect } from "react";

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

const socket = io("https://backend-social-app-1.onrender.com");

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

  // 🔌 SOCKET
  useEffect(() => {
    if (!user?.id) return;

    socket.emit("join", user.id);

    socket.on("payment-status", (data) => {
      console.log("📡 status recebido:", data);
      setStatus(data.status);

      if (data.status === "approved") {
        setPaymentSuccess(true);
      }
    });

    return () => {
      socket.off("payment-status");
    };
  }, [user]);

  // 💳 detect card brand
  const detectCardBrand = (number) => {
    const cleaned = number.replace(/\D/g, "");

    if (/^4/.test(cleaned)) return "visa";
    if (/^(5[1-5]|2[2-7])/.test(cleaned)) return "mastercard";
    if (/^3[47]/.test(cleaned)) return "amex";

    return "unknown";
  };

  // 📌 format card
  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 16);
    const formatted = cleaned.replace(/(.{4})/g, "$1 ").trim();

    setCardNumber(formatted);
    setCardBrand(detectCardBrand(cleaned));
  };

  // 📌 format expiry
  const formatExpiry = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 4);

    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }

    setExpiry(formatted);
  };

  // 💳 PAYMENT
  const handlePayment = async () => {
    try {
      if (isLoading) return;

      if (!cardNumber || !cardName || !expiry || !cvv) {
        Alert.alert("Erro", "Preencha todos os campos");
        return;
      }

      setIsLoading(true);

      console.log("🔄 gerando token...");

      // 1. TOKEN MERCADO PAGO
      const tokenRes = await fetch(
        "https://api.mercadopago.com/v1/card_tokens",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer APP_USR-5486663540607434-060814-99261513fe2a3de65d5acdcfe51d9864-3459883644`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            card_number: cardNumber.replace(/\s/g, ""),
            security_code: cvv,
            expiration_month: expiry.split("/")[0],
            expiration_year: "20" + expiry.split("/")[1],
            cardholder: {
              name: cardName,
            },
          }),
        }
      );

      const tokenData = await tokenRes.json();

      console.log("📦 token:", tokenData);

      if (!tokenData.id) {
        throw new Error("Erro ao gerar token do cartão");
      }

      // 2. BACKEND PAYMENT
      const response = await fetch(
        "https://backend-social-app-1.onrender.com/card-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: tokenData.id,
            installments: 1,
            paymentMethodId: cardBrand,
            issuerId: "1",
            email: user?.primaryEmailAddress?.emailAddress,
            userId: user?.id,
            name: cardName,
          }),
        }
      );

      const data = await response.json();

      console.log("📦 backend response:", data);

      setIsLoading(false);

      // 3. STATUS CHECK
      if (data.status === "approved") {
        setPaymentSuccess(true);
      } else if (data.status === "pending") {
        Alert.alert("Pagamento em análise ⏳");
      } else {
        Alert.alert("Pagamento recusado ❌", data.status || "Erro");
      }
    } catch (err) {
      setIsLoading(false);
      Alert.alert("Erro", err.message || "Falha no pagamento");
    }
  };

  // ✅ SUCCESS SCREEN
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

  // 🧾 UI
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.card}>
            <Image
              source={{
                uri: "https://cdn-icons-png.flaticon.com/512/2489/2489756.png",
              }}
              style={styles.logo}
            />

            <Text style={styles.title}>Checkout Premium</Text>
            <Text style={styles.subtitle}>Pagamento seguro</Text>

            <TextInput
              placeholder="Número do cartão"
              value={cardNumber}
              onChangeText={formatCardNumber}
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              placeholder="Nome no cartão"
              value={cardName}
              onChangeText={setCardName}
              style={styles.input}
            />

            <TextInput
              placeholder="MM/AA"
              value={expiry}
              onChangeText={formatExpiry}
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              placeholder="CVV"
              value={cvv}
              onChangeText={setCvv}
              style={styles.input}
              keyboardType="numeric"
            />

            <TouchableOpacity
              onPress={handlePayment}
              style={styles.button}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Pagar agora
                </Text>
              )}
            </TouchableOpacity>

            {/* STATUS REAL TIME */}
            <Text style={{ marginTop: 15, fontSize: 16, textAlign: "center" }}>
              Status: {status || "aguardando pagamento..."}
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
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
  },
  logo: {
    width: 60,
    height: 60,
    alignSelf: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
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