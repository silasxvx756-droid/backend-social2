import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Dimensions, ActivityIndicator } from "react-native";
import * as Application from 'expo-application';

let WebView;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

// FUNÇÃO DO HTML: Tratamento seguro de strings para evitar quebras de sintaxe no JS injetado
const escapeJsString = (str) => JSON.stringify(str || "").replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

const getBrickHtml = (email, visitorId, name, cpf, deviceId, userId) => `
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
    [data-testid*="caixa"], [class*="caixa"], [id*="caixa"], [value*="debcaixa"] {
      display: none !important;
    }
  </style>
  
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <script src="https://www.mercadopago.com/v2/security.js" view="checkout" output="MP_DEVICE_SESSION_ID"></script>

  <script>
    window.USER_DATA = {
      email: ${escapeJsString(email)},
      visitorId: ${escapeJsString(visitorId)},
      name: ${escapeJsString(name)},
      cpf: ${escapeJsString(cpf)},
      deviceId: ${escapeJsString(deviceId)},
      userId: ${escapeJsString(userId)}
    };
  </script>
</head>
<body>
  <div id="brick_container"></div>

  <script>
    window.addEventListener("load", async () => {
      try {
        // ATUALIZADO: Usando a chave pública correta que resolve o erro de inicialização
        const mp = new MercadoPago("APP_USR-2d9a0675-0795-4f0b-ae9d-256fff73054e");
        const bricksBuilder = mp.bricks();

        await bricksBuilder.create("payment", "brick_container", {
          initialization: {
            amount: 10, 
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

                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PROCESSING" }));
                }

                const res = await fetch(
                  "https://backend-social22.onrender.com/card-payment",
                  {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      "X-Idempotency-Key": "REQ-" + window.USER_DATA.visitorId
                    },
                    body: JSON.stringify({
                      token: token,
                      payment_method_id: payment_method_id,
                      transaction_amount: 10,
                      installments: Number(installments),
                      email: window.USER_DATA.email, 
                      userId: window.USER_DATA.userId, 
                      name: window.USER_DATA.name,
                      cpf: window.USER_DATA.cpf,
                      deviceId: finalDeviceId
                    })
                  }
                );

                if (!res.ok) throw new Error("Falha na comunicação com o servidor.");

                const data = await res.json();
                
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: "RESULT", status: data.mercadoPago?.status }));
                } else {
                  if (data.mercadoPago?.status === "approved") {
                    alert("Pagamento Aprovado!");
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
  
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'approved' | 'in_process' | 'rejected'>('idle');
  const [visitorId, setVisitorId] = useState(`VISITOR-${Date.now()}`);
  
  const ID_DO_USUARIO_LOGADO = "654321_ID_PROCUROJOB_MONGO"; 
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
    setLoading(true); // Evita tela em branco na transição para a WebView
    setDadosConfirmados(true);
  };

  const handlePayAgain = () => {
    setPaymentStatus('idle');
    setLoading(false);
    setDadosConfirmados(false);
    setVisitorId(`VISITOR-${Date.now()}`); 
  };

  const onWebViewMessage = (event) => {
    try {
      const response = JSON.parse(event.nativeEvent.data);
      
      if (response.type === "READY") {
        setLoading(false);
      } else if (response.type === "PROCESSING") {
        setLoading(true);
      } else if (response.type === "RESULT") {
        setLoading(false);
        if (response.status === "approved") {
          setPaymentStatus('approved');
        } else if (response.status === "in_process") {
          setPaymentStatus('in_process');
        } else {
          setPaymentStatus('rejected');
        }
      } else if (response.type === "ERROR") {
        setLoading(false);
        alert(`Erro no pagamento: ${response.message}`);
      }
    } catch (e) {
      console.log("Erro ao decodificar mensagem da WebView:", e);
    }
  };

  if (paymentStatus === 'approved') {
    return (
      <View style={styles.containerSucesso}>
        <View style={styles.cardSucesso}>
          <Text style={styles.iconSucesso}>🎉</Text>
          <Text style={styles.titleSucesso}>Pagamento Aprovado!</Text>
          <Text style={styles.subtitleSucesso}>
            Parabéns, {inputName.split(" ")[0]}! Seu plano Premium já está ativo.
          </Text>
          <Text style={styles.textSucesso}>
            Agora você tem acesso total a todas as vagas e recursos exclusivos da plataforma.
          </Text>
          <TouchableOpacity style={styles.buttonSucesso} onPress={() => alert("Redirecionando para a Home...")}>
            <Text style={styles.buttonTextSucesso}>Começar a Usar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (paymentStatus === 'in_process') {
    return (
      <View style={[styles.containerSucesso, { backgroundColor: '#fff9f2' }]}>
        <View style={styles.cardSucesso}>
          <Text style={[styles.iconSucesso, { fontSize: 50 }]}>⏳</Text>
          <Text style={[styles.titleSucesso, { color: '#e67e22' }]}>Pagamento em Análise</Text>
          <Text style={styles.textSucesso}>
            O Mercado Pago está revisando os dados de segurança da sua transação. Não se preocupe, te avisaremos em minutos assim que concluir!
          </Text>
          <TouchableOpacity style={[styles.buttonSucesso, { backgroundColor: '#e67e22' }]} onPress={() => alert("Voltando para o app...")}>
            <Text style={styles.buttonTextSucesso}>Voltar para o App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (paymentStatus === 'rejected') {
    return (
      <View style={[styles.containerSucesso, { backgroundColor: '#fdf2f2' }]}>
        <View style={styles.cardSucesso}>
          <Text style={styles.iconSucesso}>❌</Text>
          <Text style={[styles.titleSucesso, { color: '#c0392b' }]}>Pagamento Recusado</Text>
          <Text style={styles.textSucesso}>
            Não foi possível aprovar a transação. Verifique se o cartão possui limite disponível, dados corretos ou tente usando o Pix.
          </Text>
          <TouchableOpacity style={[styles.buttonSucesso, { backgroundColor: '#c0392b' }]} onPress={handlePayAgain}>
            <Text style={styles.buttonTextSucesso}>Tentar com Outro Cartão</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  const htmlContent = getBrickHtml(inputEmail.trim(), visitorId, inputName.trim(), inputCpf.trim(), deviceId, ID_DO_USUARIO_LOGADO);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={{ marginTop: 10, color: '#007bff', fontWeight: 'bold' }}>Processando... Não feche o app</Text>
        </View>
      )}
      
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
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },

  containerSucesso: { flex: 1, backgroundColor: "#f4f7f6", justifyContent: "center", alignItems: "center", padding: 20 },
  cardSucesso: { backgroundColor: "#fff", width: "100%", maxWidth: 450, padding: 30, borderRadius: 16, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  iconSucesso: { fontSize: 60, marginBottom: 15 },
  titleSucesso: { fontSize: 24, fontWeight: "bold", color: "#2e7d32", marginBottom: 10, textAlign: "center" },
  subtitleSucesso: { fontSize: 16, fontWeight: "600", color: "#333", textAlign: "center", marginBottom: 12 },
  textSucesso: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 25 },
  buttonSucesso: { backgroundColor: "#2e7d32", width: "100%", height: 50, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  buttonTextSucesso: { color: "#fff", fontSize: 16, fontWeight: "bold" }
});