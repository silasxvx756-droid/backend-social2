import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import * as Application from 'expo-application';

// FUNÇÃO DO HTML: Injeta os dados reais coletados para validação antifraude + deviceId
const getBrickHtml = (email, userId, name, cpf, deviceId) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <script>
    window.USER_DATA = {
      email: ${JSON.stringify(email)},
      userId: ${JSON.stringify(userId)},
      name: ${JSON.stringify(name)},
      cpf: ${JSON.stringify(cpf)},
      deviceId: ${JSON.stringify(deviceId)}
    };
  </script>
</head>
<body>
  <div id="brick_container"></div>

  <script>
    window.addEventListener("load", async () => {
      try {
        const mp = new MercadoPago("APP_USR-88fc16d5-5925-42b6-a639-fee2d98763ae");
        const bricksBuilder = mp.bricks();

        await bricksBuilder.create("payment", "brick_container", {
          initialization: {
            amount: 400, // VALOR PADRONIZADO PARA R$ 400
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              pix: "all",
              maxInstallments: 1, // Força pagamento à vista
              excludes: {
                paymentMethods: ["debit_card_caixa"]
              }
            }
          },
          callbacks: {
            onReady: () => {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "READY" }));
            },
            onError: (err) => {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ERROR", message: err?.message }));
            },
            onSubmit: async (cardFormData) => {
              try {
                const token = cardFormData.token || cardFormData.formData?.token;
                const payment_method_id = cardFormData.payment_method_id || cardFormData.formData?.payment_method_id;
                const installments = cardFormData.installments || cardFormData.formData?.installments || 1;

                const res = await fetch(
                  "https://backend-social22.onrender.com/card-payment",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token: token,
                      payment_method_id: payment_method_id,
                      transaction_amount: 400, // VALOR ENVIADO AO BACKEND CONDIZENTE
                      installments: Number(installments),
                      email: window.USER_DATA.email, 
                      userId: window.USER_DATA.userId,
                      name: window.USER_DATA.name,
                      cpf: window.USER_DATA.cpf,
                      deviceId: window.USER_DATA.deviceId // <-- ENVIANDO FINGERPRINT PRO BACKEND
                    })
                  }
                );

                const data = await res.json();
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "RESULT", data }));
              } catch (err) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ERROR", message: err.message }));
              }
            }
          }
        });
      } catch (e) {
        alert(e.message);
      }
    });
  </script>
</body>
</html>
`;

export default function PaymentScreen() {
  const [inputEmail, setInputEmail] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputCpf, setInputCpf] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [dadosConfirmados, setDadosConfirmados] = useState(false);
  const [visitorId] = useState(`VISITOR-${Date.now()}`);

  // Captura o ID único de hardware assim que o componente carrega
  useEffect(() => {
    async function fetchDeviceFingerprint() {
      try {
        if (Platform.OS === 'android') {
          const id = await Application.getAndroidId();
          setDeviceId(id);
        } else if (Platform.OS === 'ios') {
          const id = await Application.getIosIdForVendorAsync();
          setDeviceId(id);
        } else {
          setDeviceId(`web-${Date.now()}`);
        }
      } catch (err) {
        setDeviceId(`fallback-${Date.now()}`);
      }
    }
    fetchDeviceFingerprint();
  }, []);

  const iniciarCheckout = () => {
    if (!inputEmail.includes("@") || !inputEmail.includes(".")) {
      alert("Por favor, insira um e-mail válido.");
      return;
    }
    if (inputName.trim().split(" ").length < 2) {
      alert("Por favor, insira seu nome completo (Nome e Sobrenome).");
      return;
    }
    if (inputCpf.replace(/\D/g, "").length !== 11) {
      alert("Por favor, insira um CPF válido com 11 dígitos.");
      return;
    }
    setDadosConfirmados(true);
  };

  if (!dadosConfirmados) {
    return (
      <ScrollView contentContainerStyle={styles.containerForm}>
        {/* CORRIGIDO: Exibição coerente do valor real */}
        <Text style={styles.titleForm}>Checkout Premium - R$ 400,00</Text>
        <Text style={styles.subtitleForm}>Insira os dados do titular do cartão para evitar bloqueios:</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nome Completo (idêntico ao cartão)"
          value={inputName}
          onChangeText={setInputName}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={inputEmail}
          onChangeText={setInputEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="CPF (apenas números do titular)"
          value={inputCpf}
          onChangeText={setInputCpf}
          keyboardType="numeric"
          maxLength={11}
        />

        <TouchableOpacity style={styles.button} onPress={iniciarCheckout}>
          <Text style={styles.buttonText}>Ir para o Pagamento</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finalize o seu Pagamento</Text>
      <Text style={{ textAlign: "center", color: "#666", marginBottom: 10 }}>Comprador: {inputName}</Text>

      {/* CORRIGIDO: Agora passa também o deviceId coletado nativamente */}
      <iframe
        srcDoc={getBrickHtml(inputEmail.trim(), visitorId, inputName.trim(), inputCpf.trim(), deviceId)}
        style={{ width: "100%", height: "650px", border: "none" }}
        title="Mercado Pago"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  containerForm: { flexGrow: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 20 },
  titleForm: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  subtitleForm: { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 20 },
  input: { width: "100%", maxWidth: 400, height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: "#007bff", width: "100%", maxWidth: 400, height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  title: { textAlign: "center", fontSize: 20, fontWeight: "600", marginTop: 20 }
});