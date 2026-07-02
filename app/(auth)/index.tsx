import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import * as Application from 'expo-application';

export default function PaymentScreen() {
  const [inputEmail, setInputEmail] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputCpf, setInputCpf] = useState("");
  
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState(""); 
  const [cardCvc, setCardCvc] = useState("");
  
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pagamentoSucesso, setPagamentoSucesso] = useState(false);

  useEffect(() => {
    async function fetchDeviceFingerprint() {
      try {
        if (Platform.OS === 'android') {
          const id = await Application.getAndroidId();
          setDeviceId(id || `and-${Date.now()}`);
        } else if (Platform.OS === 'ios') {
          const id = await Application.getIosIdForVendorAsync();
          setDeviceId(id || `ios-${Date.now()}`);
        } else {
          setDeviceId(`web-${Date.now()}`);
        }
      } catch (err) {
        setDeviceId(`err-${Date.now()}`);
      }
    }
    fetchDeviceFingerprint();
  }, []);

  const processarPagamentoNowPayments = async () => {
    if (!inputEmail.includes("@") || !inputEmail.includes(".")) {
      alert("Por favor, insira um e-mail válido.");
      return;
    }
    if (cardNumber.length < 13 || cardCvc.length < 3 || !cardExpiry.includes("/")) {
      alert("Por favor, preencha todos os campos do cartão corretamente.");
      return;
    }
    if (inputCpf.replace(/\D/g, "").length !== 11) {
      alert("Por favor, insira um CPF válido.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 30.00, // Mantido em 30 para evitar erros de limite mínimo fiat-to-crypto
          currency: "BRL",
          email: inputEmail.trim(),
          name: inputName.trim(),
          cpf: inputCpf.replace(/\D/g, ""),
          card: {
            number: cardNumber.replace(/\s/g, ""),
            expiry: cardExpiry.trim(),
            cvc: cardCvc.trim()
          },
          deviceId: deviceId
        })
      });

      const textoBruto = await res.text();
      console.log("Resposta Bruta:", textoBruto);

      if (!res.ok) {
        if (textoBruto.includes("<!DOCTYPE") || textoBruto.includes("Cannot POST")) {
          alert("Erro na rota do servidor. Verifique se o deploy completou.");
        } else {
          const erroData = JSON.parse(textoBruto);
          alert(erroData.message || "Erro no processamento do cartão.");
        }
        return;
      }

      const data = JSON.parse(textoBruto);

      if (data?.status === "approved" || data?.status === "success") {
        setPagamentoSucesso(true);
      } else {
        alert(data?.message || "Pagamento recusado. Verifique os dados ou saldo.");
      }
    } catch (err) {
      alert(`Erro na comunicação com o servidor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (pagamentoSucesso) {
    return (
      <View style={styles.containerSucesso}>
        <View style={styles.cardSucesso}>
          <Text style={styles.iconSucesso}>🎉</Text>
          <Text style={styles.titleSucesso}>¡Pagamento Aprovado!</Text>
          <Text style={styles.subtitleSucesso}>Seu plano Premium já está ativo via NOWPayments.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.containerForm}>
      <Text style={styles.titleForm}>Checkout Premium - R$ 30,00</Text>
      
      <TextInput style={styles.input} placeholder="Nome Completo" value={inputName} onChangeText={setInputName} editable={!loading} />
      <TextInput style={styles.input} placeholder="E-mail" value={inputEmail} onChangeText={setInputEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
      <TextInput style={styles.input} placeholder="CPF (apenas números)" value={inputCpf} onChangeText={setInputCpf} keyboardType="numeric" maxLength={11} editable={!loading} />

      <View style={{ width: '100%', maxWidth: 400, borderTopWidth: 1, borderColor: '#eee', marginTop: 10, paddingTop: 15 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 10, color: '#333' }}>Dados do Cartão de Crédito</Text>
      </View>

      <TextInput style={styles.input} placeholder="Número do Cartão" value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" editable={!loading} />

      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="Validade (MM/AA)" value={cardExpiry} onChangeText={setCardExpiry} maxLength={5} editable={!loading} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="CVC / CVV" value={cardCvc} onChangeText={setCardCvc} keyboardType="numeric" maxLength={4} editable={!loading} />
      </View>

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={processarPagamentoNowPayments} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pagar Agora</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  containerForm: { flexGrow: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 20 },
  titleForm: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: { width: "100%", maxWidth: 400, height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16 },
  row: { flexDirection: "row", width: "100%", maxWidth: 400 },
  button: { backgroundColor: "#28a745", width: "100%", maxWidth: 400, height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 10 },
  buttonDisabled: { backgroundColor: "#6c757d" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  containerSucesso: { flex: 1, backgroundColor: "#f4f7f6", justifyContent: "center", alignItems: "center" },
  cardSucesso: { backgroundColor: "#fff", padding: 30, borderRadius: 16, alignItems: "center" },
  iconSucesso: { fontSize: 60, marginBottom: 15 },
  titleSucesso: { fontSize: 24, fontWeight: "bold", color: "#2e7d32" },
  subtitleSucesso: { fontSize: 16, color: "#333", marginTop: 10 }
});