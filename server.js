import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

// Configurações de repasse Pix pessoal do Procurojob
const MINHA_CHAVE_PIX = "silas_santos@outlook.com"; 
const TIPO_CHAVE_PIX = "email"; 

const app = express();
const server = http.createServer(app);

/* ================= CORS ================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
  },
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ================= MONGODB ================= */
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI não definido nas variáveis de ambiente");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB conectado com sucesso!"))
  .catch((err) => console.log("❌ Erro ao conectar no MongoDB:", err));

/* ================= MODELS (ESTRUTURA COMPLETA PROCUROJOB) ================= */
const userSchema = new mongoose.Schema({
  id: String,
  username: { type: String, unique: true },
  displayName: String,
  avatar: String,
  bio: String,
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
});
const User = mongoose.model("User", userSchema);

const followSchema = new mongoose.Schema({
  followerId: String,
  followingId: String,
});
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
const Follow = mongoose.model("Follow", followSchema);

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  image: String,
  actor: { id: String, username: String, displayName: String, avatar: String },
  comments: [{ text: String, user: Object, createdAt: { type: Date, default: Date.now } }],
  likes: [{ id: String, username: String }],
}, { timestamps: true });
const Post = mongoose.model("Post", postSchema);

const notificationSchema = new mongoose.Schema({
  userId: String,
  type: { type: String, enum: ["like", "comment", "follow", "post"] },
  postId: String,
  actor: { id: String, username: String, displayName: String, avatar: String },
  read: { type: Boolean, default: false },
}, { timestamps: true });
const Notification = mongoose.model("Notification", notificationSchema);

const messageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  content: String,
}, { timestamps: true });
const Message = mongoose.model("Message", messageSchema);

const jobSchema = new mongoose.Schema({
  title: String,
  company: String,
  description: String,
  whatsapp: String,
  actor: { id: String, username: String, displayName: String, avatar: String },
}, { timestamps: true });
const Job = mongoose.model("Job", jobSchema);

const paymentSchema = new mongoose.Schema({
  id: String,
  name: String,
  price: String,
  status: { type: String, default: "pending" },
  email: String,
  userId: String,
}, { timestamps: true });
const PaymentModel = mongoose.model("Payment", paymentSchema);

/* ================= ROOT & HEALTH CHECK ================= */
app.get("/", (req, res) => res.send("Servidor do Procurojob rodando perfeitamente 🚀"));
app.get("/health", (req, res) => res.json({ success: true, status: "online" }));

/* ================= HELPERS (CLERK VALIDATION) ================= */
const fetchClerkUserById = async (clerkId) => {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return {
      clerkId: user.id,
      username: user.username || `user_${user.id.slice(-6)}`,
      displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "User",
      avatar: user.profile_image_url || "",
    };
  } catch (err) {
    console.log("Erro ao buscar dados no Clerk:", err);
    return null;
  }
};

