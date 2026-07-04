import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Sua chave da NOWPayments configurada diretamente
const NOWPAYMENTS_API_KEY = "30MQ4ER-8JT4Z0J-KWXPFJ4-N7EMQ02"; 
const NOWPAYMENTS_URL = "https://api.nowpayments.io/v1/invoice"; 

app.post('/process-nowpayments-card', async (req, res) => {
  try {
    const { 
      price_amount, 
      price_currency, 
      order_description, 
      customer_email 
    } = req.body;

    // 1. Validação básica no servidor
    if (!price_amount || !customer_email) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados de pagamento ou e-mail incompletos." 
      });
    }

    // 2. CORREÇÃO: Mantemos o valor em BRL, mas NÃO forçamos o recebimento em FIAT.
    // Deixamos a NOWPayments converter os R$ 30,00 para as criptos que sua conta aceita.
    const payload = {
      price_amount: price_amount,        // Ex: 30.00
      price_currency: price_currency || "brl", // Moeda de preço original (Real)
      order_id: `ORDER_${Date.now()}`,
      order_description: order_description || "Compra App Premium"
      // Removemos 'pay_currency: "usd"' porque causava o bloqueio de Fiat na sua conta.
    };

    // 3. Envia a requisição autenticada
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
        message: data.message || "Erro ao gerar a ordem de pagamento."
      });
    }

    // 4. Retorna a URL do checkout para a WebView do React Native abrir
    return res.status(200).json({
      success: true,
      redirectUrl: data.invoice_url || null 
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