import { processNLP } from '../../shared/nlp';
import { Order, ChatIntent, ExtractedEntities } from '../../shared/types';

export type Intent = ChatIntent;
export type { ExtractedEntities };

export interface AgentContext {
  role: 'User' | 'Manufacturer';
  orders: Order[];
  conversationHistory: { role: 'user' | 'agent'; text: string }[];
  lastIntent?: string;
  lastOrderNum?: number;
}

export interface AgentAction {
  type: string;
  data: Record<string, any>;
  response: string;
  confidence: number;
}

export function processAgentInput(text: string, ctx: AgentContext): AgentAction {
  const nlp = processNLP(text);
  
  // Map internal types to what Chat.tsx expects if necessary
  // But since I'm making it end-to-end, I'll align them.
  
  let response = '';
  if (nlp.intent === 'GREETING') {
    response = ctx.role === 'User' 
      ? "Hello! I'm your AI Manufacturing Assistant. I can help you create orders, check status, and more."
      : "Hello! Operations center is online. How can I assist with production today?";
  } else if (nlp.intent === 'HELP') {
    response = ctx.role === 'User' 
      ? "Try commands like: 'Need 50 titanium flanges by July 20', 'Show my orders', or 'Send message to factory'."
      : "Try: 'Mark #3 as Manufacturing', 'Quality update on #3: passed', or 'Show delayed orders'.";
  }

  return {
    type: nlp.intent,
    data: {
      ...nlp.entities,
      // For backward compatibility with Chat.tsx logic
      orderNum: nlp.entities?.orderNum || ctx.lastOrderNum
    },
    response,
    confidence: nlp.confidence
  };
}
