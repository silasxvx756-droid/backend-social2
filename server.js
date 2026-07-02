import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

// URL oficial atualizada para conversão transparente de Fiat para Cripto via API
const NOWPAYMENTS_FIAT_URL = "https://api.nowpayments.io/v1/fiat-payment/convert";

app.get('/', (req, res) => {
  res.send('🚀 Servidor Web Produção Ativo e Operando (Checkout Transparente)!');
});

// ====================================================================
// 💳 ROTA TRANSPARENTE: RECEBE O CARTÃO E PROCESSA DIRETO NA API
// ====================================================================
app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email, name, cpf, card, deviceId } = req.body;

    console.log(`[NOWPayments Direct] Iniciando checkout transparente para: ${email}`);

    if (!email || !card || !card.number || !card.cvc || !card.expiry) {
      return res.status(400).json({ 
        status: "failed", 
        message: "Dados de cartão ou usuário incompletos." 
      });
    }

    // Processa a validade vinda do formato MM/AA
    const expiryParts = card.expiry.split('/');
    if (expiryParts.length !== 2) {
      return res.status(400).json({ status: "failed", message: "Formato de validade incorreto (MM/AA)." });
    }
    const expiryMonth = expiryParts[0].trim();
    const expiryYear = "20" + expiryParts[1].trim();

    // Payload estruturado para a API de conversão fiat-to-crypto direta
    const payload = {
      fiat_amount: amount || 30.00, // Lembrando do limite mínimo exigido pelos provedores fiat deles
      fiat_currency: (currency || "BRL").toLowerCase(),
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
      order_id: `NP-DIR-${Date.now()}`,
      metadata: { device_id: deviceId || "não-informado" }
    };

    console.log(`[NOWPayments Direct] Enviando dados do cartão de forma segura...`);

    const response = await fetch(NOWPAYMENTS_FIAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Valida o retorno de aprovação direta da transação
    if (data && (data.status === "approved" || data.status === "success" || data.success === true)) {
      console.log(`[Sucesso] Cartão de ${email} APROVADO!`);
      return res.json({ status: "approved", message: "Pagamento processado com sucesso!" });
    } else {
      console.log(`[Recusado Direct] Resposta da API:`, JSON.stringify(data));
      return res.status(400).json({ 
        status: "failed", 
        message: data.message || "Cartão recusado. Verifique os dados, o saldo ou o valor mínimo." 
      });
    }

  } catch (error) {
    console.error("[Erro Crítico Direct]:", error.message);
    return res.status(500).json({ status: "error", message: "Erro interno ao processar o cartão." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ativo na porta ${PORT}`);
});