// test/mocks/server.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Define handlers for your API routes here.
// Example:
// const handlers = [
//   http.get('/api/users', () => {
//     return HttpResponse.json([{ id: '1', name: 'John Doe' }]);
//   }),
// ];

// If you don't have specific handlers yet, you can start with an empty array.
const handlers: any[] = [];

export const server = setupServer(...handlers);
