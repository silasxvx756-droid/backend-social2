import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from "react-native";
import { WebView } from 'react-native-webview';

export default function PaymentScreen() {
  const [form, setForm] = useState({ name: "", email: "", cpf: "" });
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Script para esconder elementos da página do gateway
  // ATENÇÃO: Substitua os seletores abaixo pelas classes reais da página do NOWPayments
  const hideElementsScript = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        .header, .footer, .price-display, .company-logo { 
          display: none !important; 
        }
      \`;
      document.head.appendChild(style);
    })();
    true;
  `;

  const processarPagamento = async () => {
    if (!form.email.includes("@") || form.name.length < 3) {
      Alert.alert("Erro", "Preencha seus dados corretamente.");
      return;
    }

    setLoading(true);
    try {
      // Chama o backend para criar a fatura oficial
      const res = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form) 
      });

      const data = await res.json();

      if (data.redirectUrl) {
        setCheckoutUrl(data.redirectUrl);
        setModalVisible(true);
      } else {
        Alert.alert("Erro", data.message || "Falha ao iniciar pagamento.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Checkout Premium</Text>

      <TextInput style={styles.input} placeholder="Nome Completo" onChangeText={(v) => setForm({...form, name: v})} />
      <TextInput style={styles.input} placeholder="E-mail" keyboardType="email-address" onChangeText={(v) => setForm({...form, email: v})} />
      <TextInput style={styles.input} placeholder="CPF" keyboardType="numeric" onChangeText={(v) => setForm({...form, cpf: v})} />
      
      <TouchableOpacity style={styles.button} onPress={processarPagamento} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Prosseguir para Pagamento</Text>}
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtn}>✕ Voltar</Text>
            </TouchableOpacity>
          </View>
          
          {checkoutUrl && (
            <WebView 
              source={{ uri: checkoutUrl }}
              javaScriptEnabled={true}
              injectedJavaScript={hideElementsScript}
              startInLoadingState={true}
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: 'center' },
  input: { height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15 },
  button: { backgroundColor: "#28a745", height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
  modalHeader: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: '#eee' },
  closeBtn: { fontSize: 16, color: '#dc3545' }
});