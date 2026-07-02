import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";

export default function PaymentScreen() {
  const [formData, setFormData] = useState({ name: '', email: '', cpf: '', number: '', expiry: '', cvc: '' });
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://backend-social22.onrender.com/process-nowpayments-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 30.00,
          currency: "brl",
          email: formData.email,
          card: {
            number: formData.number.replace(/\s/g, ""),
            expiry: formData.expiry,
            cvc: formData.cvc
          }
        })
      });

      const data = await response.json();
      if (data.redirectUrl) {
        Alert.alert("Sucesso", "Redirecionando para pagamento...");
        // Aqui você abriria o WebView com o data.redirectUrl
      }
    } catch (err) {
      Alert.alert("Erro", "Falha na conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Nome" onChangeText={(t) => setFormData({...formData, name: t})} style={{borderWidth:1, marginBottom:10, padding:10}} />
      <TextInput placeholder="E-mail" onChangeText={(t) => setFormData({...formData, email: t})} style={{borderWidth:1, marginBottom:10, padding:10}} />
      <TextInput placeholder="Número do Cartão" onChangeText={(t) => setFormData({...formData, number: t})} style={{borderWidth:1, marginBottom:10, padding:10}} />
      <View style={{flexDirection: 'row'}}>
        <TextInput placeholder="MM/AA" onChangeText={(t) => setFormData({...formData, expiry: t})} style={{borderWidth:1, flex:1, marginRight:5, padding:10}} />
        <TextInput placeholder="CVC" onChangeText={(t) => setFormData({...formData, cvc: t})} style={{borderWidth:1, flex:1, padding:10}} />
      </View>
      <TouchableOpacity onPress={handlePay} disabled={loading} style={{backgroundColor: '#28a745', padding: 15, marginTop: 20}}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', textAlign: 'center'}}>Pagar</Text>}
      </TouchableOpacity>
    </View>
  );
}