import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Modal } from "react-native";
import { WebView } from 'react-native-webview';
import * as Application from 'expo-application';

export default function PaymentScreen() {
  const [inputEmail, setInputEmail] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputCpf, setInputCpf] = useState("");
  
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pagamentoSucesso, setPagamentoSucesso] = useState(false);
  
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Exemplo de estado de lista caso seu app use (Onde dava o erro de .map)
  const [historicoTransacoes, setHistoricoTransacoes] = useState([]); 

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
    if (!inputName.trim() || !inputEmail.includes("@") || inputCpf.replace(/\D/g, "").length !== 11) {
      alert("Por favor, preencha todos os campos corretamente.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("https://backend-social22.onrender.com/nowpayments.io", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 30.00,
          currency: "BRL",
          email: inputEmail.trim(),
          name: inputName.trim(),
          cpf: inputCpf.replace(/\D/g, ""),
          deviceId: deviceId
        })
      });

      const data = await res.json();

      if (data?.redirectUrl) {
        setCheckoutUrl(data.redirectUrl);
        setModalVisible(true);
      } else {
        alert(data?.message || "Erro ao processar checkout.");
      }
    } catch (err) {
      alert(`Erro de conexão: ${err.message}`);
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
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.containerForm}>
      <Text style={styles.titleForm}>Checkout Premium - R$ 30,00</Text>
      
      <TextInput style={styles.input} placeholder="Nome" value={inputName} onChangeText={setInputName} editable={!loading} />
      <TextInput style={styles.input} placeholder="E-mail" value={inputEmail} onChangeText={setInputEmail} keyboardType="email-address" editable={!loading} />
      <TextInput style={styles.input} placeholder="CPF" value={inputCpf} onChangeText={setInputCpf} keyboardType="numeric" maxLength={11} editable={!loading} />

      {/* 
         PROTEÇÃO ANTIO-ERRO (Caso decida mapear arrays na tela):
         O uso do (historicoTransacoes || []) garante que se a lista estiver indefinida, 
         o app usará um array vazio temporário e não quebrará com erro de ".map"
      */}
      {historicoTransacoes && (historicoTransacoes || []).map((item, index) => (
        <Text key={index}>{item?.status}</Text>
      ))}

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={processarPagamentoNowPayments} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pagar Agora</Text>}
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.headerModal}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeText}>✕ Voltar</Text></TouchableOpacity>
            <Text style={{ fontWeight: 'bold' }}>Pagamento NowPayments</Text>
            <View style={{ width: 40 }} />
          </View>
          {checkoutUrl && (
            <WebView source={{ uri: checkoutUrl }} startInLoadingState={true} />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  containerForm: { flexGrow: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 20 },
  titleForm: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: { width: "100%", maxWidth: 400, height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15 },
  button: { backgroundColor: "#28a745", width: "100%", maxWidth: 400, height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  buttonDisabled: { backgroundColor: "#6c757d" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerModal: { height: 60, backgroundColor: '#f8f9fa', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
  closeText: { color: '#dc3545', fontWeight: 'bold' },
  containerSucesso: { flex: 1, backgroundColor: "#f4f7f6", justifyContent: "center", alignItems: "center" },
  cardSucesso: { backgroundColor: "#fff", padding: 30, borderRadius: 16, alignItems: "center" },
  iconSucesso: { fontSize: 60, marginBottom: 15 },
  titleSucesso: { fontSize: 24, fontWeight: "bold", color: "#2e7d32" }
});