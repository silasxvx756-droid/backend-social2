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
  SafeAreaView,
  Platform, // Importado para checar se é Web ou Mobile
  Linking   // Importado para abrir link externo no navegador se for Web
} from "react-native";

// Importa condicionalmente para evitar erros em builds Web puros
let WebView;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

export default function PaymentScreen() {
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    cpf: "",
    amount: "30.00",
    currency: "brl"
  });
  
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const processarPagamentoNowPayments = async () => {
    if (!form.name || !form.email.includes("@") || !form.cpf) {
      Alert.alert("Erro", "Por favor, preencha todos os campos corretamente.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: parseFloat(form.amount),
          price_currency: form.currency,
          order_description: "Compra Checkout Premium",
          customer_name: form.name,
          customer_email: form.email,
          customer_cpf: form.cpf
        }) 
      });

      const data = await res.json();

      if (data.success && data.redirectUrl) {
        // CORREÇÃO DE PLATAFORMA:
        if (Platform.OS === 'web') {
          // Se for navegador Web, abre em uma nova aba diretamente
          Linking.openURL(data.redirectUrl);
        } else {
          // Se for Android/iOS, abre o fluxo normal de WebView nativo
          setCheckoutUrl(data.redirectUrl);
          setModalVisible(true);
        }
      } else {
        Alert.alert("Erro", data.message || "Falha ao iniciar processamento.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha na conexão com o servidor de pagamentos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Checkout Premium</Text>
      <Text style={styles.subtitle}>Insira seus dados para prosseguir ao pagamento</Text>

      <Text style={styles.label}>Nome Completo</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Ex: João Silva" 
        placeholderTextColor="#999"
        value={form.name} 
        onChangeText={(v) => setForm({...form, name: v})} 
      />

      <Text style={styles.label}>E-mail</Text>
      <TextInput 
        style={styles.input} 
        placeholder="seu-email@dominio.com" 
        placeholderTextColor="#999"
        keyboardType="email-address" 
        autoCapitalize="none" 
        value={form.email} 
        onChangeText={(v) => setForm({...form, email: v})} 
      />

      <Text style={styles.label}>CPF</Text>
      <TextInput 
        style={styles.input} 
        placeholder="000.000.000-00" 
        placeholderTextColor="#999"
        keyboardType="numeric" 
        value={form.cpf} 
        onChangeText={(v) => setForm({...form, cpf: v})} 
      />
      
      <View style={styles.divider} />

      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Total a pagar:</Text>
        <Text style={styles.priceValue}>R$ {form.amount.replace('.', ',')}</Text>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={processarPagamentoNowPayments} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Ir para o Pagamento</Text>
        )}
      </TouchableOpacity>

      {/* O Modal e o WebView só serão montados/renderizados se NÃO estiver na Web */}
      {Platform.OS !== 'web' && (
        <Modal visible={modalVisible} animationType="slide" transparent={false}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
              {checkoutUrl && WebView && (
                <WebView 
                  source={{ uri: checkoutUrl }} 
                  startInLoadingState={true}
                  renderLoading={() => <ActivityIndicator size="large" color="#4C36CD" style={styles.absoluteCenter} />}
                />
              )}
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Fechar e Voltar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, backgroundColor: '#f9f9f9', flexGrow: 1, maxWidth: 500, alignSelf: 'center', width: '100%' },
  title: { fontSize: 26, fontWeight: "bold", textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { height: 52, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 16, marginBottom: 18, fontSize: 16, color: '#333', backgroundColor: '#fff' },
  button: { backgroundColor: "#4C36CD", height: 56, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 20 },
  priceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 10 },
  priceLabel: { fontSize: 16, color: '#666' },
  priceValue: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  closeButton: { padding: 18, backgroundColor: '#111', alignItems: 'center' },
  absoluteCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }] }
});