/* ================= POSTS & TIMELINE ================= */
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/upload", upload.single("image"), async (req, res) => {
  try {
    let { title, content, actor } = req.body;
    if (typeof actor === "string") actor = JSON.parse(actor);

    const freshUser = await fetchClerkUserById(actor.id);
    const finalActor = freshUser ? {
      id: freshUser.clerkId,
      username: freshUser.username,
      displayName: freshUser.displayName,
      avatar: freshUser.avatar,
    } : actor;

    let imageUrl = null;
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "posts" }, (err, res) => res ? resolve(res) : reject(err));
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      imageUrl = result.secure_url;
    }

    const post = await Post.create({ title, content, actor: finalActor, image: imageUrl });
    io.emit("new-post", post);
    res.status(201).json(post);
  } catch (err) {
    console.log("Erro no upload do post:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= SISTEMA DE PAGAMENTO INTEGRADO (MERCADO PAGO - DINÂMICO) ================= */

// ROTA 1: PROCESSAR COBRANÇA DO CARTÃO (TOKEN DINÂMICO DO FRONT-END)
app.post('/card-payment', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || `req-${Date.now()}`;
  const tokenAmbiente = process.env.MP_ACCESS_TOKEN;

  if (!tokenAmbiente) {
    console.error("❌ ERRO: MP_ACCESS_TOKEN não está definido nas variáveis de ambiente!");
    return res.status(500).json({ success: false, error: "Erro de configuração nas credenciais do servidor." });
  }

  try {
    const { token, payment_method_id, transaction_amount, installments, email, userId, name, cpf, deviceId } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "O token do cartão gerado pelo Bricks é obrigatório." });
    }

    console.log(`\n============== 💳 NOVA TENTATIVA DE PAGAMENTO ==============`);
    console.log(`User ID no Mongo: ${userId} | Cliente: ${name}`);
    console.log(`Device ID (Antifraude): ${deviceId || "Não enviado"}`);

    const paymentRequestBytes = {
      transaction_amount: Number(transaction_amount || 10),
      token: token,
      description: "Procurojob Premium - Acesso Total",
      installments: Number(installments || 1),
      payment_method_id: payment_method_id,
      payer: {
        email: email,
        first_name: name.split(" ")[0],
        last_name: name.split(" ").slice(1).join(" ") || "Silva",
        identification: { type: "CPF", number: cpf.replace(/\D/g, "") }
      },
      metadata: { user_id: userId }
    };

    // Injeção do X-Melidata-Session-Id nos headers da requisição do Mercado Pago
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenAmbiente}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
        "X-Melidata-Session-Id": deviceId // 👈 Adicionado de forma estrita para evitar reparações antifraude
      },
      body: JSON.stringify(paymentRequestBytes)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("\n❌ ERRO RETORNADO PELA API DO MERCADO PAGO:");
      console.error(result);
      return res.status(response.status).json({ 
        success: false, 
        error: result.message || (result.cause && result.cause[0]?.description) || "Erro na API do Mercado Pago" 
      });
    }

    console.log(`\n🔍 DETALHES DO RETORNO MP:`);
    console.log(`ID: ${result.id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Detalhe do Status: ${result.status_detail}`); 

    const localPayment = await PaymentModel.create({
      id: String(result.id),
      name: name,
      price: String(transaction_amount || 10),
      status: result.status,
      email: email,
      userId: userId
    });

    // 🟢 Dispara o Socket apenas para o canal privado (sala) deste usuário específico
    if (userId) {
      io.to(userId).emit("new-payment", localPayment);
      console.log(`⚡ Evento de pagamento enviado exclusivamente para a sala do usuário: ${userId}`);
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
    console.error("\n❌ ERRO CRÍTICO NO BACKEND AO PROCESSAR COBRANÇA:");
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ROTA 2: WEBHOOK DE ATUALIZAÇÃO E DISPARO DE REPASSE PIX AUTOMÁTICO
app.post('/mercado-pago-webhook', async (req, res) => {
  try {
    const { action, data } = req.body;
    const tokenAmbiente = process.env.MP_ACCESS_TOKEN;

    if (!tokenAmbiente) {
      console.error("❌ ERRO: MP_ACCESS_TOKEN ausente nas variáveis de ambiente do Webhook.");
      return res.status(500).send("Erro de Configuração");
    }

    if ((action === "payment.updated" || action === "payment.created") && data && data.id) {
      const paymentId = data.id;
      console.log(`\n🔔 Notificação recebida para o pagamento: ${paymentId}`);

      const responsePayment = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${tokenAmbiente}` }
      });
      
      const paymentData = await responsePayment.json();

      if (paymentData.status === 'approved') {
        const userId = paymentData.metadata?.user_id;
        const valorLiquido = paymentData.transaction_details?.net_received_amount;

        console.log(`\n============= 💸 INICIANDO REPASSE AUTOMÁTICO =============`);
        console.log(`Pagamento aprovado: ${paymentId} | Valor Líquido: R$ ${valorLiquido}`);

        const updatedPayment = await PaymentModel.findOneAndUpdate(
          { id: String(paymentId) }, 
          { status: "approved" },
          { new: true }
        );

        // 🟢 Se o pagamento mudar de status via Webhook de fora do app, notifica o usuário via canal privado
        if (userId && updatedPayment) {
          io.to(userId).emit("new-payment", updatedPayment);
          console.log(`⚡ Notificação via Webhook disparada para a sala do usuário: ${userId}`);
        }

        const transferResponse = await fetch("https://api.mercadopago.com/v1/transfers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokenAmbiente}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: Number(valorLiquido),
            description: `Repasse Procurojob Ref: ${paymentId}`,
            destination: {
              type: "pix",
              bank_account: { pix_key: MINHA_CHAVE_PIX, pix_key_type: TIPO_CHAVE_PIX }
            }
          })
        });

        const transferResult = await transferResponse.json();
        console.log("Resultado da API de Transferência Pix:", transferResult);
        console.log(`============================================================\n`);
      }
    }
    return res.status(200).send("OK");
  } catch (error) {
    console.error("\n❌ ERRO AO PROCESSAR WEBHOOK / TRANSFERÊNCIA PIX:", error);
    return res.status(500).send("Erro Interno");
  }
});

/* ================= HISTÓRICO LOCAL DE TRANSAÇÕES ================= */
app.get("/payments", async (req, res) => {
  try {
    const payments = await PaymentModel.find().sort({ createdAt: -1 });
    res.json({ success: true, total: payments.length, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/payments/:id", async (req, res) => {
  try {
    const deleted = await PaymentModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: "Pagamento não encontrado" });
    
    // Notifica de forma geral apenas a remoção (se necessário para painéis)
    io.emit("delete-payment", req.params.id);
    res.json({ success: true, message: "Pagamento removido" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= MANIPULAÇÃO DE SESSÕES WEBSOCKET ================= */
io.on("connection", (socket) => {
  console.log("⚡ Novo dispositivo conectado ao Socket:", socket.id);
  
  // O Front-end do app precisa dar um socket.emit("join", userId) ao conectar!
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`🟢 Usuário ${userId} sincronizado com sucesso no canal privado.`);
    }
  });
  
  socket.on("disconnect", () => console.log("⚪ Conexão de socket encerrada"));
});

/* ================= INICIALIZAÇÃO DO SERVIDOR ================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor do Procurojob ativo e rodando na porta ${PORT}`);
});