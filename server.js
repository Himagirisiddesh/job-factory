const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const STORE_VERSION = 4;
const SESSION_COOKIE_NAME = "ff_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const REQUEST_CODE_TTL_MS = 1000 * 60 * 10;

const USERS = [
  {
    id: "customer-1",
    name: "Nora Patel",
    email: "customer@factoryflow.demo",
    password: "Customer#2026!",
    role: "customer",
    companyName: "Zenith Motors",
  },
];

const BASE_INVENTORY = [
  {
    id: "CAT-001",
    productName: "Titanium Brackets",
    material: "Titanium",
    availableQuantity: 500,
    qualityGrade: "Industrial Grade",
    aliases: ["titanium bracket", "titanium brackets", "bracket", "brackets"],
  },
  {
    id: "CAT-002",
    productName: "Steel Bearings",
    material: "Stainless Steel",
    availableQuantity: 1200,
    qualityGrade: "Precision Grade",
    aliases: ["steel bearing", "steel bearings", "bearing", "bearings"],
  },
  {
    id: "CAT-003",
    productName: "Aluminum Rods",
    material: "Aluminum",
    availableQuantity: 800,
    qualityGrade: "Aerospace Grade",
    aliases: ["aluminum rod", "aluminum rods", "aluminium rod", "aluminium rods", "rod", "rods"],
  },
];

const sessions = new Map();
const streamClients = new Map();

function iso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatOrderId(id) {
  return `ORD-${String(id).padStart(3, "0")}`;
}

function formatRequestId(id) {
  return `REQ-${String(id).padStart(3, "0")}`;
}

function randomVerificationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function createEmptyState() {
  return {
    version: STORE_VERSION,
    nextOrderId: 1,
    nextDraftId: 1,
    inventory: BASE_INVENTORY.map((item) => ({ ...item })),
    orders: [],
    pendingRequests: [],
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(createEmptyState(), null, 2), "utf8");
  }
}

function loadStore() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    if (!parsed || parsed.version !== STORE_VERSION) {
      const fresh = createEmptyState();
      fs.writeFileSync(STORE_FILE, JSON.stringify(fresh, null, 2), "utf8");
      return fresh;
    }
    return parsed;
  } catch {
    const fresh = createEmptyState();
    fs.writeFileSync(STORE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

const store = loadStore();

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) return acc;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function setSessionCookie(res, token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = [`${SESSION_COOKIE_NAME}=`, "HttpOnly", "Path=/", "SameSite=Strict", "Max-Age=0"];
  res.setHeader("Set-Cookie", parts.join("; "));
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { userId: user.id, expiresAt });
  return { token, expiresAt };
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || null;
}

function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required." });
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  const user = USERS.find((entry) => entry.id === session.userId);
  if (!user) return res.status(401).json({ error: "Account not found." });
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
  };
  req.sessionToken = token;
  next();
}

function addStreamClient(userId, client) {
  const clients = streamClients.get(userId) || new Set();
  clients.add(client);
  streamClients.set(userId, clients);
}

function removeStreamClient(userId, client) {
  const clients = streamClients.get(userId);
  if (!clients) return;
  clients.delete(client);
  if (clients.size === 0) streamClients.delete(userId);
}

