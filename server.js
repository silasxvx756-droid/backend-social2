import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Caso dê erro de pacote, lembre-se que o Node 24+ já tem o globalThis.fetch nativo!

const app = express();

// Configurações Globais de Middleware
app.use(cors());
app.use(express.json());

// Resgata a API Key configurada no painel do Render
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

// Endpoint oficial de produção para parceiros Fiat da NOWPayments
const NOWPAYMENTS_FIAT_URL = "https://api.nowpayments.io/v1/fiat-payment";

// Rota de Teste de Conexão
app.get('/', (req, res) => {
  res.send('🚀 Servidor Web Produção Ativo e Operando (ESM)!');
});

// ====================================================================
// 💳 ROTA PRINCIPAL: RECEBE O CARTÃO DO FRONT-END E ENVIA PARA A API
// ====================================================================
app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email, name, cpf, card, deviceId } = req.body;

    console.log(`[NOWPayments] Nova tentativa de pagamento iniciada para o e-mail: ${email || 'Desconhecido'}`);

    if (!email || !card || !card.number || !card.cvc || !card.expiry) {
      console.log(`[Aviso] Dados incompletos enviados pelo Front-end.`);
      return res.status(400).json({ 
        status: "failed", 
        message: "Dados de cartão ou usuário incompletos no servidor." 
      });
    }

    const expiryParts = card.expiry.split('/');
    if (expiryParts.length !== 2) {
      return res.status(400).json({ status: "failed", message: "Formato de validade do cartão incorreto (use MM/AA)." });
    }
    const expiryMonth = expiryParts[0].trim();
    const expiryYear = "20" + expiryParts[1].trim();

    const payload = {
      fiat_amount: amount || 10.00,
      fiat_currency: currency || "BRL",
      crypto_currency: "usdttrc20",
      customer_email: email.trim(),
      customer_name: name ? name.trim() : "Cliente App",
      customer_document: cpf ? cpf.replace(/\D/g, "") : "",
      card_details: {
        number: card.number.replace(/\s/g, ""),
        cvc: card.cvc.trim(),
        expiration_month: expiryMonth,
        expiration_year: expiryYear
      },
      order_id: `NP-${Date.now()}`,
      metadata: {
        device_id: deviceId || "não-informado"
      }
    };

    console.log(`[NOWPayments] Enviando requisição criptografada para o gateway...`);

    const response = await fetch(NOWPAYMENTS_FIAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data && (data.status === "approved" || data.status === "success" || data.success === true)) {
      console.log(`[Sucesso] Cartão de ${email} APROVADO com sucesso pela rede.`);
      return res.json({ status: "approved", message: "Pagamento processado com sucesso!" });
    } else {
      console.log(`[Recusado] Falha no processamento. Resposta da API:`, JSON.stringify(data));
      return res.status(400).json({ 
        status: "failed", 
        message: data.message || "Cartão recusado. Verifique o saldo, os dados digitados ou o limite mínimo." 
      });
    }

  } catch (error) {
    console.error("[Erro Crítico no Servidor]:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Erro interno no servidor ao tentar estabelecer contato com a Blockchain." 
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Web Produção ativo na porta ${PORT}`);
});