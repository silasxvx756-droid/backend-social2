import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const paymentClient = new Payment(mpClient);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors({ origin: "*" }));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado com sucesso!"))
  .catch((err) => console.log("❌ Erro de conexão Mongo:", err));

const PaymentSchema = new mongoose.Schema({
  paymentId: String,
  name: String,
  price: Number,
  status: String,
  email: String,
  userId: String,
  brand: String,
  date: String,
}, { timestamps: true });

const PaymentModel = mongoose.model("Payment", PaymentSchema);

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 PAYMENT REQUEST RECIEVED");
    
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
      console.log("⚠️ ERRO: Campos obrigatórios ausentes.");
      return res.status(400).json({ success: false, error: "Campos cruciais faltando." });
    }

    // Separação dinâmica e segura do nome e sobrenome do comprador
    const nomeLimpo = name ? name.trim() : "Cliente";
    const partesDoNome = nomeLimpo.split(" ");
    const firstName = partesDoNome[0];
    const lastName = partesDoNome.length > 1 ? partesDoNome.slice(1).join(" ") : "Sobrenome";

    const paymentData = {
      transaction_amount: Number(transaction_amount || 10),
      token,
      description: "Checkout Premium",
      installments: Number(installments || 1),
      payment_method_id,
      payer: {
        email: email?.trim(),
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: cpf ? cpf.replace(/\D/g, "") : "00000000000"
        }
      }
    };

    console.log("📤 ENVIANDO AO MP COM DADOS ANTIFRAUDE CORRIGIDOS...");
    
    const result = await paymentClient.create({ body: paymentData });

    console.log(`✅ RESPOSTA DO MERCADO PAGO: [${result.status}]`);

    const saved = await PaymentModel.create({
      paymentId: String(result.id),
      name: nomeLimpo,
      price: Number(transaction_amount || 10),
      status: result.status,
      email,
      userId,
      brand: payment_method_id,
      date: new Date().toISOString(),
    });

    if (userId) {
      console.log(`⚡ Notificando sala via Socket: ${userId}`);
      io.to(userId).emit("payment-status", { userId, status: result.status, paymentId: result.id });
    }

    return res.json({ success: true, mercadoPago: result, local: saved });

  } catch (err) {
    console.log("💥 ERRO NO PROCESSAMENTO:", err.message);
    if (err.response?.data) {
      console.log("MP DETALHES:", JSON.stringify(err.response.data, null, 2));
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

io.on("connection", (socket) => {
  socket.on("join", (userId) => socket.join(userId));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`🚀 Servidor backend ativo na porta ${PORT}`));