import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

dotenv.config();
const app = express();
const server = http.createServer(app);

// ================== CORS ==================
app.use(cors({
  origin: "*", // ou coloque a URL do seu app se quiser restringir
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

// ================== MONGO ==================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB conectado"))
.catch((err) => console.log("❌ Erro MongoDB:", err));

// ================== MODELOS ==================
const messageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  clerkId: String,
  username: String,
  displayName: String,
  avatar: String,
});

const Message = mongoose.model("Message", messageSchema);
const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket conectado:", socket.id);

  socket.on("join", (userId) => {
    console.log(`🟢 Usuário ${userId} entrou na sala`);
    socket.join(userId); // sala por usuário
  });

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, content } = data;

    const msg = await Message.create({
      senderId,
      receiverId,
      content,
    });

    io.to(receiverId).emit("message", msg); // envia para receptor
    io.to(senderId).emit("message", msg);   // envia de volta pro sender
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket desconectado:", socket.id);
  });
});

// ================== ROTAS HTTP ==================
// Users
app.get("/users/:clerkId", async (req, res) => {
  const user = await User.findOne({ clerkId: req.params.clerkId });
  if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
  res.json(user);
});

app.get("/users", async (req, res) => {
  const exclude = req.query.exclude;
  const users = await User.find(exclude ? { clerkId: { $ne: exclude } } : {});
  res.json(users);
});

// Messages
app.get("/messages", async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ message: "Faltam parâmetros" });
  const messages = await Message.find({
    $or: [
      { senderId: user1, receiverId: user2 },
      { senderId: user2, receiverId: user1 },
    ],
  }).sort({ createdAt: 1 });
  res.json(messages);
});

app.post("/messages", async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  const msg = await Message.create({ senderId, receiverId, content });
  io.to(receiverId).emit("message", msg); // envia via socket
  res.json(msg);
});

// ================== INICIALIZAÇÃO ==================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server rodando na porta ${PORT}`));