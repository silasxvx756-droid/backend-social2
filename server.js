const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Sua chave Live da MaxelPay
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv";
const MAXELPAY_URL = "https://api.maxelpay.com/v1"; // Endpoint padrão da API v1 MaxelPay

/**
 * 1. ROTA PARA CRIAR O CHECKOUT / PAGAMENTO
 */
app.post("/create-card-payment", async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      order_description,
      customer_name,
      customer_email,
      customer_cpf
    } = req.body;

    const internalOrderId = "ORD-" + Date.now();

    // Estrutura de requisição adaptada para os campos da MaxelPay
    const response = await fetch(`${MAXELPAY_URL}/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(price_amount * 100), // MaxelPay (assim como a maioria dos gateways) costuma receber valores em centavos (Ex: 30.00 vira 3000)
        currency: price_currency || "BRL",
        description: order_description || "Compra Acesso Premium",
        order_id: internalOrderId,
        payment_methods: ["credit_card"], // Força o método para cartão conforme seu app pede
        customer: {
          name: customer_name,
          email: customer_email,
          document: {
            type: "CPF",
            number: customer_cpf.replace(/\D/g, "") // Remove pontos e traços do CPF deixando apenas números
          }
        },
        // URLs para onde o cliente vai após pagar ou cancelar no checkout deles
        redirect_url: "https://backend-social22.onrender.com/payment-callback", 
        review_url: "https://backend-social22.onrender.com/payment-callback"
      }),
    });

    const data = await response.json();

    // Se a MaxelPay retornar a URL de checkout com sucesso
    if (response.ok && (data.checkout_url || data.url || data.id)) {
      return res.status(200).json({
        success: true,
        // Captura o link que redirecionará o cliente para a tela de pagamento segura deles
        checkoutUrl: data.checkout_url || data.url,
        orderId: data.id || internalOrderId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: data.message || "Erro ao gerar checkout na MaxelPay.",
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

    const response = await fetch(`${MAXELPAY_URL}/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
      },
    });

    const data = await response.json();

    // Na MaxelPay os status de sucesso costumam ser 'paid', 'approved' ou 'completed'
    const isPaid = response.ok && (data.status === "paid" || data.status === "approved" || data.status === "completed");

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
  console.log(`Servidor MaxelPay ativo na porta ${PORT}`);
});