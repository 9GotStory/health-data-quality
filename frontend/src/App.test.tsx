import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as gasClient from './api/gasClient';

function renderApp() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders empty state when GAS returns no items', async () => {
    vi.spyOn(gasClient, 'fetchItems').mockResolvedValueOnce([]);
    renderApp();

    expect(screen.getByText(/loading items/i)).toBeInTheDocument();
    expect(await screen.findByText(/no items found/i)).toBeInTheDocument();
  });

  it('renders fetched items', async () => {
    vi.spyOn(gasClient, 'fetchItems').mockResolvedValueOnce([
      {
        id: '1',
        code: '0042',
        name: 'Sample Widget',
        createdAt: '2026-11-20T00:00:00.000Z',
      },
    ]);
    renderApp();

    expect(await screen.findByText('0042')).toBeInTheDocument();
    expect(screen.getByText('Sample Widget')).toBeInTheDocument();
  });

  it('renders error state when GAS request fails', async () => {
    vi.spyOn(gasClient, 'fetchItems').mockRejectedValueOnce(new Error('Network down'));
    renderApp();

    expect(await screen.findByText(/failed to load items: network down/i)).toBeInTheDocument();
  });
});
