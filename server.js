import express from "express";
import cors from "cors";
import crypto from "crypto";
import fetch from "node-fetch"; // se seu Node não tiver fetch global

const app = express();
app.use(express.json());
app.use(cors());

// Use variáveis de ambiente (NUNCA deixe a chave no código)
const MAXELPAY_API_KEY = process.env.MAXELPAY_API_KEY;
const MAXELPAY_URL = "https://api.maxelpay.com/v1/checkout";

// (Opcional) se a Maxelpay exigir outro endpoint de webhook, troque aqui.
const MAXELPAY_WEBHOOK_SECRET = process.env.MAXELPAY_WEBHOOK_SECRET;

// Simples “banco” em memória (substitua por Redis/DB em produção)
const orders = new Map(); // order_id -> { status, checkoutUrl, expectedAmount, currency }

// Cria checkout de cartão e retorna checkoutUrl + orderId
app.post("/process-nowpayments-card", async (req, res) => {
  try {
    const {
      price_amount,
      price_currency,
      order_description,
      customer_name,
      customer_email,
      customer_cpf,
    } = req.body;

    const amount = Number(price_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "price_amount inválido." });
    }
    if (!customer_email || !customer_email.includes("@")) {
      return res.status(400).json({ success: false, message: "customer_email inválido." });
    }

    if (!MAXELPAY_API_KEY) {
      return res.status(500).json({ success: false, message: "MAXELPAY_API_KEY não configurada." });
    }

    const order_id = `MAXEL_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    // Ajuste aqui conforme a Maxelpay realmente espera “centavos”.
    const amountMinor = Math.round(amount * 100);

    const payload = {
      amount: amountMinor,
      currency: price_currency || "BRL",
      order_id,
      description: order_description || "Compra App Premium",
      payment_methods: ["credit_card"],
      customer: {
        name: customer_name || undefined,
        email: customer_email,
        document: customer_cpf || undefined,
      },

      // Algumas integrações permitem callback/notificações
      // Se a Maxelpay aceitar, você pode habilitar:
      // webhook_url: "https://SEU_DOMINIO/webhook-maxelpay",
    };

    const response = await fetch(MAXELPAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAXELPAY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro da Maxelpay:", data);
      return res.status(response.status).json({
        success: false,
        message: data?.message || "Erro ao gerar checkout."
      });
    }

    const checkoutUrl = data?.checkout_url || data?.url || data?.redirect_url || null;
    if (!checkoutUrl) {
      return res.status(500).json({
        success: false,
        message: "A Maxelpay não retornou checkout_url."
      });
    }

    orders.set(order_id, {
      status: "pending",
      checkoutUrl,
      expectedAmount: amount,
      currency: price_currency || "BRL",
      updatedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      checkoutUrl,
      orderId: order_id,
    });
  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({ success: false, message: "Erro interno no servidor." });
  }
});

// Webhook (a URL precisa existir no seu provedor/PSP)
app.post("/webhook-maxelpay", async (req, res) => {
  try {
    // Se tiver assinatura, valide aqui usando MAXELPAY_WEBHOOK_SECRET.
    // Exemplo (genérico): compare header + body.
    // const sig = req.headers["x-maxelpay-signature"];
    // ... valide ...

    const body = req.body;

    // Ajuste os campos conforme o payload real do webhook da Maxelpay
    const order_id =
      body?.order_id ||
      body?.orderId ||
      body?.data?.order_id ||
      body?.data?.orderId;

    const statusRaw =
      body?.status ||
      body?.payment_status ||
      body?.event ||
      body?.data?.status;

    if (!order_id) {
      return res.status(400).json({ success: false, message: "order_id ausente no webhook." });
    }

    const normalized =
      ["paid", "approved", "succeeded", "captured", "success", "completed"].includes(
        String(statusRaw).toLowerCase()
      )
        ? "paid"
        : ["failed", "canceled", "cancelled", "rejected"].includes(String(statusRaw).toLowerCase())
          ? "failed"
          : "pending";

    const existing = orders.get(order_id) || { status: "pending", checkoutUrl: null };
    orders.set(order_id, {
      ...existing,
      status: normalized,
      updatedAt: Date.now(),
      webhook: body,
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Webhook erro:", e);
    return res.status(500).json({ success: false });
  }
});

// Consulta do status (se o app for consultar via API)
app.get("/payment-status/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  const order = orders.get(orderId);

  if (!order) {
    return res.status(404).json({ paid: false, status: "not_found" });
  }

  return res.status(200).json({ paid: order.status === "paid", status: order.status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
