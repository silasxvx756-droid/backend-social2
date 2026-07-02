import express from 'express';
import axios from 'axios';
import cors from 'cors';
import 'dotenv/config'; 

const app = express();

// Middleware necessário para aceitar requisições do seu App
app.use(cors());
app.use(express.json());

// Certifique-se de que no Render a variável se chama "NOW_API_KEY"
const NOWPAYMENTS_API_KEY = process.env.NOW_API_KEY;

app.post('/process-nowpayments-card', async (req, res) => {
    const { name, email, cpf } = req.body;

    // Validação básica
    if (!email || !name) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    try {
        // Chamada para criar a fatura sem o campo "case_id"
        // Incluímos o CPF no order_id para você conseguir identificar o pagamento depois
        const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
            price_amount: 30.00,
            price_currency: 'brl',
            order_id: `pedido_${Date.now()}_cpf_${cpf}`, 
            order_description: `Assinatura Premium - ${name}`,
            success_url: 'https://google.com',
            cancel_url: 'https://google.com'
        }, {
            headers: { 
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json' 
            }
        });

        return res.json({ 
            status: 'success', 
            redirectUrl: response.data.invoice_url 
        });

    } catch (error) {
        console.error('Erro na integração:', error.response?.data || error.message);
        res.status(500).json({ 
            message: 'Erro ao processar o pagamento no gateway.',
            details: error.response?.data?.message || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de pagamento rodando na porta ${PORT}`);
});