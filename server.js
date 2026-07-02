import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Certifique-se de configurar a sua chave do Paymento no painel do Render
const PAYMENTO_API_KEY = process.env.PAYMENTO_API_KEY;
const PAYMENTO_URL = "https://api.paymento.io/v1/payments";

app.get('/', (req, res) => {
  res.send('🚀 Servidor Online - Integrado com Paymento.io!');
});

// Rota interceptora mantendo o mesmo nome esperado pelo seu app
app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email, card } = req.body;

    console.log(`[Paymento.io] Iniciando requisição direta de transação para: ${email}`);

    if (!email) {
      return res.status(400).json({ status: "failed", message: "O e-mail é obrigatório." });
    }

    // Estruturação do Payload oficial do Paymento.io
    const payload = {
      amount: amount || 30.00,
      currency: (currency || "BRL").toUpperCase(),
      customer_email: email.trim(),
      order_id: `PAYM-${Date.now()}`,
      payment_method: "crypto",
      // Passamos os metadados do cartão simulado apenas para fins de registro e conformidade de logs no painel
      metadata: {
        last_four: card?.number ? card.number.slice(-4) : "0000",
        expiry: card?.expiry || "00/00"
      }
    };

    const response = await fetch(PAYMENTO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAYMENTO_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Validando retorno de sucesso padrão da API deles
    if (response.ok && (data.status === "pending" || data.status === "success" || data.id)) {
      console.log(`[Sucesso Paymento] Cobrança inicializada com ID: ${data.id}`);
      return res.json({ 
        status: "success", 
        message: "Cobrança gerada com sucesso!" 
      });
    } else {
      console.log(`[Erro API Paymento]:`, JSON.stringify(data));
      return res.status(400).json({ 
        status: "failed", 
        message: data.message || "Falha na comunicação direta com os nós da blockchain." 
      });
    }

  } catch (error) {
    console.error("[Erro Crítico Paymento]:", error.message);
    return res.status(500).json({ status: "error", message: "Erro interno no servidor." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));