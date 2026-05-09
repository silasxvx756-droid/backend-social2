import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
  Linking,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";

type Job = {
  _id: string;
  title: string;
  company: string;
  description: string;
  whatsapp: string;

  actor?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
};

type Ad = {
  _id: string;
  typeItem: "ad";
  image: string;
};

type ListItem = Job | Ad;

export default function JobsScreen() {
  const [data, setData] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [appliedJobs, setAppliedJobs] = useState<
    string[]
  >([]);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [category, setCategory] =
    useState("");

  const [company, setCompany] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [whatsapp, setWhatsapp] =
    useState("");

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "https://SEU-RENDER.onrender.com/jobs"
      );

      const jobs = await response.json();

      const mixed: ListItem[] = [];

      jobs.forEach(
        (job: Job, index: number) => {
          mixed.push(job);

          if ((index + 1) % 5 === 0) {
            mixed.push({
              _id:
                "ad-" + index + Date.now(),

              typeItem: "ad",

              image:
                "https://via.placeholder.com/400x200.png?text=Anuncio",
            });
          }
        }
      );

      setData(mixed);
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Erro",
        "Não foi possível carregar os trabalhos"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (
    jobId: string
  ) => {
    if (appliedJobs.includes(jobId))
      return;

    setAppliedJobs((prev) => [
      ...prev,
      jobId,
    ]);

    Alert.alert(
      "Sucesso",
      "Você se candidatou!"
    );
  };

  const handleMessage = (
    phone: string
  ) => {
    const url = `https://wa.me/${phone.replace(
      /\D/g,
      ""
    )}`;

    Linking.openURL(url);
  };

  const handleDeletePost = async (
    jobId: string
  ) => {
    Alert.alert(
      "Apagar postagem",
      "Deseja realmente apagar esta postagem?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },

        {
          text: "Apagar",

          style: "destructive",

          onPress: async () => {
            try {
              await fetch(
                `https://backend-social-app-1.onrender.com/jobs/${jobId}`,
                {
                  method: "DELETE",
                }
              );

              fetchJobs();
            } catch (error) {
              Alert.alert(
                "Erro",
                "Não foi possível apagar"
              );
            }
          },
        },
      ]
    );
  };

  const handlePublishJob =
    async () => {
      if (
        !category ||
        !company ||
        !description ||
        !whatsapp
      ) {
        Alert.alert(
          "Erro",
          "Preencha todos os campos obrigatórios"
        );

        return;
      }

      try {
        const response = await fetch(
          "https://SEU-RENDER.onrender.com/jobs",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title: category,
              company,
              description,
              whatsapp,

              actor: {
                id: "123",
                username: "usuario",
                displayName: "Usuário",
                avatar:
                  "https://i.pravatar.cc/150?img=1",
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            "Erro ao publicar"
          );
        }

        setCategory("");
        setCompany("");
        setDescription("");
        setWhatsapp("");

        setModalVisible(false);

        Alert.alert(
          "Sucesso",
          "Serviço publicado!"
        );

        fetchJobs();
      } catch (error) {
        console.log(error);

        Alert.alert(
          "Erro",
          "Não foi possível publicar"
        );
      }
    };

  const renderItem = ({
    item,
  }: {
    item: ListItem;
  }) => {
    if ("typeItem" in item) {
      return (
        <View style={styles.adCard}>
          <Image
            source={{
              uri: item.image,
            }}
            style={styles.adImage}
          />

          <TouchableOpacity
            style={styles.adButton}
            onPress={() =>
              handleMessage(
                "5599999999999"
              )
            }
          >
            <Text
              style={styles.buttonText}
            >
              Enviar mensagem
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const applied =
      appliedJobs.includes(item._id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>
            {item.title}
          </Text>

          <TouchableOpacity
            onPress={() =>
              handleDeletePost(
                item._id
              )
            }
          >
            <MaterialIcons
              name="more-vert"
              size={24}
              color="#555"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.company}>
          {item.company}
        </Text>

        <Text
          style={styles.description}
        >
          {item.description}
        </Text>

        <TouchableOpacity
          style={[
            styles.adButton,
            { marginTop: 10 },
          ]}
          onPress={() =>
            handleMessage(
              item.whatsapp
            )
          }
        >
          <Text
            style={styles.buttonText}
          >
            WhatsApp
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,

            applied && {
              backgroundColor:
                "#28a745",
            },
          ]}
          onPress={() =>
            handleApply(item._id)
          }
          disabled={applied}
        >
          <Text
            style={styles.buttonText}
          >
            {applied
              ? "Candidatado"
              : "Candidatar"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <View style={styles.topBar}>
        <Text
          style={styles.headerTitle}
        >
          Trabalhos
        </Text>

        <TouchableOpacity
          style={styles.publishButton}
          onPress={() =>
            setModalVisible(true)
          }
        >
          <Text
            style={styles.publishText}
          >
            + Publicar
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) =>
          item._id
        }
        renderItem={renderItem}
      />

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setModalVisible(false)
          }
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={
                  Platform.OS ===
                  "ios"
                    ? "padding"
                    : undefined
                }
                style={styles.modalBox}
              >
                <ScrollView>
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Publicar trabalho
                  </Text>

                  <View
                    style={
                      styles.pickerContainer
                    }
                  >
                    <Picker
                      selectedValue={
                        category
                      }
                      onValueChange={(
                        v
                      ) =>
                        setCategory(v)
                      }
                    >
                      <Picker.Item
                        label="Tipo de trabalho *"
                        value=""
                      />

                      <Picker.Item
                        label="Logo"
                        value="Logo"
                      />

                      <Picker.Item
                        label="Design Gráfico"
                        value="Design Gráfico"
                      />

                      <Picker.Item
                        label="Social Media"
                        value="Social Media"
                      />

                      <Picker.Item
                        label="Thumbnail"
                        value="Thumbnail"
                      />

                      <Picker.Item
                        label="Edição de Vídeo"
                        value="Edição de Vídeo"
                      />
                    </Picker>
                  </View>

                  <TextInput
                    placeholder="Empresa *"
                    style={
                      styles.input
                    }
                    value={company}
                    onChangeText={
                      setCompany
                    }
                  />

                  <TextInput
                    placeholder="Descrição *"
                    style={[
                      styles.input,
                      {
                        height: 100,
                      },
                    ]}
                    multiline
                    value={description}
                    onChangeText={
                      setDescription
                    }
                  />

                  <TextInput
                    placeholder="WhatsApp com DDD *"
                    style={
                      styles.input
                    }
                    value={whatsapp}
                    onChangeText={
                      setWhatsapp
                    }
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    style={
                      styles.publishButton
                    }
                    onPress={
                      handlePublishJob
                    }
                  >
                    <Text
                      style={
                        styles.publishText
                      }
                    >
                      Publicar trabalho
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.publishButton,
                      {
                        backgroundColor:
                          "#ccc",
                      },
                    ]}
                    onPress={() =>
                      setModalVisible(
                        false
                      )
                    }
                  >
                    <Text
                      style={{
                        color: "#000",
                      }}
                    >
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },

  topBar: {
    flexDirection: "row",
    justifyContent:
      "space-between",

    marginBottom: 10,

    alignItems: "center",
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },

  publishButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },

  publishText: {
    color: "#fff",
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent:
      "space-between",

    alignItems: "center",
  },

  title: {
    fontWeight: "bold",
    fontSize: 18,
    flex: 1,
  },

  company: {
    color: "#666",
    marginTop: 4,
  },

  description: {
    marginTop: 8,
    color: "#444",
  },

  button: {
    marginTop: 10,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  adCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },

  adImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
  },

  adButton: {
    marginTop: 10,
    backgroundColor: "#25D366",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,

    backgroundColor:
      "rgba(0,0,0,0.5)",

    justifyContent: "center",

    alignItems: "center",

    padding: 16,
  },

  modalBox: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
});