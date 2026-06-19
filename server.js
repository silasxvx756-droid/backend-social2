import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

/* ================= LOGS DE INICIALIZAÇÃO ================= */

console.log("=================================");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "CARREGADO" : "NÃO CARREGADO");
console.log("MONGO_URI:", process.env.MONGO_URI ? "CARREGADO" : "NÃO CARREGADO");
console.log("=================================");

/* ================= MERCADO PAGO CONFIG ================= */

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const paymentClient = new Payment(mpClient);

/* ================= APP & SERVER ================= */

const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

/* ================= MIDDLEWARES ================= */

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= MONGODB CONNECTION ================= */

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI não definido");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado"))
  .catch((err) => console.log("❌ Mongo erro:", err));

/* ================= MONGOOSE MODEL ================= */

const PaymentSchema = new mongoose.Schema(
  {
    id: String,
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

/* ================= ROUTES ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 CARD-PAYMENT EXECUTED");
    console.log("=================================");
    console.log("📦 BODY RECEBIDO:");
    console.log(JSON.stringify(req.body, null, 2));

    // Desestruturação do body
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

    // Validação básica
    if (!token || !payment_method_id) {
      console.log("❌ DADOS INVÁLIDOS");
      return res.status(400).json({
        success: false,
        error: "Dados inválidos (token ou payment_method_id faltando)",
      });
    }

    // Montagem do objeto de pagamento
    const paymentData = {
      transaction_amount: Number(transaction_amount || 400),
      token,
      description: "Checkout Premium",
      installments: Number(installments || 1),
      payment_method_id,
      payer: {
        email,
        first_name: name || "Cliente",
        identification: {
          type: "CPF",
          number: cpf,
        },
      },
    };

    // ================= LOG ADICIONADO =================
    // Aqui você vê exatamente o que será enviado para o MP
    console.log("BODY ENVIADO AO MP:");
    console.log(JSON.stringify(paymentData, null, 2));
    // ===================================================

    console.log("=================================");
    console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "CARREGADO" : "NÃO CARREGADO");
    console.log("TOKEN PREFIX:", process.env.MP_ACCESS_TOKEN?.substring(0, 30));
    console.log("=================================");

    // Requisição ao Mercado Pago
    const result = await paymentClient.create({ body: paymentData });

    console.log("✅ PAGAMENTO CRIADO:");
    console.log(JSON.stringify(result, null, 2));

    // Salvamento no Banco de Dados
    const saved = await PaymentModel.create({
      id: String(result.id),
      name: name || "Pagamento",
      price: Number(transaction_amount || 1),
      status: result.status,
      email: email || "no-email@test.com",
      userId,
      brand: payment_method_id,
      date: new Date().toISOString(),
    });

    // Emissão via Socket
    io.emit("new-payment", saved);

    return res.json({
      success: true,
      payment: saved,
      mercadoPago: result,
    });
  } catch (err) {
    console.log("=================================");
    console.log("❌ ERRO PAGAMENTO");
    console.log("=================================");

    console.log("MESSAGE:", err.message);

    if (err.cause) {
      console.log("CAUSE:");
      console.log(JSON.stringify(err.cause, null, 2));
    }

    if (err.response) {
      console.log("RESPONSE:");
      console.log(JSON.stringify(err.response.data, null, 2));
    }

    console.log("ERRO COMPLETO:");
    console.log(err);

    return res.status(500).json({
      success: false,
      error: err.message,
      cause: err.cause || null,
      response: err.response?.data || null,
    });
  }
});

/* ================= SOCKET CONNECTION ================= */

io.on("connection", (socket) => {
  console.log("⚡ Socket conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("⚪ Socket desconectado");
  });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});
