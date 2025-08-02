import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders without crashing', () => {
  render(<App />);
  // Check for loading state since the app shows a loading spinner initially
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
