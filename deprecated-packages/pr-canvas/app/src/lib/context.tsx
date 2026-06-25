import { createContext, useContext, type ParentComponent } from 'solid-js';
import { createWsConnection } from './ws';
import { createPrStore, type PrStoreActions } from './store';

const PrStoreContext = createContext<PrStoreActions>();

const WS_BRIDGE_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:3001`
  : 'ws://localhost:3001';

export const PrStoreProvider: ParentComponent = (props) => {
  const ws = createWsConnection(WS_BRIDGE_URL);
  const storeActions = createPrStore(ws);

  return (
    <PrStoreContext.Provider value={storeActions}>
      {props.children}
    </PrStoreContext.Provider>
  );
};

export function usePrStore(): PrStoreActions {
  const ctx = useContext(PrStoreContext);
  if (!ctx) {
    throw new Error('usePrStore must be used within a PrStoreProvider');
  }
  return ctx;
}
