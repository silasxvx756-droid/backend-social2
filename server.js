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

/* ================= ROTA CRÍTICA DE PAGAMENTO COMPLETA ================= */

app.post("/card-payment", async (req, res) => {
  try {
    console.log("=================================");
    console.log("🔥 PAYMENT REQUEST RECIEVED (BLINDADO)");
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

    // Validação estrita inicial
    if (!token || !payment_method_id || !email) {
      console.log("⚠️ REQUISIÇÃO REJEITADA: Faltam campos cruciais.");
      return res.status(400).json({ 
        success: false, 
        error: "Campos cruciais faltando no corpo da requisição." 
      });
    }

    // 1. CAPTURA DO IP REAL DO COMPRADOR (Essencial para o Score Antifraude)
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Tratamento de Nome e Sobrenome para evitar falha de checkout
    const firstName = name ? name.split(" ")[0] : "Cliente";
    const lastName = name && name.split(" ").length > 1 ? name.split(" ").slice(1).join(" ") : "Silva";

    // 2. MONTAGEM DO OBJETO COMPLETO SEGUINDO A DOCUMENTAÇÃO MP
    const paymentData = {
      transaction_amount: Number(transaction_amount || 10),
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
      // 3. BLINDAGEM ANTIFRAUDE: Detalhamento do carrinho de compras e IP
      additional_info: {
        ip_address: clientIp,
        items: [
          {
            id: "premium-access-01",
            title: "Acesso Premium Procurojob",
            description: "Upgrade de conta na plataforma profissional para designers",
            category_id: "services",
            quantity: 1,
            unit_price: Number(transaction_amount || 10)
          }
        ]
      }
    };

    console.log("=================================");
    console.log("📤 ENVIANDO AO MP COM DADOS ANTIFRAUDE ROBUSTOS...");
    
    const result = await paymentClient.create({ body: paymentData });

    console.log("=================================");
    console.log(`✅ RESPOSTA DO MERCADO PAGO: [${result.status}]`);
    console.log(`🔍 DETALHE DO STATUS: [${result.status_detail}]`);

    // Armazenamento do histórico da transação no banco
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
    console.log("💥 ERRO PROCESSAMENTO CARTÃO:", err.message);
    
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
  console.log(`🚀 Backend rodando perfeitamente na porta ${PORT}`);
});