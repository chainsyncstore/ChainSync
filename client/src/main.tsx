import { createRoot } from &apos;react-dom/client&apos;;
import { StrictMode } from &apos;react&apos;;
import App from &apos;./App&apos;;
import &apos;./index.css&apos;;
import { AuthProvider } from &apos;./providers/auth-provider&apos;;
import { QueryClientProvider } from &apos;@tanstack/react-query&apos;;
import { queryClient } from &apos;./lib/queryClient&apos;;

const root = createRoot(document.getElementById(&apos;root&apos;)!);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
