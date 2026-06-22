
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Dimensions } from "react-native";
import * as Application from 'expo-application';

// Importa a WebView apenas se NÃO estiver rodando na plataforma Web para evitar erros de compilação
let WebView;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

// FUNÇÃO DO HTML: Injeta os dados reais e o script oficial do Mercado Pago com segurança para Web/Mobile
const getBrickHtml = (email, userId, name, cpf, deviceId) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    html, body { 
      margin: 0; 
      padding: 0; 
      width: 100%; 
      background-color: #fff; 
      font-family: -apple-system, sans-serif;
    }
    #brick_container { 
      width: 100%; 
      min-height: 650px; 
    }
    /* Remove completamente o elemento visual da Caixa Econômica */
    [data-testid*="caixa"], [class*="caixa"], [id*="caixa"], [value*="debcaixa"] {
      display: none !important;
    }
  </style>
  
  <!-- Script do Core SDK do Bricks -->
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  
  <!-- Script coletor do Antifraude Web oficial (Garante o Score de confiança alto) -->
  <script src="https://www.mercadopago.com/v2/security.js" view="checkout" output="MP_DEVICE_SESSION_ID"></script>

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
            amount: 400, 
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              pix: "all",
              maxInstallments: 1, 
              excludes: {
                paymentMethods: ["debcaixa"]
              }
            }
          },
          callbacks: {
            onReady: () => {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: "READY" }));
              }
            },
            onError: (err) => {
              const errMsg = err?.message || "Erro de inicialização do Brick";
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ERROR", message: errMsg }));
              } else {
                console.error(errMsg);
              }
            },
            onSubmit: async (cardFormData) => {
              try {
                const token = cardFormData.token || cardFormData.formData?.token;
                const payment_method_id = cardFormData.payment_method_id || cardFormData.formData?.payment_method_id;
                const installments = cardFormData.installments || cardFormData.formData?.installments || 1;

                const webSessionId = window.MP_DEVICE_SESSION_ID || document.querySelector('input[name="MP_DEVICE_SESSION_ID"]')?.value;
                const finalDeviceId = webSessionId || window.USER_DATA.deviceId;

                const res = await fetch(
                  "https://backend-social22.onrender.com/card-payment",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token: token,
                      payment_method_id: payment_method_id,
                      transaction_amount: 400,
                      installments: Number(installments),
                      email: window.USER_DATA.email, 
                      userId: window.USER_DATA.userId,
                      name: window.USER_DATA.name,
                      cpf: window.USER_DATA.cpf,
                      deviceId: finalDeviceId
                    })
                  }
                );

                const data = await res.json();
                
                // Envia o resultado completo contendo o status retornado do seu backend
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "RESULT", status: data.mercadoPago?.status }));
                } else {
                  if (data.mercadoPago?.status === "approved") {
                    window.location.reload(); // Fallback simples para a web pura se necessário
                  } else {
                    alert("Status do pagamento: " + (data.mercadoPago?.status || "rejeitado"));
                  }
                }
              } catch (err) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ERROR", message: err.message }));
                } else {
                  alert("Erro no envio: " + err.message);
                }
              }
            }
          }
        });
      } catch (e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ERROR", message: e.message }));
        } else {
          alert(e.message);
        }
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
  const [pagamentoSucesso, setPagamentoSucesso] = useState(false); // <-- ESTADO DA TELA DE SUCESSO
  const [visitorId] = useState(`VISITOR-${Date.now()}`);
  const webViewRef = useRef(null);

  useEffect(() => {
    async function fetchDeviceFingerprint() {
      try {
        if (Platform.OS === 'android') {
          const id = await Application.getAndroidId();
          setDeviceId(id || `android-fallback-${Date.now()}`);
        } else if (Platform.OS === 'ios') {
          const id = await Application.getIosIdForVendorAsync();
          setDeviceId(id || `ios-fallback-${Date.now()}`);
        } else {
          setDeviceId(`web-client-${Date.now()}`);
        }
      } catch (err) {
        setDeviceId(`error-fallback-${Date.now()}`);
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

  const onWebViewMessage = (event) => {
    try {
      const response = JSON.parse(event.nativeEvent.data);
      
      if (response.type === "RESULT") {
        if (response.status === "approved") {
          setPagamentoSucesso(true); // <-- Ativa a tela de Sucesso Nativa
        } else if (response.status === "in_process") {
          alert("Seu pagamento está em análise. Liberaremos seu acesso assim que for aprovado!");
        } else {
          alert("O pagamento foi recusado. Por favor, tente com outro cartão ou use o Pix.");
        }
      } else if (response.type === "ERROR") {
        alert(`Erro no pagamento: ${response.message}`);
      }
    } catch (e) {
      console.log("Erro ao decodificar mensagem da WebView:", e);
    }
  };

  // ==========================================
  // 👑 TELA DE PAGAMENTO APROVADO (NATIVA)
  // ==========================================
  if (pagamentoSucesso) {
    return (
      <View style={styles.containerSucesso}>
        <View style={styles.cardSucesso}>
          <Text style={styles.iconSucesso}>🎉</Text>
          <Text style={styles.titleSucesso}>¡Pagamento Aprovado!</Text>
          <Text style={styles.subtitleSucesso}>
            Parabéns, {inputName.split(" ")[0]}! Seu plano Premium já está ativo.
          </Text>
          <Text style={styles.textSucesso}>
            Agora você tem acesso total a todas as vagas e recursos exclusivos da plataforma.
          </Text>
          
          <TouchableOpacity 
            style={styles.buttonSucesso} 
            onPress={() => alert("Redirecionando para a Home...")}
          >
            <Text style={styles.buttonTextSucesso}>Começar a Usar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================
  // 📝 TELA DE FORMULÁRIO INICIAL
  // ==========================================
  if (!dadosConfirmados) {
    return (
      <ScrollView contentContainerStyle={styles.containerForm}>
        <Text style={styles.titleForm}>Checkout Premium - R$ 10,00</Text>
        <Text style={styles.subtitleForm}>Insira os dados do titular do cartão:</Text>
        
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

  // ==========================================
  // 💳 RENDEREZA O CHECKOUT BRICK (IFRAME OU WEBVIEW)
  // ==========================================
  const htmlContent = getBrickHtml(inputEmail.trim(), visitorId, inputName.trim(), inputCpf.trim(), deviceId);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finalize o seu Pagamento</Text>
      <Text style={{ textAlign: "center", color: "#666", marginBottom: 10 }}>Comprador: {inputName}</Text>

      {Platform.OS === "web" ? (
        <iframe
          srcDoc={htmlContent}
          style={{ width: "100%", height: "650px", border: "none" }}
          title="Mercado Pago Web"
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ 
            html: htmlContent,
            baseUrl: "https://www.mercadopago.com.br" 
          }}
          style={styles.webview}
          onMessage={onWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          mixedContentMode="always"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  containerForm: { flexGrow: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 20 },
  titleForm: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  subtitleForm: { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 20 },
  input: { width: "100%", maxWidth: 400, height: 50, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: "#007bff", width: "100%", maxWidth: 400, height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  title: { textAlign: "center", fontSize: 20, fontWeight: "600", marginTop: 20, marginBottom: 10 },
  webview: { flex: 1, width: "100%", height: 650 },

  // ESTILOS EXCLUSIVOS DA TELA DE SUCESSO
  containerSucesso: { flex: 1, backgroundColor: "#f4f7f6", justifyContent: "center", alignItems: "center", padding: 20 },
  cardSucesso: { backgroundColor: "#fff", width: "100%", maxWidth: 450, padding: 30, borderRadius: 16, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  iconSucesso: { fontSize: 60, marginBottom: 15 },
  titleSucesso: { fontSize: 24, fontWeight: "bold", color: "#2e7d32", marginBottom: 10, textAlign: "center" },
  subtitleSucesso: { fontSize: 16, fontWeight: "600", color: "#333", textAlign: "center", marginBottom: 12 },
  textSucesso: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 25 },
  buttonSucesso: { backgroundColor: "#2e7d32", width: "100%", height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  buttonTextSucesso: { color: "#fff", fontSize: 16, fontWeight: "bold" }
}); 

