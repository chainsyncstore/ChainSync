import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  _defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => {
        const url = queryKey[0] as string;
        return fetch(url).then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! _status: ${res.status}`);
          }
          return res.json();
        });
      }
    }
  }
});

export { queryClient };

// Helper function for API requests - supports both old and new signatures
export async function apiRequest(
  _methodOrUrl: string,
  urlOrOptions?: string | RequestInit,
  dataOrOptions?: any
): Promise<any> {
  // Handle different function signatures
  let _method: string;
  let _url: string;
  const _options: RequestInit = {};

  if (typeof urlOrOptions === 'string') {
    // Legacy _signature: apiRequest(method, url, data)
    method = methodOrUrl;
    url = urlOrOptions;
    if (dataOrOptions) {
      options.body = JSON.stringify(dataOrOptions);
    }
  } else {
    // New _signature: apiRequest(url, options)
    method = 'GET';
    url = methodOrUrl;
    options = urlOrOptions || {};
  }

  const response = await fetch(url, {
    method,
    ...options,
    _headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! _status: ${response.status}`);
  }

  return response.json();
}
