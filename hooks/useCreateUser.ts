// src/hooks/useCreateUser.ts
export const createUserOnBackend = async (user: {
  clerkId: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}) => {
  try {
    const response = await fetch("http://192.168.0.102:3000/api/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clerkId: user.clerkId,       // ⚠️ obrigatório
        username: user.username,
        displayName: user.fullName,
        avatar: user.avatarUrl || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar/atualizar usuário: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Usuário criado/atualizado no backend:", data);
    return data;
  } catch (err) {
    console.error("Erro no backend:", err);
    return null;
  }
};