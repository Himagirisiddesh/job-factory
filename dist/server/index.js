import cors from 'cors';
import express from 'express';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
let orders = [];
function detectIntent(message) {
    const msg = message.toLowerCase();
    if (/\b(show|list|dashboard|summary)\b/.test(msg))
        return 'dashboard_query';
    if (msg.includes('quality update') || msg.includes('quality note') || msg.includes('inspection'))
        return 'quality_log';
    if (msg.includes('mark order') || msg.includes('accepted') || msg.includes('reviewed') || msg.includes('in review') || msg.includes('progress') || msg.includes('advance'))
        return 'status_update';
    return 'order_create';
}
function extractOrderNum(message) {
    const match = message.match(/#\s*(\d+)/) || message.match(/\border\s+(\d+)/i) || message.match(/\bord-(\d+)/i);
    return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
function extractStatus(message) {
    const msg = message.toLowerCase();
    if (msg.includes('accepted') || msg.includes('accept'))
        return 'Accepted';
    if (msg.includes('reviewed') || msg.includes('review'))
        return 'In Review';
    if (msg.includes('received'))
        return 'Received';
    if (msg.includes('manufacturing') || msg.includes('production'))
        return 'Manufacturing';
    if (msg.includes('inspection'))
        return 'Inspection';
    if (msg.includes('completed') || msg.includes('complete') || msg.includes('done'))
        return 'Completed';
    return null;
}
function getNextStatus(status) {
    const flow = ['Received', 'In Review', 'Accepted', 'Manufacturing', 'Inspection', 'Completed'];
    const index = flow.indexOf(status);
    return index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
}
function canMoveStatus(from, to) {
    const flow = ['Received', 'In Review', 'Accepted', 'Manufacturing', 'Inspection', 'Completed'];
    return flow.indexOf(to) > flow.indexOf(from);
}
function parseDeadline(deadline) {
    if (!deadline || deadline === 'TBD')
        return null;
    const direct = new Date(deadline);
    if (!Number.isNaN(direct.getTime()))
        return direct;
    const current = new Date();
    const withYear = new Date(`${deadline}, ${current.getFullYear()}`);
    return Number.isNaN(withYear.getTime()) ? null : withYear;
}
function extractMaterial(message) {
    const match = message.match(/\b(titanium|steel|stainless\s+steel|aluminum|aluminium|copper|brass|iron|plastic|nylon|ceramic|alloy)\b/i);
    if (!match?.[1])
        return 'Standard';
    const material = match[1].toLowerCase() === 'aluminium' ? 'aluminum' : match[1];
    return material.replace(/\b\w/g, char => char.toUpperCase());
}
function extractQuantity(message) {
    const match = message.match(/\b(\d+)\s*(?:pcs|pieces|units|items)?\b/i);
    return match?.[1] ? Number.parseInt(match[1], 10) : 1;
}
function extractSpecs(message) {
    const specs = [
        ...message.matchAll(/\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|in)\b(?:\s+\w+)?/gi),
        ...message.matchAll(/\bgrade\s*[A-Z0-9-]+\b/gi),
        ...message.matchAll(/\bM\d+(?:\.\d+)?\b/gi),
    ].map(match => match[0].trim());
    return [...new Set(specs)].join(', ');
}
function extractDeadline(message) {
    const match = message.match(/\b(?:delivered?\s+by|due\s+(?:by\s+)?|deadline\s*(?:is|:)?|by)\s+([^,.]+)/i);
    return match?.[1]?.trim() || 'TBD';
}
function extractPartName(message) {
    const partMatch = message.match(/\b(flanges?|bolts?|gears?|bearings?|shafts?|valves?|brackets?|plates?|rods?|tubes?|pipes?|rings?|springs?|screws?|washers?|clamps?|discs?|panels?|frames?|adapters?|connectors?|fittings?|parts?|components?)\b/i);
    if (partMatch?.[1]) {
        return partMatch[1].replace(/\b\w/g, char => char.toUpperCase());
    }
    return 'Custom Part';
}
function createOrderFromMessage(message) {
    const nextNum = orders.reduce((max, order) => Math.max(max, order.orderNum), 0) + 1;
    const now = new Date().toISOString();
    return {
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        orderNum: nextNum,
        partName: extractPartName(message),
        material: extractMaterial(message),
        specs: extractSpecs(message),
        quantity: extractQuantity(message),
        deadline: extractDeadline(message),
        status: 'Received',
        qualityNotes: [],
        auditTrail: [{ timestamp: now, action: 'Order created - status: Received' }],
        createdAt: now,
        updatedAt: now,
    };
}
function queryOrders(message) {
    const msg = message.toLowerCase();
    const now = new Date();
    if (msg.includes('delayed') || msg.includes('overdue') || msg.includes('late')) {
        return sortOrders(orders.filter(order => {
            if (order.status === 'Completed')
                return false;
            const deadline = parseDeadline(order.deadline);
            return Boolean(deadline && deadline < now);
        }));
    }
    if (msg.includes('due soon') || msg.includes('approaching') || msg.includes('deadline')) {
        const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        return sortOrders(orders.filter(order => {
            if (order.status === 'Completed')
                return false;
            const deadline = parseDeadline(order.deadline);
            return Boolean(deadline && deadline >= now && deadline <= cutoff);
        }));
    }
    if (msg.includes('quality')) {
        return sortOrders(orders.filter(order => order.qualityNotes.length > 0));
    }
    const status = extractStatus(message);
    if (status)
        return sortOrders(orders.filter(order => order.status === status));
    return sortOrders(orders);
}
function buildSummary() {
    const statuses = ['Received', 'In Review', 'Accepted', 'Manufacturing', 'Inspection', 'Completed'];
    const lines = [`Order Summary (${orders.length} total)`];
    for (const status of statuses) {
        const count = orders.filter(order => order.status === status).length;
        if (count > 0)
            lines.push(`${status}: ${count}`);
    }
    const delayed = queryOrders('delayed');
    if (delayed.length > 0)
        lines.push(`${delayed.length} overdue order(s)`);
    return lines.join('. ');
}
function extractQualityNote(message) {
    const dashSplit = message.split(/[—-]/).slice(1).join('-').trim();
    if (dashSplit)
        return dashSplit;
    const colonSplit = message.split(':').slice(1).join(':').trim();
    if (colonSplit)
        return colonSplit;
    return message.replace(/^.*?(?:quality\s+update|quality\s+note|inspection)\s*(?:on|for)?\s*(?:order\s*)?#?\d*\s*/i, '').trim() || message.trim();
}
function sortOrders(value) {
    return [...value].sort((a, b) => b.orderNum - a.orderNum);
}
async function loadOrders() {
    try {
        const raw = await readFile(ORDERS_FILE, 'utf8');
        orders = JSON.parse(raw);
    }
    catch {
        orders = [];
    }
}
async function saveOrders() {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(ORDERS_FILE, JSON.stringify(sortOrders(orders), null, 2), 'utf8');
}
function upsertOrder(order) {
    const idx = orders.findIndex(item => item.id === order.id || item.orderNum === order.orderNum);
    if (idx >= 0) {
        orders[idx] = order;
    }
    else {
        orders.push(order);
    }
    orders = sortOrders(orders);
    return order;
}
async function main() {
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
        const order = req.body;
        upsertOrder(order);
        await saveOrders();
        res.status(201).json(order);
    });
    app.put('/api/orders/:orderNum', async (req, res) => {
        const orderNum = Number(req.params.orderNum);
        const order = req.body;
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
            res.status(400).json({ type: 'unknown', response: 'Message is required.', orders: sortOrders(orders) });
            return;
        }
        const intent = detectIntent(message);
        if (intent === 'order_create') {
            const order = createOrderFromMessage(message);
            upsertOrder(order);
            await saveOrders();
            res.json({
                type: intent,
                response: `Order #${order.orderNum} created successfully. Status set to Received.`,
                order,
                orders: sortOrders(orders),
            });
            return;
        }
        if (intent === 'status_update') {
            if (role !== 'manufacturer') {
                res.status(403).json({ type: intent, response: 'Status updates are available in the Manufacturer portal.', orders: sortOrders(orders) });
                return;
            }
            const orderNum = extractOrderNum(message);
            const explicitStatus = extractStatus(message);
            const order = orders.find(item => item.orderNum === orderNum);
            const wantsProgress = /\b(progress|advance|next\s+step|move\s+forward)\b/i.test(message);
            const status = explicitStatus || (order && wantsProgress ? getNextStatus(order.status) : null);
            if (!orderNum || !order) {
                res.status(404).json({ type: intent, response: 'Order not found. Include an order number like #3.', orders: sortOrders(orders) });
                return;
            }
            if (!status) {
                res.status(400).json({ type: intent, response: 'Status not recognized. Try Received, In Review, or Accepted.', orders: sortOrders(orders) });
                return;
            }
            if (!canMoveStatus(order.status, status)) {
                res.status(422).json({
                    type: intent,
                    response: `Cannot move Order #${orderNum} from ${order.status} to ${status}. Status can only move forward.`,
                    orders: sortOrders(orders),
                });
                return;
            }
            const now = new Date().toISOString();
            const updated = {
                ...order,
                status,
                updatedAt: now,
                auditTrail: [...order.auditTrail, { timestamp: now, action: `Status changed: ${order.status} -> ${status}` }],
            };
            upsertOrder(updated);
            await saveOrders();
            res.json({ type: intent, response: `Order #${orderNum} updated to ${status}.`, order: updated, orders: sortOrders(orders) });
            return;
        }
        if (intent === 'quality_log') {
            if (role !== 'manufacturer') {
                res.status(403).json({ type: intent, response: 'Quality logs are available in the Manufacturer portal.', orders: sortOrders(orders) });
                return;
            }
            const orderNum = extractOrderNum(message);
            const order = orders.find(item => item.orderNum === orderNum);
            if (!orderNum || !order) {
                res.status(404).json({ type: intent, response: 'Order not found. Include an order number like #3.', orders: sortOrders(orders) });
                return;
            }
            if (order.status === 'Received' || order.status === 'In Review') {
                res.status(422).json({
                    type: intent,
                    response: `Quality logs can be added after Order #${orderNum} is Accepted. Current status is ${order.status}.`,
                    orders: sortOrders(orders),
                });
                return;
            }
            const now = new Date().toISOString();
            const note = extractQualityNote(message);
            const updated = {
                ...order,
                updatedAt: now,
                qualityNotes: [...order.qualityNotes, { timestamp: now, note }],
                auditTrail: [...order.auditTrail, { timestamp: now, action: 'Quality note added' }],
            };
            upsertOrder(updated);
            await saveOrders();
            res.json({ type: intent, response: `Quality log added to Order #${orderNum}.`, order: updated, orders: sortOrders(orders) });
            return;
        }
        const matches = queryOrders(message);
        const isSummary = /\b(summary|dashboard|overview)\b/i.test(message);
        res.json({
            type: intent,
            response: isSummary ? buildSummary() : matches.length === 0 ? 'No matching orders found.' : `Found ${matches.length} matching order(s).`,
            matches,
            orders: sortOrders(orders),
        });
    });
    app.listen(PORT, () => {
        console.log(`Order API listening on http://localhost:${PORT}`);
    });
}
main().catch(error => {
    console.error('Failed to start order API:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map