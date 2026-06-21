import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

/* ================= LOGS INICIAIS ================= */

console.log("=================================");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "CARREGADO ✔" : "NÃO CARREGADO ❌");
console.log("MONGO_URI:", process.env.MONGO_URI ? "CARREGADO ✔" : "NÃO CARREGADO ❌");
console.log("=================================");

/* ================= CONFIGURAÇÃO DO MERCADO PAGO ================= */

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const paymentClient = new Payment(mpClient);

/* ================= INICIALIZAÇÃO DO APP ================= */

const app = express();
const server = http.createServer(app);

/* ================= CONFIGURAÇÃO DO SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* ================= MIDDLEWARES ================= */

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= CONEXÃO MONGO OBLIGATÓRIA ================= */

if (!process.env.MONGO_URI) {
  console.error("❌ ERRO GRAVE: MONGO_URI não definido no arquivo .env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado com sucesso!"))
  .catch((err) => console.log("❌ Erro de conexão com o Mongo:", err));

/* ================= SCHEMA E MODELO DO BANCO ================= */

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: String,
    name: String,
    price: Number,
    status: String,
    email: String,
    userId: String,
    brand: String,
    date: String,
  },
  { timestamps: true }
);

const PaymentModel = mongoose.model("Payment", PaymentSchema);

/* ================= ROTA DE PAGAMENTO DO BRICK ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 PAYMENT REQUEST - REQUISIÇÃO CHEGOU");
    console.log(JSON.stringify(req.body, null, 2));

    const {
      token,
      payment_method_id,
      email,
      userId,
      name,
      cpf,
      transaction_amount,
      installments,
    } = req.body;

    // RASTREIO DETALHADO: Verifica se as propriedades fundamentais chegaram vazias
    console.log("🔍 VALIDANDO CAMPOS REQUERIDOS:");
    console.log(`-> token: ${token ? "OK ✔" : "VAZIO/AUSENTE ❌"}`);
    console.log(`-> payment_method_id: ${payment_method_id ? "OK ✔" : "VAZIO/AUSENTE ❌"}`);
    console.log(`-> email: ${email ? "OK ✔" : "VAZIO/AUSENTE ❌"}`);

    if (!token || !payment_method_id || !email) {
      console.log("⚠️ REQUISIÇÃO BARRADA: Dados cruciais do cartão não foram enviados pelo site.");
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios faltando (token, método de pagamento ou email ausentes)",
      });
    }

    const paymentData = {
      transaction_amount: Number(transaction_amount || 10),
      token,
      description: "Checkout Premium",
      installments: Number(installments || 1),
      payment_method_id,
      payer: {
        email: email?.trim(),
        first_name: name || "Cliente",
        identification: cpf
          ? {
              type: "CPF",
              number: cpf.replace(/\D/g, ""),
            }
          : undefined,
      },
    };

    console.log("=================================");
    console.log("📤 ENVIANDO REQUISIÇÃO AO MERCADO PAGO...");

    // Dispara a criação do pagamento na API do Mercado Pago
    const result = await paymentClient.create({
      body: paymentData,
    });

    console.log("=================================");
    console.log("✅ RESPOSTA DO MERCADO PAGO RECEBIDA:");
    console.log(JSON.stringify(result, null, 2));

    // Salva o log da transação no seu Banco MongoDB
    const saved = await PaymentModel.create({
      paymentId: String(result.id),
      name: name || "Pagamento",
      price: Number(transaction_amount || 10),
      status: result.status,
      email,
      userId,
      brand: payment_method_id,
      date: new Date().toISOString(),
    });

    /* ================= NOTIFICAÇÃO VIA SOCKET.IO ================= */

    if (userId) {
      console.log(`⚡ Emitindo status [${result.status}] via Socket para a sala: ${userId}`);
      io.to(userId).emit("payment-status", {
        userId,
        status: result.status,
        paymentId: result.id,
      });
    } else {
      console.log(`⚡ Emitindo status [${result.status}] via Socket Global`);
      io.emit("payment-status", {
        status: result.status,
        paymentId: result.id,
      });
    }

    return res.json({
      success: true,
      mercadoPago: result,
      local: saved,
    });

  } catch (err) {
    console.log("=================================");
    console.log("💥 ERRO DETECTADO DURANTE O PROCESSAMENTO 💥");
    console.log("MENSAGEM:", err.message);

    if (err.cause) {
      console.log("RAZÃO (CAUSE):", JSON.stringify(err.cause, null, 2));
    }

    if (err.response?.data) {
      console.log("ERRO RETORNADO PELA API MP:", JSON.stringify(err.response.data, null, 2));
    }

    return res.status(500).json({
      success: false,
      error: err.message,
      details: err.response?.data || null,
    });
  }
});

/* ================= EVENTOS DO SOCKET.IO ================= */

io.on("connection", (socket) => {
  console.log("⚡ Novo cliente conectado ao Socket.io:", socket.id);

  socket.on("join", (userId) => {
    console.log(`🚪 Cliente [${socket.id}] entrou na sala privada: ${userId}`);
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log(`⚪ Cliente desconectado do Socket.io: [${socket.id}]`);
  });
});

/* ================= INICIALIZAÇÃO DO SERVIDOR ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor backend rodando perfeitamente na porta ${PORT}`);
});