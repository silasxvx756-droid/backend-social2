import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { WebView } from "react-native-webview";

export default function PaymentScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    amount: "30.00",
    currency: "BRL",
  });

  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);

  const processarPagamento = async () => {
    if (!form.name || !form.email.includes("@") || !form.cpf) {
      Alert.alert("Erro", "Por favor, preencha todos os campos corretamente.");
      return;
    }

    setLoading(true);
    try {
      // 1) Seu backend cria a cobrança no PSP/marketplace e retorna checkoutUrl + orderId
      const res = await fetch("https://backend-social22.onrender.com/create-card-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: parseFloat(form.amount),
          price_currency: form.currency,
          order_description: "Compra Acesso Premium",
          customer_name: form.name,
          customer_email: form.email,
          customer_cpf: form.cpf,
        }),
      });

      const data = await res.json();

      if (data?.success && data.checkoutUrl && data.orderId) {
        setOrderId(data.orderId);
        setCheckoutUrl(data.checkoutUrl);
      } else {
        Alert.alert("Erro", data?.message || "Falha ao iniciar processamento.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha na conexão com o servidor de pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  const checarStatus = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`https://backend-social22.onrender.com/payment-status/${orderId}`);
      const data = await res.json();

      if (data?.paid) {
        Alert.alert("Pagamento confirmado", "Obrigado! Você já pode liberar o acesso.");
        setCheckoutUrl(null);
      } else {
        Alert.alert("Pagamento não confirmado", "Aguardando confirmação do provedor.");
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível consultar o status.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!checkoutUrl ? (
        <View style={styles.card}>
          <Text style={styles.title}>Checkout Seguro</Text>
          <Text style={styles.subtitle}>Pague com Cartão de Crédito</Text>

          <Text style={styles.label}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: João Silva"
            placeholderTextColor="#999"
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
          />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu-email@dominio.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
          />

          <Text style={styles.label}>CPF</Text>
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={form.cpf}
            onChangeText={(v) => setForm({ ...form, cpf: v })}
          />

          <View style={styles.divider} />

          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Total a pagar:</Text>
            <Text style={styles.priceValue}>R$ {form.amount.replace(".", ",")}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={processarPagamento} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Acessar Cartão</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.iframeContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => setCheckoutUrl(null)}>
            <Text style={styles.backButtonText}>← Cancelar e Voltar</Text>
          </TouchableOpacity>

          <WebView
            source={{ uri: checkoutUrl }}
            style={styles.webIframe}
            startInLoadingState
            renderLoading={() => <ActivityIndicator />}
            onNavigationStateChange={(navState) => {
              // Quando o PSP redirecionar para uma URL de sucesso/cancelamento,
              // você consulta o status.
              const url = navState?.url || "";
              if (url.includes("success") || url.includes("approved")) {
                checarStatus();
              }
              if (url.includes("cancel") || url.includes("failed")) {
                setCheckoutUrl(null);
              }
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: "#f9f9f9",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 12,
    width: "100%",
    maxWidth: 480,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", color: "#111" },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 25, marginTop: 4 },
  label: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 6 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#4C36CD",
    height: 54,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 15 },
  priceContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  priceLabel: { fontSize: 15, color: "#666" },
  priceValue: { fontSize: 20, fontWeight: "bold", color: "#111" },

  iframeContainer: { width: "100%", maxWidth: 800, height: "80vh" },
  backButton: { padding: 12, backgroundColor: "#111", borderRadius: 6, marginBottom: 10, alignSelf: "flex-start" },
  backButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  webIframe: { width: "100%", flex: 1, borderRadius: 8 },
});