function emit(userId, event, payload) {
  const clients = streamClients.get(userId);
  if (!clients) return;
  for (const client of clients) {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function parseQuantity(message) {
  const match = String(message).match(/\b(\d[\d,]*)\b/);
  return match ? Number(match[1].replace(/,/g, "")) : 1;
}

const MONTH_LOOKUP = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function parseDeadline(text) {
  const normalized = normalizeSpaces(text).toLowerCase();
  const longForm = normalized.match(/\b(?:by|before|due)\s+([a-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (longForm && MONTH_LOOKUP[longForm[1]]) {
    const now = new Date();
    let year = longForm[3] ? Number(longForm[3]) : now.getFullYear();
    const month = MONTH_LOOKUP[longForm[1]];
    if (!longForm[3] && month < now.getMonth() + 1) year += 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(Number(longForm[2])).padStart(2, "0")}`;
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 14);
  return fallback.toISOString().slice(0, 10);
}

function matchInventoryProduct(message) {
  const lower = normalizeSpaces(message).toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  for (const item of store.inventory) {
    for (const alias of item.aliases) {
      if (lower.includes(alias) && alias.length > bestScore) {
        bestScore = alias.length;
        bestMatch = item;
      }
    }
  }
  return bestMatch;
}

function cleanupExpiredDrafts() {
  const now = Date.now();
  store.pendingRequests = store.pendingRequests.filter((draft) => new Date(draft.expiresAt).getTime() > now);
}

app.post("/api/auth/login", (req, res) => {
  const email = normalizeSpaces(req.body?.email || "").toLowerCase();
  const password = String(req.body?.password || "");
  const user = USERS.find((entry) => entry.email.toLowerCase() === email && entry.password === password);
  if (!user) return res.status(401).json({ error: "Invalid email or password." });
  const session = createSession(user);
  setSessionCookie(res, session.token);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyName: user.companyName },
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  sessions.delete(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/catalog", requireAuth, (req, res) => {
  res.json({
    products: store.inventory.map((item) => ({
      id: item.id,
      productName: item.productName,
      material: item.material,
      availableQuantity: item.availableQuantity,
      qualityGrade: item.qualityGrade,
    })),
  });
});

app.get("/api/order-drafts", requireAuth, (req, res) => {
  cleanupExpiredDrafts();
  const drafts = store.pendingRequests.filter((draft) => draft.customerId === req.user.id);
  res.json({ drafts });
});

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = store.orders.filter((order) => order.customerId === req.user.id);
  res.json({ orders });
});

app.get("/api/orders/stats", requireAuth, (req, res) => {
  cleanupExpiredDrafts();
  const orders = store.orders.filter((order) => order.customerId === req.user.id);
  const drafts = store.pendingRequests.filter((draft) => draft.customerId === req.user.id);
  res.json({
    total: orders.length,
    awaitingVerification: drafts.length,
    confirmed: orders.filter((order) => order.status === "Order Confirmed").length,
  });
});

app.post("/api/chat", requireAuth, (req, res) => {
  const message = normalizeSpaces(req.body?.message || "");
  if (!message) return res.status(400).json({ error: "Message is required." });
  cleanupExpiredDrafts();

  if (message.toLowerCase().includes("show") && message.toLowerCase().includes("order")) {
    const count = store.orders.filter((order) => order.customerId === req.user.id).length;
    return res.json({
      action: "list_orders",
      reply: `You currently have ${count} confirmed order${count === 1 ? "" : "s"}.`,
    });
  }

  const product = matchInventoryProduct(message);
  if (!product) {
    return res.json({
      action: "invalid_product",
      reply: "I can only create orders for listed inventory products. Please select Titanium Brackets, Steel Bearings, or Aluminum Rods.",
    });
  }

  const quantity = parseQuantity(message);
  if (quantity > product.availableQuantity) {
    return res.json({
      action: "stock_exceeded",
      reply: `You are exceeding the available stock. Only ${product.availableQuantity} ${product.productName} are currently available.`,
      extractedEntities: {
        productName: product.productName,
        quantity,
        availableQuantity: product.availableQuantity,
      },
    });
  }

  const deadline = parseDeadline(message);
  const now = iso();
  const draftId = store.nextDraftId++;
  const draft = {
    id: draftId,
    requestId: formatRequestId(draftId),
    customerId: req.user.id,
    productId: product.id,
    productName: product.productName,
    material: product.material,
    qualityGrade: product.qualityGrade,
    quantity,
    deadline,
    verificationCode: randomVerificationCode(),
    createdAt: now,
    expiresAt: iso(REQUEST_CODE_TTL_MS),
  };
  store.pendingRequests.push(draft);
  saveStore();
  emit(req.user.id, "draft_created", { draftId: draft.id });

  return res.json({
    action: "verification_required",
    reply: `Order draft ${draft.requestId} is ready for ${quantity} ${product.productName}. Enter the verification code below to confirm your order.`,
    extractedEntities: {
      productName: product.productName,
      quantity,
      deadline,
      verificationCode: draft.verificationCode,
    },
  });
});

app.post("/api/orders/confirm", requireAuth, (req, res) => {
  cleanupExpiredDrafts();
  const draftId = Number(req.body?.draftId);
  const verificationCode = normalizeSpaces(req.body?.verificationCode || "").toUpperCase();
  const draft = store.pendingRequests.find((entry) => entry.id === draftId && entry.customerId === req.user.id);
  if (!draft) return res.status(404).json({ error: "Pending request not found." });
  if (draft.verificationCode !== verificationCode) {
    return res.status(400).json({ error: "Invalid verification code." });
  }

  const inventoryItem = store.inventory.find((entry) => entry.id === draft.productId);
  if (!inventoryItem) return res.status(400).json({ error: "Product no longer available." });
  if (draft.quantity > inventoryItem.availableQuantity) {
    return res.status(400).json({
      error: `You are exceeding the available stock. Only ${inventoryItem.availableQuantity} ${inventoryItem.productName} are currently available.`,
    });
  }

  inventoryItem.availableQuantity -= draft.quantity;

  const orderNumber = store.nextOrderId++;
  const order = {
    id: orderNumber,
    orderId: formatOrderId(orderNumber),
    customerId: req.user.id,
    productName: draft.productName,
    material: draft.material,
    qualityGrade: draft.qualityGrade,
    quantity: draft.quantity,
    deadline: draft.deadline,
    status: "Order Confirmed",
    createdAt: iso(),
  };
  store.orders.unshift(order);
  store.pendingRequests = store.pendingRequests.filter((entry) => entry.id !== draft.id);
  saveStore();

  emit(req.user.id, "order_confirmed", { orderId: order.orderId });
  emit(req.user.id, "inventory_updated", { productId: inventoryItem.id, availableQuantity: inventoryItem.availableQuantity });

  res.json({
    action: "order_confirmed",
    reply: `${order.orderId} confirmed successfully. Inventory has been updated.`,
    order,
  });
});

app.get("/api/orders/stream", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = { id: crypto.randomUUID(), res };
  addStreamClient(req.user.id, client);
  res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: iso() })}\n\n`);
  const keepAlive = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: iso() })}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeStreamClient(req.user.id, client);
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FactoryFlow customer API running on http://localhost:${PORT}`);
});

