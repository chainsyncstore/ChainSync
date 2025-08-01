import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App';
import './index.css';
import { AuthProvider } from './providers/auth-provider';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
