import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(express.json());
app.use(cors());

// COLE O SEU ACCESSTOKEN AQUI (Certifique-se de que não há espaços antes ou depois)
const MERCADO_PAGO_TOKEN = 'APP_USR-2229766877962184-070511-a692a9a81ccd12072e7a6ca446fcea0d-3121279336'.trim();

// 1. Configura a SDK oficial do Mercado Pago com o Token tratado
const client = new MercadoPagoConfig({ 
  accessToken: MERCADO_PAGO_TOKEN 
});
const payment = new Payment(client);

// Suas configurações de repasse Pix
const MINHA_CHAVE_PIX = "silas_santos@outlook.com"; 
const TIPO_CHAVE_PIX = "email"; 

/**
 * 2. ROTA DE CHECKOUT (CARTÃO)
 */
app.post('/card-payment', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || `req-${Date.now()}`;

  try {
    const { 
      token, 
      payment_method_id, 
      transaction_amount, 
      installments, 
      email, 
      userId, 
      name, 
      cpf, 
      deviceId 
    } = req.body;

    console.log(`\n============== 💳 NOVA TENTATIVA DE PAGAMENTO ==============`);
    console.log(`User ID no Mongo: ${userId}`);
    console.log(`Cliente: ${name} | CPF: ${cpf} | Email: ${email}`);
    console.log(`Device ID (Antifraude): ${deviceId}`);
    console.log(`Método: ${payment_method_id} | Token do Cartão: ${token}`);
    console.log(`Idempotency Key usada: ${idempotencyKey}`);

    const paymentRequest = {
      body: {
        transaction_amount: Number(transaction_amount),
        token: token,
        description: "Procurojob Premium - Acesso Total",
        installments: Number(installments),
        payment_method_id: payment_method_id,
        payer: {
          email: email,
          first_name: name.split(" ")[0],
          last_name: name.split(" ").slice(1).join(" ") || "Silva",
          identification: {
            type: "CPF",
            number: cpf.replace(/\D/g, "")
          }
        },
        metadata: {
          user_id: userId
        }
      },
      requestOptions: {
        idempotencyKey: idempotencyKey,
        headers: {
          'X-Melidata-Session-Id': deviceId
        }
      }
    };

    const result = await payment.create(paymentRequest);

    console.log(`\n✅ RESPOSTA DO MERCADO PAGO:`);
    console.log(`ID da Transação: ${result.id}`);
    console.log(`STATUS Principal: ${result.status}`);
    console.log(`STATUS DETALHE: ${result.status_detail}`);
    console.log(`============================================================\n`);

    if (result.status === 'approved') {
      console.log(`[BANCO DE DADOS] Pagamento imediato aprovado. Usuário: ${userId}`);
    }

    return res.status(200).json({
      success: true,
      mercadoPago: {
        id: result.id,
        status: result.status,
        status_detail: result.status_detail
      }
    });

  } catch (error) {
    console.error("\n❌ ERRO CRÍTICO AO PROCESSAR PAGAMENTO NO BACKEND:");
    const mpError = error.cause?.[0] || error;
    console.error(mpError);
    console.log(`============================================================\n`);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar com o Mercado Pago",
      error: mpError.description || error.message
    });
  }
});

/**
 * 3. ROTA DE WEBHOOK (ESCUTA ATUALIZAÇÕES E ENVIA O PIX AUTOMÁTICO)
 */
app.post('/mercado-pago-webhook', async (req, res) => {
  try {
    const { action, data } = req.body;

    if ((action === "payment.updated" || action === "payment.created") && data && data.id) {
      const paymentId = data.id;

      console.log(`\n🔔 Notificação recebida para o pagamento: ${paymentId}`);

      const paymentData = await payment.get({ id: paymentId });

      if (paymentData.status === 'approved') {
        const userId = paymentData.metadata?.user_id;
        const valorLiquido = paymentData.transaction_details?.net_received_amount;

        console.log(`\n============= 💸 INICIANDO REPASSE AUTOMÁTICO =============`);
        console.log(`Pagamento: ${paymentId} | Usuário do App: ${userId}`);
        console.log(`Valor Líquido Liberado: R$ ${valorLiquido}`);
        console.log(`Destino do Pix: ${MINHA_CHAVE_PIX}`);

        const transferResponse = await fetch("https://api.mercadopago.com/v1/transfers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${MERCADO_PAGO_TOKEN}`, // Usa a mesma variável corrigida aqui
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: Number(paymentData.transaction_details.net_received_amount),
            description: `Repasse Procurojob Ref: ${paymentId}`,
            destination: {
              type: "pix",
              bank_account: {
                pix_key: MINHA_CHAVE_PIX,
                pix_key_type: TIPO_CHAVE_PIX
              }
            }
          })
        });

        const transferResult = await transferResponse.json();
        console.log("Resultado da API de Transferência:", transferResult);
        console.log(`============================================================\n`);
      }
    }

    return res.status(200).send("OK");

  } catch (error) {
    console.error("\n❌ ERRO AO PROCESSAR WEBHOOK / TRANSFERÊNCIA PIX:");
    console.error(error);
    return res.status(500).send("Erro Interno");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor do Procurojob rodando com sucesso na porta ${PORT}`);
});