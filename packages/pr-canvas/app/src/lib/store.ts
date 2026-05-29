import { createStore } from 'solid-js/store';
import type { WsConnection, WsStatus } from './ws';
import type { PrListItem, FullPrData, ChatMessage } from './types';

export interface PrStore {
  prs: PrListItem[];
  currentPr: FullPrData | null;
  aiChat: {
    messages: ChatMessage[];
    loading: boolean;
    streamingContent: string;
  };
  loading: boolean;
  error: string | null;
}

export interface PrStoreActions {
  store: PrStore;
  connectionStatus: () => WsStatus;
  loadPrList: () => void;
  loadPr: (number: number) => void;
  subscribePr: (number: number) => void;
  sendAiChat: (message: string, prNumber: number) => void;
  clearError: () => void;
}

export function createPrStore(ws: WsConnection): PrStoreActions {
  const [store, setStore] = createStore<PrStore>({
    prs: [],
    currentPr: null,
    aiChat: { messages: [], loading: false, streamingContent: '' },
    loading: false,
    error: null,
  });

  // Wire up WebSocket listeners to update store reactively

  ws.on('pr:list:result', (msg: { prs: PrListItem[] }) => {
    setStore('prs', msg.prs);
    setStore('loading', false);
  });

  ws.on('pr:data:result', (msg: FullPrData & { type: string }) => {
    setStore('currentPr', {
      number: msg.number,
      data: msg.data,
      rawDiff: msg.rawDiff,
      mindMap: msg.mindMap,
      aiSummary: msg.aiSummary,
    });
    setStore('loading', false);
  });

  ws.on('pr:update', (msg: { number: number; data: any }) => {
    if (store.currentPr && store.currentPr.number === msg.number && msg.data) {
      setStore('currentPr', 'data', msg.data);
    }
  });

  ws.on('ai:chat:response', (msg: { message: string }) => {
    setStore('aiChat', 'messages', (msgs) => [
      ...msgs,
      { role: 'assistant' as const, content: msg.message },
    ]);
    setStore('aiChat', 'loading', false);
  });

  ws.on('ai:chat:stream', (msg: { chunk: string; done?: boolean }) => {
    if (msg.done) {
      // Finalize the streaming message
      const content = store.aiChat.streamingContent + msg.chunk;
      setStore('aiChat', 'messages', (msgs) => [
        ...msgs,
        { role: 'assistant' as const, content },
      ]);
      setStore('aiChat', 'streamingContent', '');
      setStore('aiChat', 'loading', false);
    } else {
      setStore('aiChat', 'streamingContent', (prev) => prev + msg.chunk);
    }
  });

  ws.on('error', (msg: { message: string }) => {
    setStore('error', msg.message);
    setStore('loading', false);
    setStore('aiChat', 'loading', false);
  });

  return {
    store,
    connectionStatus: ws.status,

    loadPrList() {
      setStore('loading', true);
      setStore('error', null);
      ws.send({ type: 'pr:list' });
    },

    loadPr(number: number) {
      setStore('loading', true);
      setStore('error', null);
      ws.send({ type: 'pr:data', number });
    },

    subscribePr(number: number) {
      ws.send({ type: 'pr:subscribe', number });
    },

    sendAiChat(message: string, prNumber: number) {
      setStore('aiChat', 'messages', (msgs) => [
        ...msgs,
        { role: 'user' as const, content: message },
      ]);
      setStore('aiChat', 'loading', true);
      setStore('aiChat', 'streamingContent', '');
      ws.send({ type: 'ai:chat', message, prNumber });
    },

    clearError() {
      setStore('error', null);
    },
  };
}
