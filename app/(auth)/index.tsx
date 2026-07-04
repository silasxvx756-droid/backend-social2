
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
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    cpf: "",
    cardNumber: "",
    expiry: "", // Formato MM/AA
    cvc: "",
    amount: "30.00",
    currency: "brl"
  });
  
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const processarPagamentoCartao = async () => {
    if (!form.name || !form.email.includes("@") || !form.cpf) {
      Alert.alert("Erro", "Por favor, preencha os dados pessoais.");
      return;
    }
    if (form.cardNumber.length < 13 || !form.expiry.includes("/") || form.cvc.length < 3) {
      Alert.alert("Erro", "Por favor, preencha os dados do cartão corretamente.");
      return;
    }

    setLoading(true);

    const [expiryMonth, expiryYear] = form.expiry.split("/");

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
          customer_cpf: form.cpf,
          payment_data: {
            card_number: form.cardNumber.replace(/\s+/g, ''),
            expiry_month: expiryMonth.trim(),
            expiry_year: "20" + expiryYear.trim(),
            cvc: form.cvc,
            holder_name: form.name
          }
        }) 
      });

      const data = await res.json();

      setForm(prev => ({ ...prev, cardNumber: "", expiry: "", cvc: "" }));

      // FIXED: Using bracket notation data['3ds_url'] instead of data.3ds_url
      const urlDeAutenticacao = data.redirectUrl || data['3ds_url'] || data.checkout_url;

      if (urlDeAutenticacao) {
        setCheckoutUrl(urlDeAutenticacao);
        setModalVisible(true);
      } else if (data.status === "confirmed" || data.status === "waiting" || data.success) {
        Alert.alert("Sucesso", "Pagamento enviado para processamento com sucesso!");
      } else {
        Alert.alert("Erro no Cartão", data.message || "Não foi possível autorizar o cartão.");
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
      <Text style={styles.subtitle}>Pagamento via Cartão de Crédito</Text>

      <Text style={styles.label}>Nome do Titular (como no cartão)</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Ex: JOAO M SILVA" 
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

      <Text style={styles.label}>CPF do Titular</Text>
      <TextInput 
        style={styles.input} 
        placeholder="000.000.000-00" 
        placeholderTextColor="#999"
        keyboardType="numeric" 
        value={form.cpf} 
        onChangeText={(v) => setForm({...form, cpf: v})} 
      />
      
      <View style={styles.divider} />

      <Text style={styles.label}>Número do Cartão</Text>
      <TextInput 
        style={styles.input} 
        placeholder="0000 0000 0000 0000" 
        placeholderTextColor="#999"
        keyboardType="numeric" 
        value={form.cardNumber} 
        onChangeText={(v) => setForm({...form, cardNumber: v})} 
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Validade</Text>
          <TextInput 
            style={styles.input} 
            placeholder="MM/AA" 
            placeholderTextColor="#999"
            maxLength={5}
            value={form.expiry} 
            onChangeText={(v) => setForm({...form, expiry: v})} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>CVC / CVV</Text>
          <TextInput 
            style={styles.input} 
            placeholder="123" 
            placeholderTextColor="#999"
            keyboardType="numeric" 
            maxLength={4}
            secureTextEntry={true} 
            value={form.cvc} 
            onChangeText={(v) => setForm({...form, cvc: v})} 
          />
        </View>
      </View>

      <View style={styles.priceContainer}>
        <Text style={styles.priceLabel}>Total a ser debitado:</Text>
        <Text style={styles.priceValue}>R$ {form.amount.replace('.', ',')}</Text>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={processarPagamentoCartao} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Pagar Agora</Text>
        )}
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flex: 1 }}>
            {checkoutUrl && (
              <WebView 
                source={{ uri: checkoutUrl }} 
                startInLoadingState={true}
                renderLoading={() => <ActivityIndicator size="large" color="#4C36CD" style={styles.absoluteCenter} />}
              />
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Concluir e Voltar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60, backgroundColor: '#f9f9f9', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: "bold", textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 25, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { height: 52, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 16, marginBottom: 18, fontSize: 16, color: '#333', backgroundColor: '#fff' },
  row: { flexDirection: "row", gap: 16 },
  button: { backgroundColor: "#4C36CD", height: 56, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 15 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 15 },
  priceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 },
  priceLabel: { fontSize: 15, color: '#666' },
  priceValue: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  closeButton: { padding: 18, backgroundColor: '#111', alignItems: 'center' },
  absoluteCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }] }
});

