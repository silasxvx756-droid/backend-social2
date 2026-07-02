import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_URL = "https://api.nowpayments.io/v1/invoice";

app.get('/', (req, res) => {
  res.send('🚀 Servidor Ativo - Fluxo Híbrido Protegido!');
});

app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email } = req.body;
    console.log(`[NOWPayments] Criando faturamento seguro para: ${email}`);

    if (!email) {
      return res.status(400).json({ status: "failed", message: "E-mail é obrigatório." });
    }

    const payload = {
      price_amount: amount || 30.00, // Mantido 30 pelo limite mínimo fiat
      price_currency: (currency || "BRL").toLowerCase(),
      pay_currency: "usdttrc20",
      order_id: `NP-${Date.now()}`,
      order_description: "Assinatura Procurojob Premium",
      customer_email: email.trim(),
      success_url: "https://backend-social22.onrender.com/sucesso",
      cancel_url: "https://backend-social22.onrender.com/cancelado"
    };

    const response = await fetch(NOWPAYMENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data && data.invoice_url) {
      console.log(`[Sucesso] Link seguro de pagamento gerado.`);
      return res.json({ status: "redirect", redirectUrl: data.invoice_url });
    } else {
      console.log(`[Falha API]:`, JSON.stringify(data));
      return res.status(400).json({ status: "failed", message: data.message || "Erro no gateway." });
    }
  } catch (error) {
    console.error("[Erro]:", error.message);
    return res.status(500).json({ status: "error", message: "Erro interno no servidor." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));