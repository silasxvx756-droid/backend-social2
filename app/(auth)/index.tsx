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
  Platform
} from "react-native";
import { WebView } from 'react-native-webview';

export default function PaymentScreen() {
  const [form, setForm] = useState({ name: "", email: "", cpf: "" });
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Script para limpar a interface da página de checkout (ajuste os seletores conforme necessário)
  const injectedCSS = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        header, footer, .logo, .navbar { display: none !important; }
      \`;
      document.head.appendChild(style);
    })();
  `;

  const processarPagamento = async () => {
    // Validação básica
    if (!form.name || !form.email.includes("@") || !form.cpf) {
      Alert.alert("Atenção", "Por favor, preencha todos os campos corretamente.");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (response.ok && data.redirectUrl) {
        setCheckoutUrl(data.redirectUrl);
        setModalVisible(true);
      } else {
        Alert.alert("Erro", data.message || "Não foi possível iniciar o pagamento.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Falha na conexão com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Checkout Premium</Text>

      <TextInput 
        style={styles.input} 
        placeholder="Nome Completo" 
        value={form.name}
        onChangeText={(v) => setForm({...form, name: v})} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="E-mail" 
        keyboardType="email-address" 
        autoCapitalize="none"
        value={form.email}
        onChangeText={(v) => setForm({...form, email: v})} 
      />
      <TextInput 
        style={styles.input} 
        placeholder="CPF (apenas números)" 
        keyboardType="numeric" 
        maxLength={11}
        value={form.cpf}
        onChangeText={(v) => setForm({...form, cpf: v})} 
      />

      <TouchableOpacity 
        style={[styles.button, loading && { opacity: 0.7 }]} 
        onPress={processarPagamento} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Pagar R$ 30,00</Text>
        )}
      </TouchableOpacity>

      {/* Modal contendo a WebView do Checkout */}
      <Modal 
        visible={modalVisible} 
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.headerModal}>
            <Text style={styles.headerTitle}>Pagamento Seguro</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButton}>Fechar</Text>
            </TouchableOpacity>
          </View>
          
          {checkoutUrl ? (
            <WebView 
              source={{ uri: checkoutUrl }}
              javaScriptEnabled={true}
              injectedJavaScript={injectedCSS}
              startInLoadingState={true}
              renderLoading={() => <ActivityIndicator size="large" style={{ marginTop: 50 }} />}
            />
          ) : (
            <ActivityIndicator style={{ flex: 1 }} />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 20, 
    justifyContent: 'center', 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 30, 
    textAlign: 'center',
    color: '#333'
  },
  input: { 
    height: 55, 
    borderWidth: 1, 
    borderColor: "#ddd", 
    borderRadius: 10, 
    paddingHorizontal: 15, 
    marginBottom: 15,
    fontSize: 16
  },
  button: { 
    backgroundColor: "#28a745", 
    height: 55, 
    borderRadius: 10, 
    justifyContent: "center", 
    alignItems: "center",
    marginTop: 10
  },
  buttonText: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 40 : 0 
  },
  headerModal: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  closeButton: { color: '#dc3545', fontWeight: 'bold', fontSize: 16 }
});