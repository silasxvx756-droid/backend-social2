import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PLISIO_API_KEY = process.env.PLISIO_API_KEY;
const PLISIO_URL = "https://plisio.net/api/v1/invoices/new";

app.get('/', (req, res) => {
  res.send('🚀 Servidor Ativo - Integrado com Plisio!');
});

// Mantendo o mesmo endpoint esperado pelo seu aplicativo front-end
app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email } = req.body;
    console.log(`[Plisio] Criando fatura estável para o cliente: ${email}`);

    if (!email) {
      return res.status(400).json({ status: "failed", message: "E-mail é obrigatório." });
    }

    // Parâmetros oficiais exigidos pela API do Plisio
    const params = new URLSearchParams({
      api_key: PLISIO_API_KEY,
      source_amount: amount || "30.00",
      source_currency: (currency || "BRL").toUpperCase(),
      currency: "USDT", // Moeda padrão de recebimento cripto
      order_number: `PLIS-${Date.now()}`,
      order_name: "Assinatura Procurojob Premium",
      email: email.trim(),
      callback_url: "https://backend-social22.onrender.com/plisio-webhook",
      success_url: "https://backend-social22.onrender.com/sucesso",
      cancel_url: "https://backend-social22.onrender.com/cancelado"
    });

    const response = await fetch(`${PLISIO_URL}?${params.toString()}`, {
      method: "GET"
    });

    const data = await response.json();

    if (data && data.status === "success" && data.data?.invoice_url) {
      console.log(`[Sucesso Plisio] Link de pagamento gerado com sucesso.`);
      return res.json({ status: "redirect", redirectUrl: data.data.invoice_url });
    } else {
      console.log(`[Falha API Plisio]:`, JSON.stringify(data));
      return res.status(400).json({ status: "failed", message: data.data?.message || "Erro ao criar fatura no Plisio." });
    }
  } catch (error) {
    console.error("[Erro Crítico Plisio]:", error.message);
    return res.status(500).json({ status: "error", message: "Erro interno no servidor do Plisio." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));