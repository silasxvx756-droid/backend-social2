const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Sua chave da NOWPayments configurada diretamente
const NOWPAYMENTS_API_KEY = "30MQ4ER-8JT4Z0J-KWXPFJ4-N7EMQ02"; 
const NOWPAYMENTS_URL = "https://api.nowpayments.io/v1/payment"; 

app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { 
      price_amount, 
      price_currency, 
      order_description, 
      customer_name, 
      customer_email, 
      customer_cpf,
      payment_data 
    } = req.body;

    // 1. Validação básica no servidor
    if (!payment_data || !payment_data.card_number || !customer_email) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados de pagamento incompletos." 
      });
    }

    // 2. Monta o payload conforme exigido pela NOWPayments
    const payload = {
      price_amount: price_amount,
      price_currency: price_currency || "brl",
      pay_currency: "usd", // Conversão e liquidação padrão
      order_id: `ORDER_${Date.now()}`,
      order_description: order_description || "Compra App",
      customer_email: customer_email,
      payment_data: {
        card_number: payment_data.card_number,
        expiry_month: payment_data.expiry_month,
        expiry_year: payment_data.expiry_year,
        cvc: payment_data.cvc,
        holder_name: payment_data.holder_name
      }
    };

    // 3. Envia a requisição autenticada com a sua API Key
    const response = await fetch(NOWPAYMENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro da NOWPayments:", data);
      return res.status(response.status).json({
        success: false,
        message: data.message || "Erro ao processar com a operadora do cartão."
      });
    }

    // 4. Retorna a resposta para o React Native mapeando o 3DS corretamente
    return res.status(200).json({
      success: true,
      status: data.payment_status,
      payment_id: data.payment_id,
      redirectUrl: data.redirect_url || data.checkout_url || null,
      "3ds_url": data['3ds_url'] || null
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
  console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});