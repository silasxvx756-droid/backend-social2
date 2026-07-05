import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Suas credenciais Live da MaxelPay
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv";
// Endpoint central unificado da API MaxelPay
const MAXELPAY_URL = "https://api.maxelpay.com/v1/payload"; 

/**
 * 1. ROTA PARA CRIAR O PEDIDO DE PAGAMENTO
 */
app.post("/create-card-payment", async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      customer_name,
      customer_email
    } = req.body;

    const internalOrderId = "ORD" + Date.now();

    // Monta a estrutura exata exigida pelo Gateway unificado da MaxelPay
    const response = await fetch(MAXELPAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderID: internalOrderId,
        amount: String(price_amount), // Alguns SDKs pedem String, outros número puro
        currency: price_currency || "BRL",
        timestamp: Math.floor(Date.now() / 1000),
        userName: customer_name,
        userEmail: customer_email,
        siteName: "Meu App Social", // Altere para o nome da sua plataforma se desejar
      }),
    });

    const data = await response.json();
    console.log("Resposta exata da MaxelPay:", data); // Acompanhe em tempo real no Render

    // Se a MaxelPay devolver o link de checkout (normalmente sob a chave url, checkout_url ou payment_url)
    if (response.ok && (data.url || data.checkout_url || data.payment_url || data.success !== false)) {
      return res.status(200).json({
        success: true,
        checkoutUrl: data.url || data.checkout_url || data.payment_url || data.redirect_url,
        orderId: data.orderID || internalOrderId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: data.message || "Erro retornado pela MaxelPay.",
      });
    }

  } catch (error) {
    console.error("Erro MaxelPay:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar com a MaxelPay.",
    });
  }
});

/**
 * 2. ROTA PARA VERIFICAR STATUS DA TRANSAÇÃO
 */
app.get("/payment-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    // Consulta simplificada para verificar o status
    const response = await fetch(`https://api.maxelpay.com/v1/status/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
      },
    });

    const data = await response.json();

    const isPaid = response.ok && (data.status === "paid" || data.status === "approved" || data.status === "success");

    return res.status(200).json({
      paid: isPaid,
      status: data.status || "pending"
    });

  } catch (error) {
    console.error("Erro ao checar status na MaxelPay:", error);
    return res.status(500).json({
      paid: false,
      message: "Erro ao consultar transação."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor MaxelPay ativo rodando na porta ${PORT}`);
});