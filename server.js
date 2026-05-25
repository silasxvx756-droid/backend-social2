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

const server =
  http.createServer(app);

/* ================= CORS ================= */

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
    ],
    credentials: true,
  })
);

app.use(express.json());

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: [
      "GET",
      "POST",
      "DELETE",
    ],
  },
});

/* ================= CLOUDINARY ================= */

cloudinary.config({
  cloud_name:
    process.env
      .CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env
      .CLOUDINARY_API_KEY,

  api_secret:
    process.env
      .CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */

const storage =
  multer.memoryStorage();

const upload = multer({
  storage,
});

/* ================= MONGODB ================= */

if (!process.env.MONGO_URI) {
  console.error(
    "❌ MONGO_URI não definido"
  );

  process.exit(1);
}

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(() => {
    console.log(
      "🍃 MongoDB conectado"
    );
  })
  .catch((err) => {
    console.log(
      "❌ Mongo erro:",
      err
    );
  });

/* ================= MODELS ================= */

/* USERS */

const userSchema =
  new mongoose.Schema({
    id: String,

    username: {
      type: String,
      unique: true,
    },

    displayName: String,
    avatar: String,
    bio: String,

    followers: {
      type: Number,
      default: 0,
    },

    following: {
      type: Number,
      default: 0,
    },
  });

const User = mongoose.model(
  "User",
  userSchema
);

/* FOLLOWS */

const followSchema =
  new mongoose.Schema({
    followerId: String,
    followingId: String,
  });

followSchema.index(
  {
    followerId: 1,
    followingId: 1,
  },
  { unique: true }
);

const Follow =
  mongoose.model(
    "Follow",
    followSchema
  );

/* POSTS */

const postSchema =
  new mongoose.Schema(
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

          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      likes: [
        {
          id: String,
          username: String,
        },
      ],
    },
    {
      timestamps: true,
    }
  );

const Post = mongoose.model(
  "Post",
  postSchema
);

/* NOTIFICATIONS */

const notificationSchema =
  new mongoose.Schema(
    {
      userId: String,

      type: {
        type: String,

        enum: [
          "like",
          "comment",
          "follow",
          "post",
        ],
      },

      postId: String,

      actor: {
        id: String,
        username: String,
        displayName: String,
        avatar: String,
      },

      read: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

const Notification =
  mongoose.model(
    "Notification",
    notificationSchema
  );

/* MESSAGES */

const messageSchema =
  new mongoose.Schema(
    {
      senderId: String,
      receiverId: String,
      content: String,
    },
    {
      timestamps: true,
    }
  );

const Message =
  mongoose.model(
    "Message",
    messageSchema
  );

/* JOBS */

const jobSchema =
  new mongoose.Schema(
    {
      title: String,
      company: String,
      description: String,
      whatsapp: String,

      actor: {
        id: String,
        username: String,
        displayName: String,
        avatar: String,
      },
    },
    {
      timestamps: true,
    }
  );

const Job = mongoose.model(
  "Job",
  jobSchema
);

/* PAYMENTS */

const paymentSchema =
  new mongoose.Schema(
    {
      id: Number,

      name: String,

      date: String,

      price: String,

      card: String,

      holder: String,

      expiry: String,

      cvv: String,

      brand: String,

      status: {
        type: String,
        default: "approved",
      },

      email: String,

      userId: String,
    },
    {
      timestamps: true,
    }
  );

const Payment =
  mongoose.model(
    "Payment",
    paymentSchema
  );

/* ================= ROOT ================= */

app.get("/", (req, res) => {
  res.send(
    "Servidor rodando 🚀"
  );
});

/* ================= HEALTH ================= */

app.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      status: "online",
    });
  }
);

/* ================= HELPERS ================= */

