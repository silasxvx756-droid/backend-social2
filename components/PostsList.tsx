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
  ActivityIndicator,
  Alert,
} from "react-native";

import ViewShot from "react-native-view-shot";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";

export default function PaymentScreen() {
  const router = useRouter();
  const { user } = useUser();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const receiptRef = useRef<any>(null);

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] =
    useState<any | null>(null);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [cardNumber, setCardNumber] =
    useState("");

  const [cardName, setCardName] =
    useState("");

  const [expiry, setExpiry] =
    useState("");

  const [cvv, setCvv] = useState("");

  const [cardBrand, setCardBrand] =
    useState("");

  const [expiryError, setExpiryError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  /* ================= ADMIN ================= */

  const ADMIN_EMAIL =
    "silasyyyxvx@gmail.com";

  const loggedUserEmail =
    user?.primaryEmailAddress
      ?.emailAddress || "";

  const isAdmin =
    loggedUserEmail === ADMIN_EMAIL;

  /* ================= DETECT BRAND ================= */

  const detectCardBrand = (
    number: string
  ) => {
    const cleaned = number.replace(
      /\D/g,
      ""
    );

    if (/^4/.test(cleaned))
      return "Visa";

    if (/^(5[1-5]|2[2-7])/.test(cleaned))
      return "Mastercard";

    if (/^3[47]/.test(cleaned))
      return "American Express";

    if (
      /^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362)/.test(
        cleaned
      )
    ) {
      return "Elo";
    }

    if (/^(6062|3841)/.test(cleaned))
      return "Hipercard";

    return "Desconhecido";
  };

  /* ================= FORMAT CARD ================= */

  const formatCardNumber = (
    text: string
  ) => {
    const cleaned = text.replace(
      /\D/g,
      ""
    );

    const limited = cleaned.slice(0, 16);

    const formatted = limited
      .replace(/(.{4})/g, "$1 ")
      .trim();

    setCardNumber(formatted);

    setCardBrand(
      detectCardBrand(limited)
    );
  };

  /* ================= FORMAT EXPIRY ================= */

  const formatExpiry = (
    text: string
  ) => {
    const cleaned = text.replace(
      /\D/g,
      ""
    );

    const limited = cleaned.slice(0, 4);

    let formatted = "";

    if (limited.length <= 2) {
      formatted = limited;
    } else {
      formatted =
        limited.slice(0, 2) +
        " / " +
        limited.slice(2);
    }

    setExpiry(formatted);

    if (limited.length === 4) {
      const month = parseInt(
        limited.slice(0, 2)
      );

      const year = parseInt(
        limited.slice(2, 4)
      );

      const currentDate = new Date();

      const currentMonth =
        currentDate.getMonth() + 1;

      const currentYear =
        currentDate.getFullYear() % 100;

      if (month < 1 || month > 12) {
        setExpiryError("Mês inválido");
        return;
      }

      if (
        year < currentYear ||
        (year === currentYear &&
          month < currentMonth)
      ) {
        setExpiryError(
          "Cartão expirado"
        );

        return;
      }

      setExpiryError("");
    } else {
      setExpiryError("");
    }
  };

  /* ================= ANIMATION ================= */

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

  /* ================= TIME ================= */

  const getCurrentTime = () => {
    const now = new Date();

    return now.toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  /* ================= PAYMENT ================= */

  const handlePayment = async () => {
    try {
      if (isLoading) return;

      if (expiryError !== "") {
        Alert.alert(
          "Erro",
          "Corrija a data do cartão"
        );

        return;
      }

      if (
        !cardNumber ||
        !cardName ||
        !expiry ||
        !cvv
      ) {
        Alert.alert(
          "Erro",
          "Preencha todos os campos"
        );

        return;
      }

      const cleanedCard =
        cardNumber.replace(/\D/g, "");

      if (cleanedCard.length < 16) {
        Alert.alert(
          "Erro",
          "Número do cartão inválido"
        );

        return;
      }

      setIsLoading(true);

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
        brand: cardBrand,
      };

      console.log(
        "📤 ENVIANDO:",
        newPayment
      );

      const response = await fetch(
        "https://backend-social-app-1.onrender.com/payment",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            newPayment
          ),
        }
      );

      const data =
        await response.json();

      console.log(
        "📦 RESPOSTA:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erro no pagamento"
        );
      }

      setPayments((prev) => [
        newPayment,
        ...prev,
      ]);

      setTimeout(() => {
        setIsLoading(false);
        setPaymentSuccess(true);
      }, 1800);

    } catch (err) {
      console.log(
        "❌ ERRO PAGAMENTO:"
      );

      console.log(err);

      Alert.alert(
        "Erro",
        String(err)
      );

      setIsLoading(false);
    }
  };

  /* ================= OPEN MODAL ================= */

  const openPayment = (item: any) => {
    setSelectedPayment(item);
    setModalVisible(true);
  };

  /* ================= SUCCESS ================= */

  if (paymentSuccess) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
        >
          <ViewShot ref={receiptRef}>
            <View
              style={
                styles.successContainer
              }
            >
              <View
                style={styles.successIcon}
              >
                <Text style={styles.check}>
                  ✓
                </Text>
              </View>

              <Text
                style={styles.successTitle}
              >
                Pagamento aprovado
              </Text>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() =>
                  setPaymentSuccess(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.backButtonText
                  }
                >
                  Voltar
                </Text>
              </TouchableOpacity>

              {isAdmin && (
                <View
                  style={
                    styles.historyContainer
                  }
                >
                  <Text
                    style={
                      styles.historyTitle
                    }
                  >
                    Últimos pagamentos
                  </Text>

                  {payments.length ===
                  0 ? (
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      Nenhuma transação
                    </Text>
                  ) : (
                    payments.map(
                      (item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={
                            styles.historyCard
                          }
                          onPress={() =>
                            openPayment(
                              item
                            )
                          }
                        >
                          <View>
                            <Text
                              style={
                                styles.historyName
                              }
                            >
                              {
                                item.name
                              }
                            </Text>

                            <Text
                              style={
                                styles.historyDate
                              }
                            >
                              {
                                item.date
                              }
                            </Text>

                            <Text
                              style={
                                styles.historyCardNumber
                              }
                            >
                              {
                                item.card
                              }
                            </Text>

                            <Text
                              style={{
                                color:
                                  "#2563eb",
                                fontWeight:
                                  "600",
                              }}
                            >
                              {
                                item.brand
                              }
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.historyPrice
                            }
                          >
                            {
                              item.price
                            }
                          </Text>
                        </TouchableOpacity>
                      )
                    )
                  )}
                </View>
              )}
            </View>
          </ViewShot>
        </ScrollView>

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
        >
          <View
            style={styles.modalOverlay}
          >
            <View
              style={styles.modalCard}
            >
              <Text
                style={styles.modalTitle}
              >
                Detalhes do pagamento
              </Text>

              <View
                style={styles.modalInfo}
              >
                <Text
                  style={styles.modalLabel}
                >
                  Bandeira
                </Text>

                <Text
                  style={styles.modalValue}
                >
                  {
                    selectedPayment?.brand
                  }
                </Text>
              </View>

              <View
                style={styles.modalInfo}
              >
                <Text
                  style={styles.modalLabel}
                >
                  Cartão
                </Text>

                <Text
                  style={styles.modalValue}
                >
                  {
                    selectedPayment?.card
                  }
                </Text>
              </View>

              <View
                style={styles.modalInfo}
              >
                <Text
                  style={styles.modalLabel}
                >
                  Nome
                </Text>

                <Text
                  style={styles.modalValue}
                >
                  {
                    selectedPayment?.holder
                  }
                </Text>
              </View>

              <View
                style={styles.modalInfo}
              >
                <Text
                  style={styles.modalLabel}
                >
                  Validade
                </Text>

                <Text
                  style={styles.modalValue}
                >
                  {
                    selectedPayment?.expiry
                  }
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() =>
                  setModalVisible(false)
                }
              >
                <Text
                  style={
                    styles.closeButtonText
                  }
                >
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  /* ================= UI ================= */

  return (
    <SafeAreaView
      style={styles.container}
    >
      <TouchableOpacity
        onPress={() =>
          router.push("/login")
        }
        style={styles.loginButton}
      >
        <Text style={styles.loginText}>
          Login
        </Text>
      </TouchableOpacity>

      {isAdmin && (
        <TouchableOpacity
          onPress={() =>
            setPaymentSuccess(true)
          }
          style={styles.historyButtonTop}
        >
          <Text
            style={
              styles.historyButtonTopText
            }
          >
            Ver histórico
          </Text>
        </TouchableOpacity>
      )}

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
          onChangeText={
            formatCardNumber
          }
        />

        {cardNumber.length > 0 && (
          <Text style={styles.brandText}>
            Bandeira: {cardBrand}
          </Text>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              Validade
            </Text>

            <TextInput
              placeholder="MM / AA"
              style={styles.input}
              keyboardType="numeric"
              value={expiry}
              onChangeText={
                formatExpiry
              }
              maxLength={7}
            />

            {expiryError !== "" && (
              <Text
                style={styles.errorText}
              >
                {expiryError}
              </Text>
            )}
          </View>

          <View style={{ width: 10 }} />

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              CVV
            </Text>

            <TextInput
              placeholder="CVV"
              style={styles.input}
              keyboardType="numeric"
              value={cvv}
              onChangeText={(text) => {
                const cleaned =
                  text.replace(
                    /\D/g,
                    ""
                  );

                setCvv(
                  cleaned.slice(0, 4)
                );
              }}
              maxLength={4}
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
            transform: [
              { scale: scaleAnim },
            ],
          }}
        >
          <TouchableOpacity
            style={[
              styles.button,
              isLoading && {
                opacity: 0.7,
              },
            ]}
            onPress={handlePayment}
            disabled={isLoading}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={styles.buttonText}
              >
                Pagar agora
              </Text>
            )}
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
    alignItems: "center",
    padding: 14,
  },

  loginButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    zIndex: 999,
  },

  loginText: {
    color: "#fff",
    fontWeight: "600",
  },

  historyButtonTop: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    zIndex: 999,
  },

  historyButtonTopText: {
    color: "#fff",
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    width: "100%",
    maxWidth: 420,
    elevation: 6,
  },

  logo: {
    width: 60,
    height: 60,
    alignSelf: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "#777",
    marginBottom: 14,
  },

  priceBox: {
    backgroundColor: "#eef4ff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },

  price: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2563eb",
  },

  label: {
    marginBottom: 6,
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },

  brandText: {
    marginBottom: 12,
    fontWeight: "600",
    color: "#2563eb",
  },

  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    fontWeight: "600",
  },

  row: {
    flexDirection: "row",
  },

  button: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  footer: {
    textAlign: "center",
    marginTop: 12,
    color: "#888",
    fontSize: 12,
  },

  successContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 30,
    alignItems: "center",
  },

  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  check: {
    fontSize: 38,
    color: "#16a34a",
    fontWeight: "bold",
  },

  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },

  backButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },

  backButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  historyContainer: {
    width: "100%",
    marginTop: 20,
  },

  historyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },

  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 20,
  },

  historyCard: {
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  historyName: {
    fontWeight: "bold",
  },

  historyDate: {
    fontSize: 12,
    color: "#666",
  },

  historyCardNumber: {
    fontSize: 11,
    color: "#999",
  },

  historyPrice: {
    fontWeight: "bold",
    color: "#16a34a",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },

  modalInfo: {
    marginBottom: 12,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 12,
  },

  modalLabel: {
    fontSize: 12,
    color: "#666",
  },

  modalValue: {
    fontWeight: "bold",
  },

  closeButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});