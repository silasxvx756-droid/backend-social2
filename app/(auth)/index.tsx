import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";

// 1. FUNÇÃO DO HTML: Recebe o e-mail digitado pelo cliente de forma real
const getBrickHtml = (email, userId) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <script>
    window.USER_DATA = {
      email: ${JSON.stringify(email)},
      userId: ${JSON.stringify(userId)}
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
            amount: 10,
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              pix: "all"
            }
          },
          callbacks: {
            onReady: () => {
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "READY" }));
              // Suporte para o iframe web puro
              if(window.parent) window.parent.postMessage(JSON.stringify({ type: "READY" }), "*");
            },
            onError: (err) => {
              const errMsg = err?.message || "Erro interno do Brick";
              window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ERROR", message: errMsg }));
              if(window.parent) window.parent.postMessage(JSON.stringify({ type: "ERROR", message: errMsg }), "*");
            },
            onSubmit: async (cardFormData) => {
              try {
                const res = await fetch(
                  "https://backend-social22.onrender.com/card-payment",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      token: cardFormData.token,
                      payment_method_id: cardFormData.payment_method_id,
                      transaction_amount: 10,
                      installments: cardFormData.installments,
                      email: window.USER_DATA.email, 
                      userId: window.USER_DATA.userId 
                    })
                  }
                );

                const data = await res.json();
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "RESULT", data }));
                if(window.parent) window.parent.postMessage(JSON.stringify({ type: "RESULT", data }), "*");

              } catch (err) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ERROR", message: err.message }));
                if(window.parent) window.parent.postMessage(JSON.stringify({ type: "ERROR", message: err.message }), "*");
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
  const [emailConfirmado, setEmailConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState("");

  // Geramos um ID de visitante único para o banco de dados (ex: VISITOR-1718956...)
  const [visitorId] = useState(`VISITOR-${Date.now()}`);

  const iniciarCheckout = () => {
    if (!inputEmail.includes("@") || !inputEmail.includes(".")) {
      alert("Por favor, insira um e-mail válido para receber o comprovante.");
      return;
    }
    setEmailConfirmado(true);
    setLoading(true);
  };

  // Se o e-mail ainda não foi preenchido, pede o e-mail (necessário para o Mercado Pago aceitar o pagamento real)
  if (!emailConfirmado) {
    return (
      <View style={styles.containerForm}>
        <Text style={styles.titleForm}>Checkout Premium - R$ 10</Text>
        <Text style={styles.subtitleForm}>Insira seu e-mail para prosseguir com o pagamento:</Text>
        
        <TextInput
          style={styles.input}
          placeholder="seu-email@provedor.com"
          value={inputEmail}
          onChangeText={setInputEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={iniciarCheckout}>
          <Text style={styles.buttonText}>Ir para o Pagamento</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const brickHtml = getBrickHtml(inputEmail.trim(), visitorId);

  // Exibição pura para Web (iframe)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finalize o seu Pagamento</Text>
      <Text style={{ textAlign: "center", color: "#666" }}>Enviando comprovante para: {inputEmail}</Text>

      <iframe
        srcDoc={brickHtml}
        style={{ width: "100%", height: "600px", border: "none", marginTop: 20 }}
        title="Mercado Pago Brick"
      />

      {!!paymentStatus && (
        <Text style={styles.status}>Status do Pagamento: {paymentStatus}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20
  },
  containerForm: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  titleForm: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10
  },
  subtitleForm: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 20
  },
  input: {
    width: "100%",
    maxWidth: 400,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16
  },
  button: {
    backgroundColor: "#007bff",
    width: "100%",
    maxWidth: 400,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20
  },
  status: {
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
    fontSize: 16
  }
});