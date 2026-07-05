import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(cors());

const MAXELPAY_API_KEY = process.env.MAXELPAY_API_KEY; // coloque no Render
const MAXELPAY_URL = process.env.MAXELPAY_URL || "https://api.maxelpay.com/v1/checkout"; // ajuste pelo doc

// in-memory (troque por DB/Redis em produção)
const orders = new Map(); // order_id -> { status, checkoutUrl, amount, currency }

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

    // ajuste se a Maxelpay exigir outro formato
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
    };

    const response = await fetch(MAXELPAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAXELPAY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("Maxelpay URL:", MAXELPAY_URL);
    console.log("Maxelpay status:", response.status);
    console.log("Maxelpay response:", data);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || data?.raw || "Erro ao gerar o link de pagamento.",
        debug: { responseStatus: response.status },
      });
    }

    // tenta vários nomes possíveis de campo de URL
    const checkoutUrl =
      data?.checkout_url ||
      data?.url ||
      data?.redirect_url ||
      data?.payment_url ||
      null;

    if (!checkoutUrl) {
      return res.status(500).json({
        success: false,
        message: "A Maxelpay não retornou checkout URL. Veja logs.",
      });
    }

    orders.set(order_id, {
      status: "pending",
      checkoutUrl,
      amount: amount,
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
    return res.status(500).json({ success: false, message: "Erro interno no servidor de pagamento." });
  }
});

// status (o app consulta)
app.get("/payment-status/:orderId", (req, res) => {
  const orderId = req.params.orderId;
  const order = orders.get(orderId);
  if (!order) return res.status(404).json({ paid: false, status: "not_found" });
  return res.status(200).json({ paid: order.status === "paid", status: order.status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
