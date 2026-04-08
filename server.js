// server.js
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
const app = express();
const server = http.createServer(app);

const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

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

const postSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    image: String,
    actor: {
      id: String,
      username: String,
      displayName: String,
      avatar: String,
    },
    comments: [
      {
        text: String,
        user: Object,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    likes: [{ id: String, username: String }],
  },
  { timestamps: true }
);
const Post = mongoose.model("Post", postSchema);

const notificationSchema = new mongoose.Schema(
  {
    userId: String,
    type: { type: String, enum: ["like", "comment", "follow", "post"] },
    postId: String,
    actor: {
      id: String,
      username: String,
      displayName: String,
      avatar: String,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Notification = mongoose.model("Notification", notificationSchema);

const messageSchema = new mongoose.Schema(
  {
    senderId: String,
    receiverId: String,
    content: String,
  },
  { timestamps: true }
);
const Message = mongoose.model("Message", messageSchema);

/* ================= ROTA RAIZ ================= */
app.get("/", (req, res) => {
  console.log("⚡ / rota chamada no Render");
  res.send("Servidor rodando no Render! 🚀");
});

/* ================= CHECK FOLLOW ================= */
app.get("/follow/check", async (req, res) => {
  try {
    const { followerId, followingId } = req.query;
    if (!followerId || !followingId) {
      return res.status(400).json({ error: "IDs obrigatórios" });
    }
    const exists = await Follow.findOne({ followerId, followingId });
    res.json({ following: !!exists });
  } catch (err) {
    console.error("Erro check follow:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CORREÇÃO followers/following ================= */
mongoose.connection.once("open", async () => {
  console.log("🔧 Verificando tipos de followers/following...");
  const users = await User.find();
  for (const user of users) {
    const update = {};
    if (!user.followers || typeof user.followers !== "number")
      update.followers = 0;
    if (!user.following || typeof user.following !== "number")
      update.following = 0;
    if (Object.keys(update).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: update });
      console.log(`✅ Corrigido user: ${user.username}`);
    }
  }
  console.log("🔧 Checagem concluída");
});

/* ================= HELPERS ================= */
const fetchClerkUsers = async (query) => {
  try {
    const response = await fetch(
      `https://api.clerk.dev/v1/users?limit=50&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((user) => ({
      clerkId: user.id,
      username: user.username || "user",
      displayName:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.username ||
        "User",
      avatar: user.profile_image_url || "",
    }));
  } catch (err) {
    console.error("Erro fetchClerkUsers:", err);
    return [];
  }
};

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
      displayName:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.username ||
        "User",
      avatar: user.profile_image_url || "",
    };
  } catch (err) {
    console.error("Erro ao buscar usuário Clerk:", err);
    return null;
  }
};

/* ================= CACHE DE USUÁRIOS ================= */
const userCache = new Map();
const getCachedUser = async (userId) => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < 30000) return cached.data;
  const freshUser = await fetchClerkUserById(userId);
  if (freshUser)
    userCache.set(userId, { data: freshUser, timestamp: Date.now() });
  return freshUser;
};

/* ================= USERS ================= */
app.get("/users", async (req, res) => {
  try {
    const { search = "", exclude } = req.query;
    const users = await fetchClerkUsers(search);
    res.json(users.filter((u) => u.clerkId !== exclude));
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

/* ================= MESSAGES (CORRIGIDO) ================= */
app.get("/messages", async (req, res) => {
  try {
    const { user1, user2 } = req.query;

    if (!user1 || !user2) {
      return res.status(400).json({ error: "user1 e user2 são obrigatórios" });
    }

    const msgs = await Message.find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) {
    console.error("Erro ao buscar mensagens:", err);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
});

app.post("/messages", async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const msg = await Message.create({
      senderId,
      receiverId,
      content,
    });

    io.to(senderId).emit("message", msg);
    io.to(receiverId).emit("message", msg);

    res.json(msg);
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

/* ================= SOCKET.IO EVENTS ================= */
io.on("connection", (socket) => {
  console.log("⚡ Socket conectado:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`🔹 Usuário ${userId} entrou na sala`);
  });

  socket.on("disconnect", () => {
    console.log("⚡ Socket desconectado:", socket.id);
  });
});

/* ================= KEEP ALIVE ================= */
setInterval(async () => {
  try {
    await fetch(SERVER_URL);
    console.log("🔄 keep alive");
  } catch (err) {}
}, 1000 * 60 * 10);

/* ================= SERVER LISTEN ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em ${SERVER_URL}`);
});