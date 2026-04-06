import { useState, useCallback, useEffect } from "react";

/* -----------------------------------
   Interfaces
----------------------------------- */
export interface PostUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
}

export interface Comment {
  text: string;
  createdAt: string;
  user: PostUser;
}

export interface Like {
  id: string;
  username: string;
}

export interface Post {
  _id: string;
  title?: string;
  content: string;
  image?: string;
  likes?: Like[];
  comments?: Comment[];
  createdAt: string;
}

/* -----------------------------------
   Backend
----------------------------------- */
const API_URL = "http://192.168.0.102:3000";

/* -----------------------------------
   Hook usePosts
----------------------------------- */
export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);

  /* =============================
     🔄 Carregar posts
  ============================= */
  const reload = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/posts`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      console.error("Erro carregando posts:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /* =============================
     ➕ Criar post (com ou sem imagem)
  ============================= */
  const addPost = useCallback(
    async ({
      content,
      imageUri,
    }: {
      content: string;
      imageUri?: string;
    }) => {
      try {
        if (!imageUri) {
          const response = await fetch(`${API_URL}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "", content }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const newPost: Post = await response.json();
          setPosts((prev) => [newPost, ...prev]);
          return newPost;
        }

        // Upload de imagem
        const formData = new FormData();
        formData.append("title", "");
        formData.append("content", content);

        const filename = imageUri.split("/").pop() || `photo_${Date.now()}.jpg`;
        formData.append("image", {
          uri: imageUri,
          name: filename,
          type: "image/jpeg",
        } as any);

        const response = await fetch(`${API_URL}/posts/upload`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const newPost: Post = await response.json();
        setPosts((prev) => [newPost, ...prev]);
        return newPost;
      } catch (err) {
        console.error("Erro ao criar post:", err);
        throw err;
      }
    },
    []
  );

  /* =============================
     💬 Comentar em um post
  ============================= */
  const addComment = useCallback(
    async (postId: string, text: string, user: PostUser) => {
      try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, user }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const updatedComments: Comment[] = await response.json();
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, comments: updatedComments } : p))
        );
        return updatedComments;
      } catch (err) {
        console.error("Erro ao comentar:", err);
        throw err;
      }
    },
    []
  );

  /* =============================
     ❤️ Curtir / descurtir post
  ============================= */
  const toggleLike = useCallback(
    async (postId: string, user: PostUser) => {
      try {
        const response = await fetch(`${API_URL}/posts/${postId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const updatedLikes: Like[] = await response.json();
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, likes: updatedLikes } : p))
        );
        return updatedLikes;
      } catch (err) {
        console.error("Erro ao curtir:", err);
        throw err;
      }
    },
    []
  );

  return { posts, loaded, reload, addPost, addComment, toggleLike };
};