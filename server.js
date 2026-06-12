import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import http from "http";
import { Server } from "socket.io";

import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

/* ================= LOGS ================= */

console.log("=================================");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "CARREGADO" : "NÃO CARREGADO");
console.log("MONGO_URI:", process.env.MONGO_URI ? "CARREGADO" : "NÃO CARREGADO");
console.log("=================================");

/* ================= MERCADO PAGO ================= */

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const paymentClient = new Payment(mpClient);

/* ================= APP ================= */

const app = express();
const server = http.createServer(app);

/* ================= SOCKET ================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

/* ================= MIDDLEWARE ================= */

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= CLOUDINARY ================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */

const upload = multer({
  storage: multer.memoryStorage(),
});

/* ================= MONGODB ================= */

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI não definido");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado"))
  .catch((err) => console.log("❌ Mongo erro:", err));

/* ================= MODELS ================= */

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

/* ================= POSTS (mantido simples) ================= */

app.get("/posts", async (req, res) => {
  res.json([]);
});

/* ================= PAYMENT ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 CARD-PAYMENT EXECUTED");
    console.log("=================================");

    console.log("📦 BODY RECEBIDO:");
    console.log(JSON.stringify(req.body, null, 2));

    const {
      token,
      payment_method_id,
      email,
      userId,
      name,
      transaction_amount,
      installments,
    } = req.body;

    /* ================= VALIDATION ================= */

    if (!token || !payment_method_id || !email) {
      console.log("❌ DADOS INVÁLIDOS");
      return res.status(400).json({
        success: false,
        error: "Dados inválidos",
      });
    }

    /* ================= PAYMENT ================= */

    console.log("🚀 CRIANDO PAGAMENTO...");

    const result = await paymentClient.create({
      body: {
        transaction_amount: Number(transaction_amount || 100),
        token,
        description: "Checkout Premium",
        installments: Number(installments || 1),
        payment_method_id,
        payer: {
          email,
        },
      },
    });

    console.log("✅ PAGAMENTO CRIADO:");
    console.log(JSON.stringify(result, null, 2));

    /* ================= SAVE DB ================= */

    const saved = await PaymentModel.create({
      id: String(result.id),
      name: name || "Pagamento",
      price: Number(transaction_amount || 100),
      status: result.status,
      email,
      userId,
      brand: payment_method_id,
      date: new Date().toISOString(),
    });

    /* ================= SOCKET ================= */

    io.emit("new-payment", saved);

    /* ================= RESPONSE ================= */

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
      console.log(err.cause);
    }

    console.log(err);

    return res.status(500).json({
      success: false,
      error: err.message,
      cause: err.cause || null,
    });
  }
});

/* ================= SOCKET ================= */

io.on("connection", (socket) => {
  console.log("⚡ Socket conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("⚪ Socket desconectado");
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});