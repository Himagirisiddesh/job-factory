import cors from 'cors';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Order, OrderStatus } from '../shared/types';
import { processNLP } from '../shared/nlp';

// Use shared Order type
function sortOrders(list: Order[]): Order[] {
  return [...list].sort((a, b) => b.orderNum - a.orderNum);
}

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

let orders: Order[] = [];

// Replaced by shared NLP

async function loadOrders(): Promise<void> {
  try {
    const raw = await readFile(ORDERS_FILE, 'utf8');
    orders = JSON.parse(raw);
  } catch {
    orders = [];
  }
}

async function saveOrders(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ORDERS_FILE, JSON.stringify(sortOrders(orders), null, 2), 'utf8');
}

function upsertOrder(order: Order): Order {
  const idx = orders.findIndex(item => item.id === order.id || item.orderNum === order.orderNum);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.push(order);
  }

  orders = sortOrders(orders);
  return order;
}

async function main(): Promise<void> {
  await loadOrders();

  const app = express();
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, orders: orders.length });
  });

  app.get('/api/orders', (_req, res) => {
    res.json(sortOrders(orders));
  });

  app.post('/api/orders', async (req, res) => {
    const order = req.body as Order;
    upsertOrder(order);
    await saveOrders();
    res.status(201).json(order);
  });

  app.put('/api/orders/:orderNum', async (req, res) => {
    const orderNum = Number(req.params.orderNum);
    const order = req.body as Order;

    if (!Number.isFinite(orderNum) || order.orderNum !== orderNum) {
      res.status(400).json({ error: 'Order number mismatch.' });
      return;
    }

    upsertOrder(order);
    await saveOrders();
    res.json(order);
  });

  app.post('/api/chat', async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const role = String(req.body?.role || 'user').toLowerCase();
    
    if (!message) {
      res.status(400).json({ type: 'UNKNOWN', response: 'Message is required.', orders: sortOrders(orders) });
      return;
    }

    const nlp = processNLP(message);
    const { intent, entities } = nlp;

    if (intent === 'ORDER_CREATE') {
      const nextNum = orders.reduce((max, order) => Math.max(max, order.orderNum), 0) + 1;
      const now = new Date().toISOString();
      const username = String(req.body?.user || 'Guest');
      const order: Order = {
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        orderNum: nextNum,
        customerId: username,
        partName: entities.partName || 'Custom Part',
        material: entities.material || 'Standard',
        specs: '', // Can be extracted further if needed
        quantity: entities.quantity || 1,
        deadline: entities.deadline || 'TBD',
        status: 'Received',
        qualityNotes: [],
        auditTrail: [{ timestamp: now, action: 'Order created via AI Agent' }],
        createdAt: now,
        updatedAt: now,
      };
      
      upsertOrder(order);
      await saveOrders();
      res.json({
        type: 'order_create',
        response: `Order #${order.orderNum} created: ${order.quantity}x ${order.material} ${order.partName}.`,
        order,
        orders: sortOrders(orders),
      });
      return;
    }

    if (intent === 'STATUS_UPDATE') {
      if (role !== 'manufacturer') {
        res.status(403).json({ type: 'status_update', response: 'Status updates are restricted to the Manufacturer portal.', orders: sortOrders(orders) });
        return;
      }

      const order = orders.find(o => o.orderNum === entities.orderNum);
      if (!order) {
        res.status(404).json({ type: 'status_update', response: `Order #${entities.orderNum} not found.`, orders: sortOrders(orders) });
        return;
      }

      let newStatus = entities.status;
      if (!newStatus) {
        const flow: OrderStatus[] = ['Received', 'In Review', 'Accepted', 'Manufacturing', 'Inspection', 'Completed'];
        const idx = flow.indexOf(order.status);
        if (idx < flow.length - 1) newStatus = flow[idx + 1];
      }

      if (newStatus && newStatus !== order.status) {
        const now = new Date().toISOString();
        const updated: Order = {
          ...order,
          status: newStatus,
          updatedAt: now,
          auditTrail: [...order.auditTrail, { timestamp: now, action: `Status updated to ${newStatus}` }],
        };
        upsertOrder(updated);
        await saveOrders();
        res.json({ type: 'status_update', response: `Order #${order.orderNum} advanced to ${newStatus}.`, order: updated, orders: sortOrders(orders) });
      } else {
        res.status(400).json({ type: 'status_update', response: `Could not determine next status for Order #${order.orderNum}.`, orders: sortOrders(orders) });
      }
      return;
    }

    if (intent === 'QUALITY_LOG') {
      if (role !== 'manufacturer') {
        res.status(403).json({ type: 'quality_log', response: 'Quality logs are restricted to the Manufacturer portal.', orders: sortOrders(orders) });
        return;
      }

      const order = orders.find(o => o.orderNum === entities.orderNum);
      if (!order) {
        res.status(404).json({ type: 'quality_log', response: `Order #${entities.orderNum} not found.`, orders: sortOrders(orders) });
        return;
      }

      const now = new Date().toISOString();
      const updated: Order = {
        ...order,
        updatedAt: now,
        qualityNotes: [...order.qualityNotes, { timestamp: now, note: entities.remarks || 'No details provided.' }],
        auditTrail: [...order.auditTrail, { timestamp: now, action: 'Quality note added' }],
      };
      upsertOrder(updated);
      await saveOrders();
      res.json({ type: 'quality_log', response: `Quality log added to Order #${order.orderNum}.`, order: updated, orders: sortOrders(orders) });
      return;
    }

    if (intent === 'DASHBOARD_QUERY' || intent === 'ORDER_QUERY') {
      const username = String(req.body?.user || '');
      let matches = role === 'manufacturer' ? orders : orders.filter(o => o.customerId === username);
      let resp = role === 'manufacturer' ? 'Showing all orders.' : `Showing orders for ${username}.`;

      if (intent === 'ORDER_QUERY' && entities.orderNum) {
        matches = matches.filter(o => o.orderNum === entities.orderNum);
        resp = matches.length ? `Found Order #${entities.orderNum}.` : `Order #${entities.orderNum} not found in your account.`;
      } else if (entities.queryType === 'delayed') {
        const now = new Date();
        matches = matches.filter(o => o.status !== 'Completed' && o.deadline !== 'TBD' && new Date(o.deadline) < now);
        resp = `Found ${matches.length} delayed orders.`;
      } else if (entities.queryType === 'summary') {
        const stats = matches.reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {} as any);
        resp = role === 'manufacturer' ? `System Overview: ${Object.entries(stats).map(([s, c]) => `${s}: ${c}`).join(', ')}.` : `Your Orders Summary: ${Object.entries(stats).map(([s, c]) => `${s}: ${c}`).join(', ')}.`;
      }

      res.json({ 
        type: 'dashboard_query', 
        response: resp, 
        matches, 
        orders: role === 'manufacturer' ? sortOrders(orders) : sortOrders(matches) 
      });
      return;
    }

    res.json({ type: 'unknown', response: "I'm not sure how to handle that. Try 'help' for examples.", orders: sortOrders(orders) });
  });

  app.listen(PORT, () => {
    console.log(`Order API listening on http://localhost:${PORT}`);
  });
}

main().catch(error => {
  console.error('Failed to start order API:', error);
  process.exit(1);
});
