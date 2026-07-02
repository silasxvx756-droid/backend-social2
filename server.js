import express from 'express';
import axios from 'axios';
import cors from 'cors';
import 'dotenv/config'; // Garante que as variáveis do .env sejam carregadas (em dev)

const app = express();
app.use(cors());
app.use(express.json());

// O nome deve ser IGUAL ao que você vai cadastrar no Render
const NOWPAYMENTS_API_KEY = process.env.NOW_API_KEY;

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
            success_url: 'https://google.com',
            cancel_url: 'https://google.com'
        }, {
            headers: { 
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json' 
            }
        });

        return res.json({ status: 'success', redirectUrl: response.data.invoice_url });
    } catch (error) {
        console.error('Erro na integração:', error.response?.data || error.message);
        res.status(500).json({ message: 'Erro no gateway de pagamento.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));