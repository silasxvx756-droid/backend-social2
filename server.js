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

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
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
  .catch((err) =>
    console.log("❌ Mongo erro:", err)
  );

/* ================= MODELS ================= */

const userSchema = new mongoose.Schema({
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

const Follow = mongoose.model(
  "Follow",
  followSchema
);

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
  { timestamps: true }
);

const Post = mongoose.model(
  "Post",
  postSchema
);

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
    { timestamps: true }
  );

const Notification =
  mongoose.model(
    "Notification",
    notificationSchema
  );

const messageSchema =
  new mongoose.Schema(
    {
      senderId: String,
      receiverId: String,
      content: String,
    },
    { timestamps: true }
  );

const Message = mongoose.model(
  "Message",
  messageSchema
);

/* ================= JOBS ================= */

const jobSchema = new mongoose.Schema(
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
  { timestamps: true }
);

const Job = mongoose.model(
  "Job",
  jobSchema
);

/* ================= ROOT ================= */

app.get("/", (req, res) => {
  res.send(
    "Servidor rodando 🚀"
  );
});

/* ================= HELPERS ================= */

const fetchClerkUserById = async (
  clerkId
) => {
  try {
    const response = await fetch(
      `https://api.clerk.dev/v1/users/${clerkId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) return null;

    const user =
      await response.json();

    return {
      clerkId: user.id,
      username:
        user.username ||
        `user_${user.id.slice(-6)}`,

      displayName:
        `${
          user.first_name || ""
        } ${
          user.last_name || ""
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

const userCache = new Map();

const getCachedUser = async (
  userId
) => {
  const cached =
    userCache.get(userId);

  if (
    cached &&
    Date.now() -
      cached.timestamp <
      30000
  ) {
    return cached.data;
  }

  const freshUser =
    await fetchClerkUserById(
      userId
    );

  if (freshUser) {
    userCache.set(userId, {
      data: freshUser,
      timestamp: Date.now(),
    });
  }

  return freshUser;
};

/* ================= POSTS ================= */

app.get("/posts", async (req, res) => {
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
});

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
        actor = JSON.parse(actor);
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

      res
        .status(201)
        .json(post);
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

app.delete(
  "/posts/:id",
  async (req, res) => {
    try {
      const deleted =
        await Post.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res
          .status(404)
          .json({
            error:
              "Post não encontrado",
          });
      }

      res.json({
        success: true,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

/* ================= JOBS ROUTES ================= */

// LISTAR JOBS
app.get("/jobs", async (req, res) => {
  try {
    const jobs =
      await Job.find().sort({
        createdAt: -1,
      });

    const updatedJobs =
      await Promise.all(
        jobs.map(async (job) => {
          const freshUser =
            await getCachedUser(
              job.actor?.id
            );

          return {
            ...job.toObject(),

            actor: freshUser
              ? {
                  id: freshUser.clerkId,
                  username:
                    freshUser.username,
                  displayName:
                    freshUser.displayName,
                  avatar:
                    freshUser.avatar,
                }
              : job.actor,
          };
        })
      );

    res.json(updatedJobs);
  } catch (err) {
    console.error(
      "Erro /jobs:",
      err
    );

    res.status(500).json({
      error: err.message,
    });
  }
});

// CRIAR JOB
app.post(
  "/jobs",
  async (req, res) => {
    try {
      const {
        title,
        company,
        description,
        whatsapp,
        actor,
      } = req.body;

      if (
        !title ||
        !company ||
        !description ||
        !whatsapp
      ) {
        return res
          .status(400)
          .json({
            error:
              "Campos obrigatórios",
          });
      }

      const freshUser =
        await fetchClerkUserById(
          actor?.id
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

      const job =
        await Job.create({
          title,
          company,
          description,
          whatsapp,
          actor: finalActor,
        });

      io.emit(
        "new-job",
        job
      );

      res
        .status(201)
        .json(job);
    } catch (err) {
      console.error(
        "Erro criar job:",
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// JOB POR ID
app.get(
  "/jobs/:id",
  async (req, res) => {
    try {
      const job =
        await Job.findById(
          req.params.id
        );

      if (!job) {
        return res
          .status(404)
          .json({
            error:
              "Job não encontrado",
          });
      }

      res.json(job);
    } catch (err) {
      console.error(
        "Erro /jobs/:id",
        err
      );

      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// APAGAR JOB
app.delete(
  "/jobs/:id",
  async (req, res) => {
    try {
      const deleted =
        await Job.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res
          .status(404)
          .json({
            error:
              "Job não encontrado",
          });
      }

      io.emit(
        "delete-job",
        req.params.id
      );

      res.json({
        success: true,
      });
    } catch (err) {
      console.error(
        "Erro delete job:",
        err
      );

      res.status(500).json({
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

server.listen(PORT, () => {
  console.log(
    `🚀 Servidor rodando na porta ${PORT}`
  );
});