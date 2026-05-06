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

const API_URL = "https://backend-social-app-1.onrender.com";

type Job = {
  _id: string;
  typeItem: "job";
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  whatsapp: string;
};

type Ad = {
  id: string;
  typeItem: "ad";
  image: string;
};

type ListItem = Job | Ad;

export default function JobsScreen() {
  const [data, setData] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [category, setCategory] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // ================= FETCH JOBS =================
  const fetchJobs = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/jobs`);
      const json = await res.json();

      console.log("API /jobs =>", json);

      const jobsArray = Array.isArray(json)
        ? json
        : json?.jobs || [];

      if (!jobsArray.length) {
        setData([
          {
            _id: "empty",
            typeItem: "job",
            title: "Nenhuma vaga disponível",
            company: "Sistema",
            location: "-",
            type: "-",
            description: "Ainda não existem vagas cadastradas no banco.",
            whatsapp: "5599999999999",
          },
        ]);
        return;
      }

      const formatted: Job[] = jobsArray.map((job: any) => ({
        _id: job._id,
        typeItem: "job",
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        description: job.description,
        whatsapp: job.whatsapp,
      }));

      const mixed: ListItem[] = [];

      formatted.forEach((job, index) => {
        mixed.push(job);

        if ((index + 1) % 5 === 0) {
          mixed.push({
            id: "ad-" + index,
            typeItem: "ad",
            image: "https://via.placeholder.com/400x200.png?text=Anuncio",
          });
        }
      });

      setData(mixed);
    } catch (err) {
      console.log("Erro fetchJobs:", err);

      setData([
        {
          _id: "error",
          typeItem: "job",
          title: "Erro ao carregar vagas",
          company: "API offline",
          location: "-",
          type: "-",
          description: "Verifique conexão com o backend /jobs",
          whatsapp: "5599999999999",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // ================= APPLY =================
  const handleApply = (id: string) => {
    if (appliedJobs.includes(id)) return;
    setAppliedJobs((prev) => [...prev, id]);
    Alert.alert("Sucesso", "Você se candidatou!");
  };

  // ================= WHATSAPP =================
  const handleMessage = (phone: string) => {
    const url = `https://wa.me/${phone.replace(/\D/g, "")}`;
    Linking.openURL(url);
  };

  // ================= CREATE JOB =================
  const handlePublishJob = async () => {
    if (!category || !company || !description || !type || !whatsapp) {
      Alert.alert("Erro", "Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: category,
          company,
          location: location || "Não informado",
          type,
          description,
          whatsapp,
        }),
      });

      const newJob = await res.json();

      setData((prev) => [
        {
          _id: newJob._id,
          typeItem: "job",
          title: newJob.title,
          company: newJob.company,
          location: newJob.location,
          type: newJob.type,
          description: newJob.description,
          whatsapp: newJob.whatsapp,
        },
        ...prev,
      ]);

      setModalVisible(false);

      setCategory("");
      setCompany("");
      setLocation("");
      setType("");
      setDescription("");
      setWhatsapp("");

      Alert.alert("Sucesso", "Vaga publicada!");
    } catch (err) {
      Alert.alert("Erro", "Não foi possível publicar");
    }
  };

  // ================= RENDER =================
  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.typeItem === "ad") {
      return (
        <View style={styles.adCard}>
          <Image source={{ uri: item.image }} style={styles.adImage} />
          <TouchableOpacity
            style={styles.adButton}
            onPress={() => handleMessage("5599999999999")}
          >
            <Text style={styles.buttonText}>Enviar mensagem</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const applied = appliedJobs.includes(item._id);

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.company}>{item.company}</Text>
        <Text style={styles.location}>📍 {item.location}</Text>
        <Text style={styles.description}>{item.description}</Text>

        <Text style={styles.typeBadge}>{item.type}</Text>

        <TouchableOpacity
          style={styles.adButton}
          onPress={() => handleMessage(item.whatsapp)}
        >
          <Text style={styles.buttonText}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, applied && { backgroundColor: "#28a745" }]}
          onPress={() => handleApply(item._id)}
          disabled={applied}
        >
          <Text style={styles.buttonText}>
            {applied ? "Candidatado" : "Candidatar"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ================= UI =================
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>Vagas</Text>

        <TouchableOpacity
          style={styles.publishButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.publishText}>+ Publicar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item: any) => item._id || item.id}
        renderItem={renderItem}
      />

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalBox}
              >
                <ScrollView>
                  <Text style={styles.modalTitle}>Publicar vaga</Text>

                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={category} onValueChange={setCategory}>
                      <Picker.Item label="Categoria *" value="" />
                      <Picker.Item label="Frontend" value="Frontend" />
                      <Picker.Item label="Backend" value="Backend" />
                      <Picker.Item label="Fullstack" value="Fullstack" />
                    </Picker>
                  </View>

                  <TextInput
                    placeholder="Empresa *"
                    style={styles.input}
                    value={company}
                    onChangeText={setCompany}
                  />

                  <TextInput
                    placeholder="Localização"
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                  />

                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={type} onValueChange={setType}>
                      <Picker.Item label="Tipo *" value="" />
                      <Picker.Item label="CLT" value="CLT" />
                      <Picker.Item label="PJ" value="PJ" />
                    </Picker>
                  </View>

                  <TextInput
                    placeholder="Descrição *"
                    style={[styles.input, { height: 100 }]}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                  />

                  <TextInput
                    placeholder="WhatsApp"
                    style={styles.input}
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    style={styles.publishButton}
                    onPress={handlePublishJob}
                  >
                    <Text style={styles.publishText}>Publicar</Text>
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

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  headerTitle: { fontSize: 20, fontWeight: "bold" },

  publishButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },

  publishText: { color: "#fff", fontWeight: "bold" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },

  title: { fontWeight: "bold", fontSize: 16 },
  company: { color: "#666" },
  location: { marginTop: 5 },
  description: { marginTop: 5 },

  typeBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#eee",
    padding: 6,
    borderRadius: 6,
  },

  button: {
    marginTop: 10,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: { color: "#fff" },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  adCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },

  adImage: { width: "100%", height: 150, borderRadius: 10 },

  adButton: {
    marginTop: 10,
    backgroundColor: "#25D366",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
});