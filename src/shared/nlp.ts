import { ChatIntent, ExtractedEntities, NLPResult, OrderStatus } from './types';

const STATUS_MAP: Record<string, OrderStatus> = {
  'received': 'Received',
  'in review': 'In Review',
  'review': 'In Review',
  'accepted': 'Accepted',
  'accept': 'Accepted',
  'manufacturing': 'Manufacturing',
  'production': 'Manufacturing',
  'inspection': 'Inspection',
  'qc': 'Inspection',
  'completed': 'Completed',
  'complete': 'Completed',
  'done': 'Completed',
};

const MATERIALS = ['titanium', 'steel', 'stainless steel', 'aluminum', 'aluminium', 'copper', 'brass', 'iron', 'plastic', 'nylon', 'ceramic', 'alloy'];

const PARTS = ['flange', 'bolt', 'gear', 'bearing', 'shaft', 'valve', 'bracket', 'plate', 'rod', 'tube', 'pipe', 'ring', 'spring', 'screw', 'washer', 'clamp', 'disc', 'panel', 'frame', 'adapter', 'connector', 'fitting', 'part', 'component'];

export function processNLP(message: string): NLPResult {
  const msg = message.toLowerCase();
  const entities: ExtractedEntities = {};
  let intent: ChatIntent = 'UNKNOWN';
  let confidence = 0.5;

  // 1. Extract Order Number
  const numMatch = msg.match(/#\s*(\d+)/) || msg.match(/\border\s+(\d+)/) || msg.match(/\bord-(\d+)/);
  if (numMatch && numMatch[1]) {
    entities.orderNum = parseInt(numMatch[1], 10);
  }

  // 2. Extract Status
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (new RegExp(`\\b${key}\\b`).test(msg)) {
      entities.status = val;
      break;
    }
  }

  // 3. Extract Material
  for (const mat of MATERIALS) {
    if (msg.includes(mat)) {
      entities.material = mat === 'aluminium' ? 'Aluminum' : mat.charAt(0).toUpperCase() + mat.slice(1);
      break;
    }
  }

  // 4. Extract Quantity
  const qtyMatch = msg.match(/\b(\d+)\s*(?:pcs|pieces|units|items)?\b/);
  if (qtyMatch && qtyMatch[1] && !entities.orderNum) { 
    entities.quantity = parseInt(qtyMatch[1], 10);
  } else if (qtyMatch && qtyMatch[1] && entities.orderNum && numMatch && msg.indexOf(qtyMatch[0]) !== msg.indexOf(numMatch[0])) {
     entities.quantity = parseInt(qtyMatch[1], 10);
  }

  // 5. Extract Deadline
  const deadlineMatch = msg.match(/\b(?:delivered?\s+by|due\s+(?:by\s+)?|deadline\s*(?:is|:)?|by)\s+([^,.]+)/);
  if (deadlineMatch && deadlineMatch[1]) {
    entities.deadline = deadlineMatch[1].trim();
  }

  // 6. Extract Part Name
  for (const part of PARTS) {
    if (msg.includes(part)) {
      entities.partName = part.charAt(0).toUpperCase() + part.slice(1);
      break;
    }
  }

  // 7. Intent Detection
  if (/\b(hello|hi|hey|greetings)\b/.test(msg)) {
    intent = 'GREETING';
    confidence = 0.9;
  } else if (/\b(help|guide|commands|what can you do)\b/.test(msg)) {
    intent = 'HELP';
    confidence = 0.9;
  } else if (/\b(send|tell|message|notify)\b/.test(msg)) {
    intent = 'MESSAGE_SEND';
    entities.messageTarget = msg.includes('user') || msg.includes('customer') ? 'user' : 'manufacturer';
    entities.messageText = message.replace(/^.*?(?:send|tell|message|notify)\s*(?:to\s+)?(?:user|customer|manufacturer|factory)?\s*[:,-]?\s*/i, '').trim();
    confidence = 0.8;
  } else if (/\b(quality update|quality note|inspection note|log quality)\b/.test(msg)) {
    intent = 'QUALITY_LOG';
    entities.remarks = message.replace(/^.*?(?:quality\s*(?:update|note)|inspection\s*note|log\s*quality)\s*(?:on|for)?\s*(?:order\s*)?#?\d*\s*[:,-]?\s*/i, '').trim();
    confidence = 0.85;
  } else if (/\b(mark|set|update|change|move|progress|advance)\b/.test(msg) && (entities.status || /\b(next|forward)\b/.test(msg))) {
    intent = 'STATUS_UPDATE';
    confidence = 0.8;
  } else if (/\b(show|list|find|search|where is|check)\b/.test(msg) && entities.orderNum) {
    intent = 'ORDER_QUERY';
    confidence = 0.85;
  } else if (/\b(summary|dashboard|overview|report|stats|pipeline)\b/.test(msg)) {
    intent = 'DASHBOARD_QUERY';
    entities.queryType = 'summary';
    confidence = 0.9;
  } else if (/\b(delayed|overdue|late|behind)\b/.test(msg)) {
    intent = 'DASHBOARD_QUERY';
    entities.queryType = 'delayed';
    confidence = 0.9;
  } else if (/\b(due soon|approaching|upcoming)\b/.test(msg)) {
    intent = 'DASHBOARD_QUERY';
    entities.queryType = 'due_soon';
    confidence = 0.9;
  } else if (/\b(quality issues|defects|problems)\b/.test(msg)) {
    intent = 'DASHBOARD_QUERY';
    entities.queryType = 'quality';
    confidence = 0.85;
  } else if (/\b(create|new|order|need|want|request)\b/.test(msg)) {
    intent = 'ORDER_CREATE';
    confidence = 0.75;
  } else if (/\b(all|list|show)\b/.test(msg) && /\b(orders)\b/.test(msg)) {
    intent = 'DASHBOARD_QUERY';
    entities.queryType = 'all';
    confidence = 0.8;
  }

  return { intent, entities, confidence };
}
