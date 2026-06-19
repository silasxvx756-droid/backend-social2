
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
  const [cpf, setCpf] = useState("");

  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || ""
  );

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user]);

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

    return () => {
      socket.off("payment-status");
    };
  }, [user]);

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
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }

    setExpiry(formatted);
  };

  const formatCpf = (text) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 11);

    let formatted = cleaned;

    if (cleaned.length > 9) {
      formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(
        6,
        9
      )}-${cleaned.slice(9)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(
        6
      )}`;
    } else if (cleaned.length > 3) {
      formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    }

    setCpf(formatted);
  };

  const validateCpf = (cpf) => {
    const cleaned = cpf.replace(/\D/g, "");

    if (cleaned.length !== 11) return false;

    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

    return true;
  };

  const handlePayment = async () => {
    try {
      if (isLoading) return;

      if (!cardNumber || !cardName || !expiry || !cvv || !email || !cpf) {
        Alert.alert("Erro", "Preencha todos os campos");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email.trim())) {
        Alert.alert("Erro", "Digite um e-mail válido");
        return;
      }

      if (!validateCpf(cpf)) {
        Alert.alert("Erro", "Digite um CPF válido");
        return;
      }

      setIsLoading(true);

      const cleanCardNumber = cardNumber.replace(/\D/g, "");
      const cleanCpf = cpf.replace(/\D/g, "");
      const [mm, yy] = expiry.split("/");

      const emailFinal = email.trim();

      console.log("📧 EMAIL:", emailFinal);
      console.log("💳 BRAND:", cardBrand);
      console.log("🪪 CPF:", cleanCpf);

      const tokenRes = await fetch(
        "https://api.mercadopago.com/v1/card_tokens",
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer APP_USR-7108909525650215-060814-1b0387b4db66fdbaf456f67eb37abcda-352899060",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            card_number: cleanCardNumber,
            security_code: cvv,
            expiration_month: Number(mm),
            expiration_year: Number(`20${yy}`),
            cardholder: {
              name: cardName,
              identification: {
                type: "CPF",
                number: cleanCpf,
              },
            },
          }),
        }
      );

      const tokenData = await tokenRes.json();

      console.log("=================================");
      console.log("TOKEN GERADO");
      console.log("=================================");
      console.log(JSON.stringify(tokenData, null, 2));

      if (!tokenData.id) {
        throw new Error(tokenData.message || "Erro ao gerar token");
      }

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
            payment_method_id: cardBrand,
            issuer_id: "1",
            transaction_amount: 400,
            email: emailFinal,
            userId: user?.id,
            name: cardName,
            cpf: cleanCpf,
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

      Alert.alert("Erro", err?.message || "Falha ao processar pagamento");
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
                  placeholder="MM/AA"
                  value={expiry}
                  onChangeText={formatExpiry}
                  style={styles.smallInput}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CVV</Text>

                <TextInput
                  placeholder="123"
                  value={cvv}
                  onChangeText={setCvv}
                  style={styles.smallInput}
                  keyboardType="numeric"
                  secureTextEntry
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

            <Text style={styles.label}>CPF</Text>

            <TextInput
              placeholder="000.000.000-00"
              value={cpf}
              onChangeText={formatCpf}
              style={styles.cardInput}
              keyboardType="numeric"
              maxLength={14}
            />

            <Text style={styles.label}>E-mail</Text>

            <TextInput
              placeholder="seuemail@exemplo.com"
              value={email}
              onChangeText={setEmail}
              style={styles.cardInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
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

            {!!status && (
              <Text
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  color: "#666",
                }}
              >
                Status: {status}
              </Text>
            )}

            <Text style={styles.footerText}>Pagamento 100% seguro</Text>
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