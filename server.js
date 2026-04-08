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

const SERVER_URL = process.env.SERVER_URL || "https://backend-social-app-1.onrender.com";

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
  if (freshUser) userCache.set(userId, { data: freshUser, timestamp: Date.now() });
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

app.get("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    let user = await User.findOne({ username });

    if (!user) {
      const users = await fetchClerkUsers(username);
      const u = users[0];
      if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
      user = await User.create({
        id: u.clerkId,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
      });
    }

    const postsCount = await Post.countDocuments({ "actor.id": user.id });
    const followersCount = await Follow.countDocuments({ followingId: user.id });
    const followingCount = await Follow.countDocuments({ followerId: user.id });

    res.json({
      username: user.username,
      displayName: user.displayName,
      bio: user.bio || "",
      avatar: user.avatar || "",
      followers: followersCount,
      following: followingCount,
      posts: postsCount,
      clerkId: user.id,
    });
  } catch (err) {
    console.error("Erro /users/:username:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= FOLLOWERS / FOLLOWING ================= */
app.get("/followers/:clerkId", async (req, res) => {
  try {
    const { clerkId } = req.params;
    const followers = await Follow.find({ followingId: clerkId });
    const users = await Promise.all(followers.map(f => fetchClerkUserById(f.followerId)));
    res.json(users.filter(Boolean));
  } catch (err) {
    console.error("Erro /followers/:clerkId:", err);
    res.status(500).json({ error: "Erro ao buscar seguidores" });
  }
});

app.get("/following/:clerkId", async (req, res) => {
  try {
    const { clerkId } = req.params;
    const following = await Follow.find({ followerId: clerkId });
    const users = await Promise.all(following.map(f => fetchClerkUserById(f.followingId)));
    res.json(users.filter(Boolean));
  } catch (err) {
    console.error("Erro /following/:clerkId:", err);
    res.status(500).json({ error: "Erro ao buscar seguindo" });
  }
});

/* ================= FOLLOW / UNFOLLOW ================= */
app.post("/follow", async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    const exists = await Follow.findOne({ followerId, followingId });

    if (!exists) {
      await Follow.create({ followerId, followingId });
      await User.updateOne({ id: followingId }, { $inc: { followers: 1 } }, { upsert: true });
      await User.updateOne({ id: followerId }, { $inc: { following: 1 } }, { upsert: true });

      const freshFollowerUser = await fetchClerkUserById(followerId);
      if (freshFollowerUser) {
        userCache.set(followerId, { data: freshFollowerUser, timestamp: Date.now() });
        const notification = await Notification.create({
          userId: followingId,
          type: "follow",
          actor: freshFollowerUser,
          read: false,
        });
        io.to(followingId).emit("notification", {
          ...notification.toObject(),
          actor: freshFollowerUser,
        });
      }
    }

    res.json({ success: true, following: !exists });
  } catch (err) {
    console.error("Erro follow:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/unfollow", async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    const deleted = await Follow.findOneAndDelete({ followerId, followingId });
    if (deleted) {
      await User.updateOne({ id: followingId }, { $inc: { followers: -1 } });
      await User.updateOne({ id: followerId }, { $inc: { following: -1 } });
    }
    res.json({ success: true, following: false });
  } catch (err) {
    console.error("Erro unfollow:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= POSTS ================= */
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    const updatedPosts = await Promise.all(
      posts.map(async (post) => {
        const freshUser = await getCachedUser(post.actor.id);
        return {
          ...post.toObject(),
          actor: freshUser
            ? {
                id: freshUser.clerkId,
                username: freshUser.username,
                displayName: freshUser.displayName,
                avatar: freshUser.avatar,
              }
            : post.actor,
        };
      })
    );
    res.json(updatedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/upload", upload.single("image"), async (req, res) => {
  try {
    let { title, content, actor } = req.body;
    if (typeof actor === "string") actor = JSON.parse(actor);

    const freshUser = await fetchClerkUserById(actor.id);
    const finalActor = freshUser
      ? {
          id: freshUser.clerkId,
          username: freshUser.username,
          displayName: freshUser.displayName,
          avatar: freshUser.avatar,
        }
      : actor;

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

    const post = await Post.create({ title, content, actor: finalActor, image: imageUrl });
    await Notification.create({ userId: finalActor.id, type: "post", postId: String(post._id), actor: finalActor });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post não encontrado" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "ID inválido" });
  }
});

app.delete("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: "Post não encontrado" });
    await Notification.deleteMany({ postId: String(post._id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/:id/like", async (req, res) => {
  try {
    const { user } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post não encontrado" });
    const liked = post.likes.find((u) => u.id === user.id);
    if (liked) post.likes = post.likes.filter((u) => u.id !== user.id);
    else {
      post.likes.push({ id: user.id, username: user.username });
      await Notification.create({
        userId: post.actor.id,
        type: "like",
        postId: String(post._id),
        actor: user,
      });
    }
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/:id/comments", async (req, res) => {
  try {
    const { text, user } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post não encontrado" });
    const comment = { text, user, createdAt: new Date() };
    post.comments.push(comment);
    await post.save();
    await Notification.create({
      userId: post.actor.id,
      type: "comment",
      postId: String(post._id),
      actor: user,
    });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= MESSAGES ================= */
app.get("/messages", async (req, res) => {
  const { user1, user2 } = req.query;
  const msgs = await Message.find({
    $or: [
      { senderId: user1, receiverId: user2 },
      { senderId: user2, receiverId: user1 },
    ],
  }).sort({ createdAt: 1 });
  res.json(msgs);
});

app.post("/messages", async (req, res) => {
  try {
    const msg = await Message.create(req.body);
    // 🔹 Envia para todos conectados na sala do usuário
    io.to(msg.senderId).emit("message", msg);
    io.to(msg.receiverId).emit("message", msg);
    res.json(msg);
  } catch (err) {
    console.error("Erro enviar mensagem:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= NOTIFICATIONS ================= */
app.get("/api/notifications/:userId", async (req, res) => {
  const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  const updatedNotifications = await Promise.all(notifications.map(async (n) => {
    const freshActor = await getCachedUser(n.actor.id);
    return {
      ...n.toObject(),
      actor: freshActor || n.actor
    };
  }));
  res.json(updatedNotifications);
});

app.post("/api/notifications/:id/read", async (req, res) => {
  const updated = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  res.json(updated);
});

app.post("/api/notifications/read-all", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });
    await Notification.updateMany({ userId: String(userId), read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= ATUALIZAR AVATAR / NOME NAS NOTIFICAÇÕES ================= */
app.post("/users/:clerkId/update-profile", async (req, res) => {
  try {
    const { clerkId } = req.params;
    const { displayName, avatar } = req.body;
    await User.updateOne({ id: clerkId }, { $set: { displayName, avatar } });
    await Notification.updateMany({ "actor.id": clerkId }, { $set: { "actor.displayName": displayName, "actor.avatar": avatar } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SOCKET.IO ================= */
io.on("connection", (socket) => {
  console.log("🔌 Novo socket conectado:", socket.id);

  // 🔹 Usuário entra na sala do próprio ID
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`🟢 User ${userId} entrou na sala.`);
  });

  socket.on("disconnect", () => {
    console.log("⚡ Socket desconectado:", socket.id);
  });
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em: ${SERVER_URL}`);
});