import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Sua chave da Maxelpay configurada diretamente
const MAXELPAY_API_KEY = "pk_live_6IOdLmr1bNgiOQNQtvnEhmvdxVCU9yLv"; 
const MAXELPAY_URL = "https://api.maxelpay.com/v1/checkout"; // Endpoint padrão de checkout

app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { 
      price_amount, 
      price_currency, 
      order_description, 
      customer_name,
      customer_email,
      customer_cpf
    } = req.body;

    // Validação básica no servidor
    if (!price_amount || !customer_email) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados de pagamento ou e-mail incompletos." 
      });
    }

    // Montagem do payload conforme especificações de checkout da Maxelpay
    const payload = {
      amount: Math.round(price_amount * 100), // Geralmente gateways processam centavos (ex: 3000 para R$ 30,00)
      currency: price_currency || "BRL",
      order_id: `MAXEL_${Date.now()}`,
      description: order_description || "Compra App Premium",
      payment_methods: ["credit_card"], // Força o checkout focado em cartão
      customer: {
        name: customer_name,
        email: customer_email,
        document: customer_cpf
      }
    };

    // Envio da requisição autenticada com o Bearer Token do seu pk_live
    const response = await fetch(MAXELPAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MAXELPAY_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro da Maxelpay:", data);
      return res.status(response.status).json({
        success: false,
        message: data.message || "Erro ao gerar o link de pagamento."
      });
    }

    // Retorna a URL de checkout gerada pela Maxelpay
    return res.status(200).json({
      success: true,
      redirectUrl: data.checkout_url || data.url || null 
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Erro interno no servidor de pagamento." 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Maxelpay rodando com sucesso na porta ${PORT}`);
});