export type RiskFlag = 'high' | 'medium' | 'low';
export type OrderStatus = 'Received' | 'In Review' | 'Accepted' | 'Manufacturing' | 'Inspection' | 'Completed';

export interface QualityNote {
  timestamp: string;
  note: string;
  riskFlag?: RiskFlag;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  user?: string;
}

export interface Order {
  id: string;
  orderNum: number;
  customerId?: string;
  partName: string;
  material: string;
  specs: string;
  quantity: number;
  deadline: string;
  status: OrderStatus;
  qualityNotes: QualityNote[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ChatIntent = 
  | 'ORDER_CREATE' 
  | 'STATUS_UPDATE' 
  | 'QUALITY_LOG' 
  | 'DASHBOARD_QUERY'
  | 'ORDER_QUERY'
  | 'MESSAGE_SEND'
  | 'HELP'
  | 'GREETING'
  | 'UNKNOWN';

export interface ExtractedEntities {
  orderNum?: number;
  partName?: string;
  material?: string;
  specs?: string;
  quantity?: number;
  deadline?: string;
  status?: OrderStatus;
  remarks?: string;
  messageText?: string;
  messageTarget?: 'user' | 'manufacturer';
  queryType?: 'delayed' | 'due_soon' | 'quality' | 'summary' | 'all';
}

export interface NLPResult {
  intent: ChatIntent;
  entities: ExtractedEntities;
  confidence: number;
}
