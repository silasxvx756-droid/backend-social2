import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

/* ================= LOGS ================= */

console.log("=================================");
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "CARREGADO" : "NÃO CARREGADO");
console.log("MONGO_URI:", process.env.MONGO_URI ? "CARREGADO" : "NÃO CARREGADO");
console.log("=================================");

/* ================= MP CONFIG ================= */

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
    methods: ["GET", "POST"],
  },
});

/* ================= MIDDLEWARE ================= */

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= MONGO ================= */

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI não definido");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado"))
  .catch((err) => console.log("❌ Mongo error:", err));

/* ================= MODEL ================= */

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

/* ================= PAYMENT ROUTE (BRICK) ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 PAYMENT REQUEST");
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

    if (!token || !payment_method_id || !email) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios faltando",
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
    console.log("📤 ENVIANDO AO MERCADO PAGO:");
    console.log(JSON.stringify(paymentData, null, 2));

    const result = await paymentClient.create({
      body: paymentData,
    });

    console.log("=================================");
    console.log("✅ RESPOSTA MP:");
    console.log(JSON.stringify(result, null, 2));

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

    /* ================= SOCKET (CORRETO) ================= */

    if (userId) {
      io.to(userId).emit("payment-status", {
        userId,
        status: result.status,
        paymentId: result.id,
      });
    } else {
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
    console.log("❌ ERRO PAYMENT");

    console.log("MESSAGE:", err.message);

    if (err.cause) {
      console.log("CAUSE:", JSON.stringify(err.cause, null, 2));
    }

    if (err.response?.data) {
      console.log("MP ERROR:", JSON.stringify(err.response.data, null, 2));
    }

    return res.status(500).json({
      success: false,
      error: err.message,
      details: err.response?.data || null,
    });
  }
});

/* ================= SOCKET ================= */

io.on("connection", (socket) => {
  console.log("⚡ Socket conectado:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("⚪ Socket desconectado");
  });
});

/* ================= START ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});