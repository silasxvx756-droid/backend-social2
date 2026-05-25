import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  useColorScheme,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";

export default function EditProfileScreen() {
  const { user, isLoaded } = useUser();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const navigation = useNavigation();

  const API = "https://backend-social-app-1.onrender.com/jobs";

  const [formData, setFormData] = useState({
    firstName: "",
    whatsapp: "",
    bio: "",
  });

  const [imageUploading, setImageUploading] = useState(false);

  /* ================= LOAD USER ================= */
  useEffect(() => {
    if (isLoaded && user) {
      setFormData({
        firstName: user.firstName || "",
        whatsapp: (user.unsafeMetadata?.whatsapp as string) || "",
        bio: (user.unsafeMetadata?.bio as string) || "",
      });

      fetch(`${API}/users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          displayName: user.firstName,
          avatar: user.imageUrl,
          whatsapp: user.unsafeMetadata?.whatsapp || "",
          bio: user.unsafeMetadata?.bio || "",
        }),
      }).catch(() => {});
    }
  }, [isLoaded, user]);

  /* ================= FORM ================= */
  const updateFormField = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* ================= IMAGE PICKER ================= */
  const getMediaType = () => {
    if ((ImagePicker as any).MediaType) {
      return (ImagePicker as any).MediaType.Images;
    }

    return (ImagePicker as any).MediaTypeOptions.Images;
  };

  /* ================= PICK IMAGE ================= */
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: getMediaType(),
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const localUri = result.assets[0].uri;

        setImageUploading(true);

        try {
          await user?.setProfileImage({
            file: {
              uri: localUri,
              name: "avatar.jpg",
              type: "image/jpeg",
            } as any,
          });
        } catch (error) {
          console.error("Erro upload:", error);
          Alert.alert("Erro", "Falha ao enviar imagem");
        } finally {
          setImageUploading(false);
        }
      }
    } catch (error) {
      console.error("Erro ao abrir galeria:", error);
    }
  };

  /* ================= SAVE ================= */
  const handleSaveProfile = async () => {
    try {
      await user?.update({
        firstName: formData.firstName,
        unsafeMetadata: {
          whatsapp: formData.whatsapp,
          bio: formData.bio,
        },
      });

      await fetch(`${API}/users/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user?.id,
          displayName: formData.firstName,
          avatar: user?.imageUrl,
          whatsapp: formData.whatsapp,
          bio: formData.bio,
        }),
      });

      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar");
    }
  };

  /* ================= UI ================= */
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? "#000" : "#fff",
      }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 16,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{
          position: "absolute",
          top: insets.top + 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          ×
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: isDarkMode ? "#fff" : "#000",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Editar Perfil
      </Text>

      {/* FOTO */}
      <TouchableOpacity
        onPress={pickImage}
        style={{
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Animated.Image
          source={{ uri: user?.imageUrl }}
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            marginBottom: 8,
          }}
        />

        {imageUploading && (
          <ActivityIndicator
            style={{
              position: "absolute",
              top: 40,
            }}
            size="large"
          />
        )}

        <Text
          style={{
            color: isDarkMode ? "#ccc" : "#666",
          }}
        >
          Toque para trocar foto
        </Text>
      </TouchableOpacity>

      {/* NOME */}
      <TextInput
        placeholder="Nome"
        placeholderTextColor={isDarkMode ? "#555" : "#aaa"}
        value={formData.firstName}
        onChangeText={(t) =>
          updateFormField("firstName", t)
        }
        style={{
          borderWidth: 1,
          borderColor: isDarkMode ? "#333" : "#ddd",
          padding: 12,
          borderRadius: 8,
          color: isDarkMode ? "#fff" : "#000",
          marginBottom: 16,
        }}
      />

      {/* WHATSAPP */}
      <TextInput
        placeholder="WhatsApp"
        placeholderTextColor={isDarkMode ? "#555" : "#aaa"}
        value={formData.whatsapp}
        onChangeText={(t) =>
          updateFormField("whatsapp", t)
        }
        keyboardType="phone-pad"
        style={{
          borderWidth: 1,
          borderColor: isDarkMode ? "#333" : "#ddd",
          padding: 12,
          borderRadius: 8,
          color: isDarkMode ? "#fff" : "#000",
          marginBottom: 16,
        }}
      />

      {/* BIO */}
      <TextInput
        placeholder="Biografia"
        placeholderTextColor={isDarkMode ? "#555" : "#aaa"}
        value={formData.bio}
        onChangeText={(t) =>
          updateFormField("bio", t)
        }
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{
          borderWidth: 1,
          borderColor: isDarkMode ? "#333" : "#ddd",
          padding: 12,
          borderRadius: 8,
          color: isDarkMode ? "#fff" : "#000",
          marginBottom: 20,
          minHeight: 120,
        }}
      />

      {/* BOTÃO */}
      <TouchableOpacity
        onPress={handleSaveProfile}
        style={{
          padding: 14,
          backgroundColor: isDarkMode ? "#fff" : "#000",
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: isDarkMode ? "#000" : "#fff",
            fontWeight: "600",
          }}
        >
          Salvar
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}