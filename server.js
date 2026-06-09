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

import { MercadoPagoConfig, Payment } from "mercadopago";

dotenv.config();

console.log("=================================");
console.log(
  "MP_ACCESS_TOKEN:",
  process.env.MP_ACCESS_TOKEN ? "CARREGADO" : "NÃO CARREGADO"
);
console.log(
  "MONGO_URI:",
  process.env.MONGO_URI ? "CARREGADO" : "NÃO CARREGADO"
);
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

const userSchema = new mongoose.Schema({
  id: String,
  username: { type: String, unique: true },
  displayName: String,
  avatar: String,
});

const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    image: String,
    actor: Object,
    comments: Array,
    likes: Array,
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

const paymentSchema = new mongoose.Schema(
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

const PaymentModel = mongoose.model("Payment", paymentSchema);

/* ================= POSTS ================= */

app.get("/posts", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post("/posts/upload", upload.single("image"), async (req, res) => {
  try {
    let { title, content, actor } = req.body;

    actor = typeof actor === "string" ? JSON.parse(actor) : actor;

    let imageUrl = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "posts" },
          (err, result) => (result ? resolve(result) : reject(err))
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      imageUrl = result.secure_url;
    }

    const post = await Post.create({
      title,
      content,
      actor,
      image: imageUrl,
    });

    io.emit("new-post", post);

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= PAYMENT (CRIAR) ================= */

app.post("/card-payment", async (req, res) => {
  try {
    const {
      token,
      paymentMethodId,
      email,
      userId,
      name,
    } = req.body;

    if (!token || !paymentMethodId || !email) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const result = await paymentClient.create({
      body: {
        transaction_amount: 400,
        token,
        description: "Checkout Premium",
        installments: 1,
        payment_method_id: paymentMethodId,
        payer: { email },
      },
    });

    const saved = await PaymentModel.create({
      id: String(result.id),
      name: name || "Pagamento",
      price: 400,
      status: "pending",
      email,
      userId,
      brand: paymentMethodId,
      date: new Date().toISOString(),
    });

    io.emit("new-payment", saved);

    res.json({
      success: true,
      payment: saved,
    });
  } catch (err) {
    console.log("❌ erro payment:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/* ================= CHECK STATUS (MONGO + MP) ================= */

app.get("/payment/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;

    const mpPayment = await paymentClient.get({ id: paymentId });

    const updated = await PaymentModel.findOneAndUpdate(
      { id: paymentId },
      { status: mpPayment.status },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
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