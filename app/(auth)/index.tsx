import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";

export default function PaymentScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    cpf: "",
    amount: "30.00",
    currency: "BRL",
    // Novos campos do cartão de crédito
    cardNumber: "",
    cardHolder: "",
    cardExpiry: "", // Formato MM/AA
    cardCvv: "",
  });

  const [loading, setLoading] = useState(false);

  const processarPagamentoDireto = async () => {
    // Validação básica dos campos
    if (!form.name || !form.email.includes("@") || !form.cpf || !form.cardNumber || !form.cardCvv) {
      Alert.alert("Erro", "Por favor, preencha todos os campos do formulário e do cartão.");
      return;
    }

    setLoading(true);
    try {
      // Divide a validade MM/AA
      const [expiryMonth, expiryYear] = form.cardExpiry.split("/");

      const res = await fetch("https://backend-social22.onrender.com/create-card-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: parseFloat(form.amount),
          price_currency: form.currency,
          customer_name: form.name,
          customer_email: form.email,
          customer_cpf: form.cpf,
          // Dados do cartão enviados de forma segura para o seu backend repassar à MaxelPay
          card: {
            number: form.cardNumber.replace(/\s/g, ""), // Remove espaços
            holder_name: form.cardHolder,
            exp_month: parseInt(expiryMonth, 10),
            exp_year: parseInt(expiryYear, 10) < 100 ? 2000 + parseInt(expiryYear, 10) : parseInt(expiryYear, 10), // Garante 4 dígitos (Ex: 2026)
            cvv: form.cardCvv,
          }
        }),
      });

      const data = await res.json();

      if (data?.success) {
        Alert.alert("Sucesso!", "Pagamento aprovado com sucesso! Seu acesso foi liberado.");
        // Opcional: Limpar formulário de cartão por segurança
        setForm({ ...form, cardNumber: "", cardCvv: "", cardExpiry: "", cardHolder: "" });
      } else {
        Alert.alert("Erro no Pagamento", data?.message || "Cartão recusado ou dados inválidos.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha na conexão com o servidor de pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Checkout Transparente</Text>
        <Text style={styles.subtitle}>Insira os dados do cartão abaixo</Text>

        {/* --- DADOS PESSOAIS --- */}
        <Text style={styles.sectionTitle}>1. Dados Pessoais</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nome Completo"
          placeholderTextColor="#999"
          value={form.name}
          onChangeText={(v) => setForm({ ...form, name: v })}
        />

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
        />

        <TextInput
          style={styles.input}
          placeholder="CPF (apenas números)"
          placeholderTextColor="#999"
          keyboardType="numeric"
          value={form.cpf}
          onChangeText={(v) => setForm({ ...form, cpf: v })}
        />

        {/* --- DADOS DO CARTÃO --- */}
        <Text style={styles.sectionTitle}>2. Dados do Cartão</Text>

        <TextInput
          style={styles.input}
          placeholder="Número do Cartão"
          placeholderTextColor="#999"
          keyboardType="numeric"
          maxLength={19}
          value={form.cardNumber}
          onChangeText={(v) => setForm({ ...form, cardNumber: v })}
        />

        <TextInput
          style={styles.input}
          placeholder="Nome impresso no cartão"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          value={form.cardHolder}
          onChangeText={(v) => setForm({ ...form, cardHolder: v })}
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 10 }]}
            placeholder="Validade (MM/AA)"
            placeholderTextColor="#999"
            maxLength={5}
            value={form.cardExpiry}
            onChangeText={(v) => setForm({ ...form, cardExpiry: v })}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="CVV"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
            value={form.cardCvv}
            onChangeText={(v) => setForm({ ...form, cardCvv: v })}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total a pagar:</Text>
          <Text style={styles.priceValue}>R$ {form.amount.replace(".", ",")}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={processarPagamentoDireto} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pagar Agora</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40, backgroundColor: "#f9f9f9", flexGrow: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", padding: 25, borderRadius: 12, width: "100%", maxWidth: 480, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", color: "#111" },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#4C36CD", marginBottom: 10, marginTop: 10, textTransform: "uppercase" },
  input: { height: 48, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, paddingHorizontal: 16, marginBottom: 12, fontSize: 15, color: "#333", backgroundColor: "#fff" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  button: { backgroundColor: "#4C36CD", height: 50, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 15 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 15 },
  priceContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  priceLabel: { fontSize: 15, color: "#666" },
  priceValue: { fontSize: 20, fontWeight: "bold", color: "#111" },
});