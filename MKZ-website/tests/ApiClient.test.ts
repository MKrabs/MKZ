import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plates, auth } from '~/api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('network errors', () => {
    it('throws user-friendly message when backend is down', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(plates.collect('aB3x', 'KA NR 355')).rejects.toThrow(
        'Could not reach the server. Is the backend running?',
      );
    });

    it('throws user-friendly message on network timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      await expect(plates.collect('aB3x', 'KA NR 355')).rejects.toThrow(
        'Could not reach the server',
      );
    });
  });

  describe('server errors', () => {
    it('extracts error message from JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(auth.getUser('ZZZZ')).rejects.toThrow('User not found');
    });

    it('falls back to HTTP status on non-JSON error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(auth.getUser('ZZZZ')).rejects.toThrow('Unknown error');
    });
  });

  describe('successful requests', () => {
    it('plates.collect sends correct payload', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          plate: { id: 1, userId: 'aB3x', plateText: 'KA NR 355', collectedAt: '2026-05-15' },
          challengeUpdates: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await plates.collect('aB3x', 'KA NR 355', 'KA');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/plates/aB3x');
      expect(options?.method).toBe('POST');

      const body = JSON.parse(options?.body as string);
      expect(body.plateText).toBe('KA NR 355');
      expect(body.region).toBe('KA');
    });

    it('auth.register sends correct payload', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          user: { userId: 'xY12', displayName: 'Max', countryCode: 'DE' },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await auth.register('Max', 'DE');

      expect(result.user.displayName).toBe('Max');
      expect(result.user.countryCode).toBe('DE');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.displayName).toBe('Max');
      expect(body.countryCode).toBe('DE');
    });
  });
});
