// PostCreate.tsx
import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";

const API_URL = "https://backend-social-app-1.onrender.com"; // ajuste para sua rede
const MAX_CHARS = 280; // limite de caracteres no texto, opcional

export default function PostCreate() {
  const navigation = useNavigation<any>();
  const { user } = useUser(); // usuário logado via Clerk

  const [content, setContent] = useState("");
  const [image, setImage] = useState<any>(null);
  const [posting, setPosting] = useState(false);

  // Escolher imagem da galeria
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      console.log("Permissão necessária para acessar a galeria");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  // Criar post
  const handleCreatePost = async () => {
    if (!image) {
      console.log("A postagem precisa de uma imagem");
      return;
    }

    if (!user) {
      console.log("Usuário não logado");
      return;
    }

    try {
      setPosting(true);
      const form = new FormData();
      form.append("title", "Post");
      form.append("content", content);

      const actor = {
        id: user.id,
        username: user.username || `user_${user.id.slice(-6)}`,
        displayName: user.fullName || user.username || `User_${user.id.slice(-6)}`,
        avatar: user.imageUrl || "",
      };
      form.append("actor", JSON.stringify(actor));

      console.log("=== Criando novo post ===");
      console.log("Nome:", actor.displayName);
      console.log("Avatar:", actor.avatar);
      console.log("Conteúdo:", content);
      console.log("Imagem URI:", image.uri);
      console.log("=========================");

      // Adiciona imagem
      const uriParts = image.uri.split(".");
      const fileType = uriParts[uriParts.length - 1];
      form.append("image", {
        uri: image.uri,
        name: `photo.${fileType}`,
        type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
      } as any);

      const res = await fetch(`${API_URL}/posts/upload`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Erro ao postar");

      console.log("Post criado com sucesso!");
      navigation.goBack();
    } catch (err) {
      console.error("Erro ao criar post:", err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Botão X no topo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.innerContainer}
      >
        <TextInput
          placeholder="Escreva algo (opcional)..."
          value={content}
          onChangeText={(text) => {
            if (text.length <= MAX_CHARS) setContent(text);
          }}
          multiline
          style={styles.input}
        />

        {/* Contagem de caracteres */}
        <Text style={styles.charCount}>
          {content.length}/{MAX_CHARS}
        </Text>

        {image && <Image source={{ uri: image.uri }} style={styles.imagePreview} />}

        <TouchableOpacity onPress={pickImage} style={styles.addImageButton}>
          <Ionicons name="image-outline" size={24} color="#000" />
          <Text style={styles.addImageText}>
            {image ? "Alterar Imagem" : "Adicionar Imagem"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCreatePost}
          disabled={posting || !image} // só ativa se houver imagem
          style={[
            styles.postButton,
            { backgroundColor: !image ? "#888" : "#000" }, // cinza se desativado
          ]}
        >
          <Text style={styles.postButtonText}>
            {posting ? "Postando..." : "Postar"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
    marginTop: 20,
  },
  innerContainer: { width: "100%", alignItems: "center", marginTop: 40 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 10,
    minHeight: 100,
    width: "100%",
    marginBottom: 4,
    textAlignVertical: "top",
  },
  charCount: {
    alignSelf: "flex-end",
    marginBottom: 12,
    color: "#555",
    fontSize: 12,
  },
  imagePreview: { width: "100%", height: 200, marginVertical: 12, borderRadius: 12 },
  addImageButton: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  addImageText: { marginLeft: 8, color: "#000", fontSize: 16 },
  postButton: { padding: 12, borderRadius: 12, width: "100%" },
  postButtonText: { color: "#fff", textAlign: "center", fontSize: 16 },
});