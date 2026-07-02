import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// Habilita CORS para permitir que seu App mobile conecte ao servidor
app.use(cors());
app.use(express.json());

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

app.post('/process-nowpayments-card', async (req, res) => {
    console.log("Recebendo pedido de pagamento...");
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
            success_url: 'https://google.com', // Ajuste conforme necessário
            cancel_url: 'https://google.com'
        }, {
            headers: { 'x-api-key': NOWPAYMENTS_API_KEY }
        });

        return res.json({ status: 'success', redirectUrl: response.data.invoice_url });
    } catch (error) {
        console.error('Erro API NOWPayments:', error.response?.data || error.message);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));