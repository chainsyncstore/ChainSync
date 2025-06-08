import { render, screen } from '@testing-library/react';

import App from '../App';

test('renders without crashing', () => {
  render(<App />);
  // Use getAllByText to avoid multiple match error
  expect(screen.getAllByText(/chainsync/i).length).toBeGreaterThan(0);
});
