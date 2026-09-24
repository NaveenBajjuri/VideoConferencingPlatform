import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the landing page at the root route with PulseMeet branding', () => {
  render(<App />);
  // Check for the new PulseMeet brand heading/logo
  const brandElements = screen.getAllByText(/Pulse/i);
  expect(brandElements.length).toBeGreaterThan(0);

  // Check for the Get Started action
  const cta = screen.getByText(/Get Started/i);
  expect(cta).toBeInTheDocument();
});
