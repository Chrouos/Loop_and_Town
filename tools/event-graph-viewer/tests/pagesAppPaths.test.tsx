import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

describe('GitHub Pages viewer entry path', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not request story assets from the domain root', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: false,
      status: 404,
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.map(([url]) => String(url)).every(url => !url.startsWith('/'))).toBe(true);
  });
});
