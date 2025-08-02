import { render, screen } from &apos;@testing-library/react&apos;;
import App from &apos;../App&apos;;

test(&apos;renders without crashing&apos;, () => {
  render(<App />);
  // Check for loading state since the app shows a loading spinner initially
  expect(screen.getByText(&apos;Loading...&apos;)).toBeInTheDocument();
});
