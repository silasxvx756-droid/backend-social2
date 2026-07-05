import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Sua chave Live da MaxelPay
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv";

// Ajuste da URL Base: Geralmente gateways usam o padrão sem a versão na raiz ou endpoints focados em checkouts/transactions
const MAXELPAY_URL = "https://api.maxelpay.com/v1"; 

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

    // NOTA: Se '/orders' deu "Route not found", alteramos para o padrão '/checkouts' ou '/transactions'
    // que são os nomes oficiais de rotas para geração de link de pagamento em plataformas deste modelo.
    const response = await fetch(`${MAXELPAY_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(price_amount * 100), // Valor em centavos (Ex: 3000)
        currency: price_currency || "BRL",
        description: order_description || "Compra Acesso Premium",
        order_id: internalOrderId,
        payment_methods: ["credit_card"],
        customer: {
          name: customer_name,
          email: customer_email,
          document: {
            type: "CPF",
            number: customer_cpf.replace(/\D/g, "")
          }
        },
        redirect_url: "https://backend-social22.onrender.com/payment-callback", 
        review_url: "https://backend-social22.onrender.com/payment-callback"
      }),
    });

    const data = await response.json();
    console.log("Resposta exata da MaxelPay:", data); 

    if (response.ok && (data.checkout_url || data.url || data.id || data.payment_url)) {
      return res.status(200).json({
        success: true,
        checkoutUrl: data.checkout_url || data.url || data.payment_url,
        orderId: data.id || data.checkout_id || internalOrderId,
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

    // Ajustado para consultar a rota de checkouts correspondente
    const response = await fetch(`${MAXELPAY_URL}/checkouts/${orderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
      },
    });

    const data = await response.json();

    const isPaid = response.ok && (data.status === "paid" || data.status === "approved" || data.status === "completed" || data.status === "paid_out");

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