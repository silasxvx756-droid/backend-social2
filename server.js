import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Sua chave Live fornecida (pk_live_...)
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv";

// Endpoint oficial correto da MaxelPay para gerar links de cobrança/faturas
const MAXELPAY_URL = "https://api.maxelpay.com/v1/invoice"; 

/**
 * 1. ROTA PARA CRIAR O LINK DE PAGAMENTO (INVOICE)
 */
app.post("/create-card-payment", async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      customer_name,
      customer_email
    } = req.body;

    // ID interno da transação baseado no timestamp atual
    const internalOrderId = "ORD" + Date.now();

    // Monta a estrutura exata exigida pelo Gateway da MaxelPay
    const response = await fetch(MAXELPAY_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": MAXELPAY_API_KEY, // Padrão de cabeçalho obrigatório da MaxelPay
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderID: internalOrderId,
        amount: String(price_amount),       // Valor enviado em formato String (Ex: "30.00")
        currency: price_currency || "BRL",  // Moeda da cobrança
        timestamp: Math.floor(Date.now() / 1000),
        userName: customer_name,
        userEmail: customer_email,
        siteName: "Acesso Premium",         // Identificador do seu produto/site
      }),
    });

    const data = await response.json();
    console.log("Resposta exata da MaxelPay:", data); // Monitore o retorno real no painel do Render

    // Se a API retornar sucesso ou disponibilizar as chaves de redirecionamento correspondentes
    if (response.ok && (data.url || data.checkout_url || data.success !== false)) {
      return res.status(200).json({
        success: true,
        // A MaxelPay geralmente retorna o link na propriedade 'url' ou 'checkout_url'
        checkoutUrl: data.url || data.checkout_url || data.payment_url,
        orderId: data.orderID || internalOrderId,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: data.message || "Erro retornado pela API da MaxelPay.",
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

    // Rota padrão para consulta individual de faturas na MaxelPay
    const response = await fetch(`https://api.maxelpay.com/v1/invoice/${orderId}`, {
      method: "GET",
      headers: {
        "X-API-KEY": MAXELPAY_API_KEY,
      },
    });

    const data = await response.json();

    // Status mapeados de sucesso: 'paid', 'approved' ou 'success'
    const isPaid = response.ok && (data.status === "paid" || data.status === "approved" || data.status === "success" || data.success === true);

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