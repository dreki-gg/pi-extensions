import { Suspense } from 'solid-js';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { MetaProvider } from '@solidjs/meta';
import { PrStoreProvider } from '~/lib/context';
import './styles/main.css';

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <PrStoreProvider>
            <Suspense>{props.children}</Suspense>
          </PrStoreProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
