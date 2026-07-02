import express from 'express';
import axios from 'axios';

const app = express();

// Middleware para processar JSON
app.use(express.json());

// CONFIGURAÇÃO: Certifique-se de adicionar a chave no painel do Render
// em: Settings -> Environment -> Add Environment Variable
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

app.post('/process-nowpayments-card', async (req, res) => {
    const { name, email, cpf } = req.body;

    if (!email || !name) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    try {
        const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
            price_amount: 30.00,
            price_currency: 'brl',
            order_id: `pedido_${Date.now()}`,
            order_description: `Assinatura Premium - ${name}`,
            case_id: cpf,
            success_url: 'https://seusite.com/sucesso',
            cancel_url: 'https://seusite.com/cancelado'
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
            message: 'Erro ao processar o checkout no servidor.',
            details: error.response?.data?.message || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de pagamento rodando na porta ${PORT}`);
});