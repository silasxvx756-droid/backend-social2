import React, { useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  ScrollView,
  Modal,
} from "react-native";

import ViewShot from "react-native-view-shot";

export default function PaymentScreen() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const receiptRef = useRef<any>(null);

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getCurrentTime = () => {
    const now = new Date();

    return now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePayment = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.08,
        useNativeDriver: true,
      }),

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const newPayment = {
      id: Date.now(),
      name: "Checkout Premium",
      date: `Hoje • ${getCurrentTime()}`,
      price: "R$ 4,00",
      card: cardNumber,
      holder: cardName,
      expiry,
      cvv,
    };

    setPayments((prev) => [newPayment, ...prev]);

    setTimeout(() => {
      setPaymentSuccess(true);
    }, 500);
  };

  const openPayment = (item: any) => {
    setSelectedPayment(item);
  };

  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ViewShot
            ref={receiptRef}
            options={{
              fileName: "comprovante",
              format: "jpg",
              quality: 1,
              result: "data-uri",
            }}
          >
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Text style={styles.check}>✓</Text>
              </View>

              <Text style={styles.successTitle}>
                Pagamento concluído
              </Text>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setPaymentSuccess(false)}
              >
                <Text style={styles.backButtonText}>
                  Voltar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyButton}
                activeOpacity={0.9}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.historyButtonText}>
                  Histórico
                </Text>
              </TouchableOpacity>
            </View>
          </ViewShot>
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Histórico de pagamentos
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {payments.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    activeOpacity={0.85}
                    onPress={() => openPayment(item)}
                  >
                    <View>
                      <Text style={styles.historyName}>
                        {item.name}
                      </Text>

                      <Text style={styles.historyDate}>
                        {item.date}
                      </Text>

                      <Text style={styles.historyCardNumber}>
                        {item.card}
                      </Text>
                    </View>

                    <Text style={styles.historyPrice}>
                      {item.price}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedPayment && (
                  <>
                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLabel}>
                        Cartão
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedPayment.card}
                      </Text>
                    </View>

                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLabel}>
                        Nome
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedPayment.holder}
                      </Text>
                    </View>

                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLabel}>
                        Validade
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedPayment.expiry}
                      </Text>
                    </View>

                    <View style={styles.modalInfo}>
                      <Text style={styles.modalLabel}>
                        CVV
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedPayment.cvv}
                      </Text>
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedPayment(null);
                }}
              >
                <Text style={styles.closeButtonText}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{
            uri: "https://cdn-icons-png.flaticon.com/512/2489/2489756.png",
          }}
          style={styles.logo}
        />

        <Text style={styles.title}>
          Checkout Premium
        </Text>

        <Text style={styles.subtitle}>
          Pagamento seguro
        </Text>

        <View style={styles.priceBox}>
          <Text style={styles.price}>
            R$ 4,00
          </Text>
        </View>

        <Text style={styles.label}>
          Número do cartão
        </Text>

        <TextInput
          placeholder="0000 0000 0000 0000"
          style={styles.input}
          keyboardType="numeric"
          value={cardNumber}
          onChangeText={setCardNumber}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              Validade
            </Text>

            <TextInput
              placeholder="MM/AA"
              style={styles.input}
              value={expiry}
              onChangeText={setExpiry}
            />
          </View>

          <View style={{ width: 12 }} />

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              CVV
            </Text>

            <TextInput
              placeholder="123"
              style={styles.input}
              secureTextEntry
              keyboardType="numeric"
              value={cvv}
              onChangeText={setCvv}
            />
          </View>
        </View>

        <Text style={styles.label}>
          Nome no cartão
        </Text>

        <TextInput
          placeholder="Seu nome"
          style={styles.input}
          value={cardName}
          onChangeText={setCardName}
        />

        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        >
          <TouchableOpacity
            style={styles.button}
            onPress={handlePayment}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>
              Pagar agora
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footer}>
          Pagamento 100% seguro
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
    justifyContent: "center",
    padding: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    elevation: 5,
  },

  logo: {
    width: 70,
    height: 70,
    alignSelf: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111",
  },

  subtitle: {
    textAlign: "center",
    color: "#777",
    marginTop: 4,
    marginBottom: 20,
  },

  priceBox: {
    backgroundColor: "#eef4ff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },

  price: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2563eb",
  },

  label: {
    marginBottom: 6,
    fontWeight: "600",
    color: "#333",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },

  row: {
    flexDirection: "row",
  },

  button: {
    backgroundColor: "#2563eb",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#2563eb",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  footer: {
    textAlign: "center",
    marginTop: 16,
    color: "#888",
    fontSize: 12,
  },

  successContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingVertical: 35,
    paddingHorizontal: 24,
    alignItems: "center",
    elevation: 6,
  },

  successIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  check: {
    fontSize: 42,
    color: "#16a34a",
    fontWeight: "bold",
  },

  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },

  backButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  historyButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    marginTop: 14,
  },

  historyButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  historyCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  historyName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#111827",
  },

  historyDate: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  historyCardNumber: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },

  historyPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#16a34a",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  modalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },

  modalInfo: {
    marginBottom: 18,
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 14,
  },

  modalLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  },

  modalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },

  closeButton: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },

  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});