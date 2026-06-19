import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useUser } from "@clerk/clerk-expo";

export default function PaymentScreen() {
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState("");

  const email = user?.primaryEmailAddress?.emailAddress;

  const brickHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>

<body>
  <div id="brick_container"></div>

  <script>
    const mp = new MercadoPago("SUA_PUBLIC_KEY_AQUI");

    const bricksBuilder = mp.bricks();

    const renderBrick = async () => {
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
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "READY"
            }));
          },

          onSubmit: async (cardFormData) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "LOADING"
            }));

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
                    email: "${email}",
                    userId: "${user?.id}"
                  })
                }
              );

              const data = await res.json();

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "RESULT",
                data
              }));

            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "ERROR",
                message: err.message
              }));
            }
          }
        }
      });
    };

    renderBrick();
  </script>
</body>
</html>
`;

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "READY") {
        setLoading(false);
      }

      if (msg.type === "LOADING") {
        setLoading(true);
      }

      if (msg.type === "RESULT") {
        setLoading(false);

        const status = msg?.data?.mercadoPago?.status;

        setPaymentStatus(status);

        if (status === "approved") {
          alert("Pagamento aprovado ✔");
        } else if (status === "pending") {
          alert("Pagamento em análise ⏳");
        } else {
          alert("Pagamento recusado ❌");
        }
      }

      if (msg.type === "ERROR") {
        setLoading(false);
        alert("Erro no pagamento: " + msg.message);
      }

    } catch (e) {
      console.log(e);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Checkout Premium - R$ 10</Text>

      {loading && (
        <ActivityIndicator size="large" style={{ margin: 10 }} />
      )}

      <WebView
        originWhitelist={["*"]}
        source={{ html: brickHtml }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        style={{ flex: 1 }}
      />

      {!!paymentStatus && (
        <Text style={styles.status}>
          Status: {paymentStatus}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10
  },
  status: {
    textAlign: "center",
    marginBottom: 10,
    color: "#666"
  }
});