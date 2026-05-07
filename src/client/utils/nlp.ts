import { processNLP } from '../../shared/nlp';
import { ChatIntent, ExtractedEntities, NLPResult } from '../../shared/types';

export type Intent = ChatIntent;
export type { ExtractedEntities };

export const parseMessage = (message: string): NLPResult => {
  return processNLP(message);
};