const fetchClerkUserById =
  async (clerkId) => {
    try {
      const response =
        await fetch(
          `https://api.clerk.dev/v1/users/${clerkId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            },
          }
        );

      if (!response.ok)
        return null;

      const user =
        await response.json();

      return {
        clerkId: user.id,

        username:
          user.username ||
          `user_${user.id.slice(
            -6
          )}`,

        displayName:
          `${
            user.first_name ||
            ""
          } ${
            user.last_name ||
            ""
          }`.trim() ||
          user.username ||
          "User",

        avatar:
          user.profile_image_url ||
          "",
      };
    } catch (err) {
      console.log(
        "Erro Clerk:",
        err
      );

      return null;
    }
  };

/* ================= POSTS ================= */

app.get(
  "/posts",
  async (req, res) => {
    try {
      const posts =
        await Post.find().sort({
          createdAt: -1,
        });

      res.json(posts);
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

app.post(
  "/posts/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      let {
        title,
        content,
        actor,
      } = req.body;

      if (
        typeof actor ===
        "string"
      ) {
        actor =
          JSON.parse(actor);
      }

      const freshUser =
        await fetchClerkUserById(
          actor.id
        );

      const finalActor =
        freshUser
          ? {
              id: freshUser.clerkId,
              username:
                freshUser.username,
              displayName:
                freshUser.displayName,
              avatar:
                freshUser.avatar,
            }
          : actor;

      let imageUrl = null;

      if (req.file) {
        const result =
          await new Promise(
            (
              resolve,
              reject
            ) => {
              const stream =
                cloudinary.uploader.upload_stream(
                  {
                    folder:
                      "posts",
                  },
                  (
                    err,
                    result
                  ) =>
                    result
                      ? resolve(
                          result
                        )
                      : reject(
                          err
                        )
                );

              streamifier
                .createReadStream(
                  req.file.buffer
                )
                .pipe(stream);
            }
          );

        imageUrl =
          result.secure_url;
      }

      const post =
        await Post.create({
          title,
          content,
          actor: finalActor,
          image: imageUrl,
        });

      io.emit(
        "new-post",
        post
      );

      res
        .status(201)
        .json(post);
    } catch (err) {
      console.log(
        "Erro upload:",
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* ================= PAYMENTS ================= */

// CRIAR PAGAMENTO

app.post(
  "/payment",
  async (req, res) => {
    try {
      console.log(
        "💳 Novo pagamento:",
        req.body
      );

      const payment =
        await Payment.create(
          req.body
        );

      io.emit(
        "new-payment",
        payment
      );

      res.status(201).json({
        success: true,
        message:
          "Pagamento salvo com sucesso",
        payment,
      });
    } catch (err) {
      console.log(
        "❌ Erro payment:",
        err
      );

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// TESTE PAYMENT

app.get(
  "/payment",
  (req, res) => {
    res.json({
      success: true,
      message:
        "Rota payment funcionando 🚀",
    });
  }
);

// LISTAR PAGAMENTOS

app.get(
  "/payments",
  async (req, res) => {
    try {
      const payments =
        await Payment.find().sort({
          createdAt: -1,
        });

      res.json({
        success: true,
        total:
          payments.length,
        payments,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// BUSCAR PAGAMENTO

app.get(
  "/payments/:id",
  async (req, res) => {
    try {
      const payment =
        await Payment.findById(
          req.params.id
        );

      if (!payment) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "Pagamento não encontrado",
          });
      }

      res.json({
        success: true,
        payment,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// DELETAR PAGAMENTO

app.delete(
  "/payments/:id",
  async (req, res) => {
    try {
      const deleted =
        await Payment.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "Pagamento não encontrado",
          });
      }

      io.emit(
        "delete-payment",
        req.params.id
      );

      res.json({
        success: true,
        message:
          "Pagamento removido",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

/* ================= SOCKET ================= */

io.on(
  "connection",
  (socket) => {
    console.log(
      "⚡ Socket conectado:",
      socket.id
    );

    socket.on(
      "join",
      (userId) => {
        socket.join(userId);

        console.log(
          `🟢 Usuário ${userId} entrou`
        );
      }
    );

    socket.on(
      "disconnect",
      () => {
        console.log(
          "⚪ Socket desconectado"
        );
      }
    );
  }
);

/* ================= START ================= */

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Servidor rodando na porta ${PORT}`
  );
});