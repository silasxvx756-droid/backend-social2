import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

/* ================= CONFIGURAÇÃO DO MERCADO PAGO ================= */

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

const paymentClient = new Payment(mpClient);

/* ================= INICIALIZAÇÃO E MIDDLEWARES ================= */

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

app.use(cors({ origin: "*" }));
app.use(express.json());

/* ================= CONEXÃO BANCO DE DADOS ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado com sucesso!"))
  .catch((err) => console.log("❌ Erro de conexão com o Mongo:", err));

/* ================= SCHEMA DO BANCO ================= */

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

/* ================= ROTA DE PAGAMENTO REAL BLINDADA ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 PAYMENT REQUEST RECEIVED (MODO REAL ATIVADO)");
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
      deviceId
    } = req.body;

    // Validação estrita de campos
    if (!token || !payment_method_id || !email) {
      console.log("⚠️ REQUISIÇÃO REJEITADA: Faltam campos cruciais.");
      return res.status(400).json({ 
        success: false, 
        error: "Campos cruciais faltando no corpo da requisição." 
      });
    }

    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const firstName = name ? name.split(" ")[0] : "Cliente";
    const lastName = name && name.split(" ").length > 1 ? name.split(" ").slice(1).join(" ") : "Silva";

    // Montagem do payload oficial exigido pelo antifraude do Mercado Pago
    const paymentData = {
      transaction_amount: Number(transaction_amount || 400),
      token,
      description: "Inscrição Checkout Premium",
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
      },
      additional_info: {
        ip_address: clientIp,
        items: [
          {
            id: "premium-access-01",
            title: "Acesso Premium Procurojob",
            description: "Upgrade de conta na plataforma profissional para designers",
            category_id: "services",
            quantity: 1,
            unit_price: Number(transaction_amount || 400)
          }
        ]
      }
    };

    console.log("=================================");
    console.log("X-Meli-Session-Id enviado:", deviceId || "Não enviado");
    console.log("📤 ENVIANDO PRODUÇÃO AO MERCADO PAGO...");
    
    // CHAMADA REAL À API DO MERCADO PAGO
    const result = await paymentClient.create({ 
      body: paymentData,
      requestOptions: {
        headers: {
          "X-Meli-Session-Id": String(deviceId || `session-fallback-${Date.now()}`),
          "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    });

    console.log("=================================");
    console.log(`✅ RESPOSTA DO MERCADO PAGO: [${result.status}]`);
    console.log(`🔍 DETALHE DO STATUS: [${result.status_detail}]`);

    // Armazenamento do histórico real no MongoDB
    const saved = await PaymentModel.create({
      paymentId: String(result.id),
      name: name || "Pagamento Real",
      price: Number(transaction_amount || 400),
      status: result.status,
      email,
      userId,
      brand: payment_method_id,
      date: new Date().toISOString(),
    });

    /* ================= SINALIZAÇÃO REAL-TIME VIA SOCKET ================= */
    if (userId) {
      console.log(`⚡ Notificando sala via Socket: ${userId}`);
      io.to(userId).emit("payment-status", { 
        userId, 
        status: result.status, 
        paymentId: result.id 
      });
    }

    return res.json({ 
      success: true, 
      mercadoPago: result, 
      local: saved 
    });

  } catch (err) {
    console.log("=================================");
    console.log("💥 ERRO NO PROCESSAMENTO REAL:", err.message);
    
    if (err.response?.data) {
      console.log("MP DETALHES INTERNOS:", JSON.stringify(err.response.data, null, 2));
    }
    
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      details: err.response?.data || null
    });
  }
});

/* ================= EVENTOS DO SOCKET.IO ================= */

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join(userId);
  });
});

/* ================= INICIALIZAÇÃO DO SERVIDOR ================= */

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend REAL rodando na porta ${PORT}`);
});