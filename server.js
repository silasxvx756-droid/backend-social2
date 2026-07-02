require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Suporte para fetch no Node.js (necessário para versões antigas do Node)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Configurações Globais de Middleware
app.use(cors());
app.use(express.json());

// Resgata a API Key configurada no painel do Render
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

// Endpoint oficial de produção para parceiros Fiat da NOWPayments
const NOWPAYMENTS_FIAT_URL = "https://api.nowpayments.io/v1/fiat-payment";

// Rota de Teste de Conexão (Apenas para checar se o servidor está online)
app.get('/', (req, res) => {
  res.send('🚀 Servidor Web Produção Ativo e Operando!');
});

// ====================================================================
// 💳 ROTA PRINCIPAL: RECEBE O CARTÃO DO FRONT-END E ENVIA PARA A API
// ====================================================================
app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { amount, currency, email, name, cpf, card, deviceId } = req.body;

    // 1. Log inicial para monitoramento direto no painel do Render
    console.log(`[NOWPayments] Nova tentativa de pagamento iniciada para o e-mail: ${email || 'Desconhecido'}`);

    // 2. Validação interna de segurança (evita requisições quebradas)
    if (!email || !card || !card.number || !card.cvc || !card.expiry) {
      console.log(`[Aviso] Dados incompletos enviados pelo Front-end.`);
      return res.status(400).json({ 
        status: "failed", 
        message: "Dados de cartão ou usuário incompletos no servidor." 
      });
    }

    // 3. Trata e quebra a string de validade ("MM/AA") vinda do React Native
    const expiryParts = card.expiry.split('/');
    if (expiryParts.length !== 2) {
      return res.status(400).json({ status: "failed", message: "Formato de validade do cartão incorreto (use MM/AA)." });
    }
    const expiryMonth = expiryParts[0].trim();
    const expiryYear = "20" + expiryParts[1].trim(); // Transforma "28" em "2028"

    // 4. Monta o Payload exato exigido pelo gateway da NOWPayments
    const payload = {
      fiat_amount: amount || 10.00,
      fiat_currency: currency || "BRL",
      crypto_currency: "usdttrc20", // Moeda líquida estável que você receberá na sua carteira cripto
      customer_email: email.trim(),
      customer_name: name ? name.trim() : "Cliente App",
      customer_document: cpf ? cpf.replace(/\D/g, "") : "", // Remove traços e pontos do CPF
      card_details: {
        number: card.number.replace(/\s/g, ""), // Remove espaços do número do cartão
        cvc: card.cvc.trim(),
        expiration_month: expiryMonth,
        expiration_year: expiryYear
      },
      order_id: `NP-${Date.now()}`,
      metadata: {
        device_id: deviceId || "não-informado"
      }
    };

    console.log(`[NOWPayments] Enviando requisição criptografada para o gateway da NOWPayments...`);

    // 5. Executa a chamada HTTP autenticada com a sua API Key do Render
    const response = await fetch(NOWPAYMENTS_FIAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 6. Analisa a resposta da NOWPayments e responde ao React Native
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

// Configuração da Porta de Escuta (O Render utiliza a variável process.env.PORT)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Web Produção ativo na porta ${PORT}`);
});