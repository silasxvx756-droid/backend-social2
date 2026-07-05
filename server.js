import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Sua chave Live fornecida
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv";

// Endpoint para processamento direto (Gateway Transparente de Cartão de Crédito)
const MAXELPAY_TRANSACTION_URL = "https://api.maxelpay.com/v1/transactions"; 

app.post("/create-card-payment", async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      customer_name,
      customer_email,
      customer_cpf,
      card // Dados do cartão vindos do front-end
    } = req.body;

    const internalOrderId = "ORD" + Date.now();

    // Envia a cobrança direta para a API da MaxelPay
    const response = await fetch(MAXELPAY_TRANSACTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(price_amount * 100), // Envia em centavos (Ex: 3000)
        currency: price_currency || "BRL",
        description: "Acesso Premium - Transação Direta",
        order_id: internalOrderId,
        payment_method: "credit_card",
        capture: true, // Captura o valor imediatamente
        customer: {
          name: customer_name,
          email: customer_email,
          document: {
            type: "CPF",
            number: customer_cpf.replace(/\D/g, "") // Limpa pontuação do CPF
          }
        },
        card: {
          number: card.number,
          holder_name: card.holder_name,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          cvv: card.cvv
        }
      }),
    });

    const data = await response.json();
    console.log("Resposta do processamento direto MaxelPay:", data);

    // Se o status retornado for aprovado ou pago ('paid', 'approved', 'succeeded')
    if (response.ok && (data.status === "paid" || data.status === "approved" || data.status === "succeeded" || data.success === true)) {
      return res.status(200).json({
        success: true,
        message: "Pagamento aprovado!",
        transactionId: data.id || internalOrderId
      });
    } else {
      // Se o cartão for recusado ou der erro de validação
      return res.status(400).json({
        success: false,
        message: data.message || "Cartão recusado pela operadora ou dados incorretos.",
      });
    }

  } catch (error) {
    console.error("Erro no processamento direto:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno no servidor ao processar o cartão.",
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de Gateway Direto ativo na porta ${PORT}`);
});