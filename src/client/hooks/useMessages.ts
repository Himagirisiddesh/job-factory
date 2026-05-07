import { useState, useEffect, useCallback } from 'react';

export interface PortalMessage {
  id: string;
  from: 'user' | 'manufacturer';
  to: 'user' | 'manufacturer';
  text: string;
  timestamp: string;
  read: boolean;
}

const MSG_KEY = 'precision_messages';

function loadMessages(): PortalMessage[] {
  try {
    const raw = localStorage.getItem(MSG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const useMessages = () => {
  const [messages, setMessages] = useState<PortalMessage[]>(loadMessages);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(MSG_KEY, JSON.stringify(messages));
  }, [messages]);

  // Poll for new messages from the other portal (every 2s)
  useEffect(() => {
    const interval = setInterval(() => {
      const fresh = loadMessages();
      setMessages(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(fresh)) return fresh;
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((from: 'user' | 'manufacturer', to: 'user' | 'manufacturer', text: string) => {
    const msg: PortalMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from, to, text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => {
      const next = [...prev, msg];
      localStorage.setItem(MSG_KEY, JSON.stringify(next));
      return next;
    });
    return msg;
  }, []);

  const getUnread = useCallback((forRole: 'user' | 'manufacturer'): PortalMessage[] => {
    return messages.filter(m => m.to === forRole && !m.read);
  }, [messages]);

  const markRead = useCallback((forRole: 'user' | 'manufacturer') => {
    setMessages(prev => {
      const next = prev.map(m => m.to === forRole ? { ...m, read: true } : m);
      localStorage.setItem(MSG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getMessagesFor = useCallback((role: 'user' | 'manufacturer'): PortalMessage[] => {
    return messages.filter(m => m.to === role || m.from === role);
  }, [messages]);

  return { messages, sendMessage, getUnread, markRead, getMessagesFor };
};
