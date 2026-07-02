const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const NOWPAYMENTS_API_KEY = 'SUA_API_KEY_AQUI';

app.post('/process-nowpayments-card', async (req, res) => {
    const { amount, currency, email, card, deviceId } = req.body;

    try {
        // Exemplo: Encaminhando para o endpoint de processamento de cartão (se suportado pelo seu contrato com o gateway)
        // ATENÇÃO: Verifique a documentação exata da API que você está usando
        const response = await axios.post('https://api.nowpayments.io/v1/payment', {
            price_amount: amount,
            price_currency: currency,
            pay_currency: 'btc', // Exemplo
            ipn_callback_url: 'https://seu-site.com/ipn',
            order_description: `Pagamento de ${email}`,
            // Nota: Se a API da NOWPayments não aceitar os dados do cartão diretamente,
            // você deve usar este endpoint para criar a fatura e retornar o link de checkout.
        }, {
            headers: { 'x-api-key': NOWPAYMENTS_API_KEY }
        });

        res.json({ status: 'redirect', redirectUrl: response.data.invoice_url });
    } catch (error) {
        res.status(500).json({ message: 'Erro no processamento: ' + error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando'));