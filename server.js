const express = require('express');
const axios = require('axios');
const app = express();

// Middleware para processar JSON
app.use(express.json());

// CONFIGURAÇÃO: Coloque sua API KEY da NOWPayments aqui
// Recomendado: Use variáveis de ambiente (process.env.API_KEY)
const NOWPAYMENTS_API_KEY = 'GCTC3QV-83MM1E7-JVF7QBM-H150X8X'; 

app.post('/process-nowpayments-card', async (req, res) => {
    const { name, email, cpf } = req.body;

    // Validação básica no servidor
    if (!email || !name) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    try {
        // Chamada oficial para a API da NOWPayments para criar uma Invoice
        const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
            price_amount: 30.00,        // Valor do seu plano
            price_currency: 'brl',      // Moeda (BRL)
            order_id: `pedido_${Date.now()}`,
            order_description: `Assinatura Premium - ${name}`,
            case_id: cpf,               // Opcional: uso do campo case_id para o CPF
            success_url: 'https://seusite.com/sucesso', // Onde o usuário vai após o pagamento
            cancel_url: 'https://seusite.com/cancelado'
        }, {
            headers: { 
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json' 
            }
        });

        // Retorna a URL de checkout para o seu aplicativo React Native
        return res.json({
            status: 'success',
            redirectUrl: response.data.invoice_url
        });

    } catch (error) {
        console.error('Erro na integração com NOWPayments:', error.response?.data || error.message);
        res.status(500).json({ message: 'Erro ao processar o checkout no servidor.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de pagamento rodando na porta ${PORT}`);
});