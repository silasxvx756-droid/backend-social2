const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// SUA API KEY CONFIGURADA
const NOWPAYMENTS_API_KEY = "GCTC3QV-83MM1E7-JVF7QBM-H150X8X"; 

app.post('/nowpayments.io', async (req, res) => {
  try {
    const { amount, email, name } = req.body;

    if (!amount || !email) {
      return res.status(400).json({ success: false, message: "Dados incompletos." });
    }

    // Configuração do Webhook e Retornos com seu domínio
    const paymentData = {
      price_amount: amount,
      price_currency: "BRL",
      ipn_callback_url: "https://backend-social22.onrender.com/nowpayments-webhook",
      order_id: `ORDER-${Date.now()}`,
      order_description: `Plano Premium - ${name || email}`,
      success_url: "https://checkinpremium.com/sucesso",
      cancel_url: "https://checkinpremium.com/cancelado"
    };

    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();

    if (data && data.invoice_url) {
      return res.json({
        success: true,
        redirectUrl: data.invoice_url
      });
    } else {
      return res.status(500).json({ success: false, message: "Erro ao criar fatura na NowPayments." });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Rota para receber a confirmação do pagamento
app.post('/nowpayments-webhook', (req, res) => {
  console.log("Notificação recebida da NowPayments:", req.body);
  // Aqui você adicionaria a lógica para liberar o acesso ao Premium no seu banco
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));