// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { installMockApi } from '../test/mockApi';

let api: ReturnType<typeof installMockApi>;

describe('useCaptures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api = installMockApi();
  });

  // Dynamic import to ensure window.api is set before module loads
  async function getHook() {
    const { useCaptures } = await import('./useCaptures');
    return useCaptures;
  }

  it('loads captures on mount', async () => {
    const entries = [{ id: '1', text: 'test', color: 'yellow' as const, createdAt: new Date().toISOString() }];
    api.capture.list = vi.fn().mockResolvedValue(entries);
    const useCaptures = await getHook();
    const { result } = renderHook(() => useCaptures());
    await vi.waitFor(() => expect(result.current.captures).toEqual(entries));
  });

  it('adds a capture and refreshes', async () => {
    const entry = { id: '2', text: 'new', color: 'pink' as const, createdAt: new Date().toISOString() };
    api.capture.add = vi.fn().mockResolvedValue(entry);
    api.capture.list = vi.fn().mockResolvedValue([entry]);
    const useCaptures = await getHook();
    const { result } = renderHook(() => useCaptures());
    await act(async () => { await result.current.addCapture('new'); });
    expect(api.capture.add).toHaveBeenCalledWith('new');
  });

  it('removes a capture and refreshes', async () => {
    api.capture.remove = vi.fn().mockResolvedValue(true);
    api.capture.list = vi.fn().mockResolvedValue([]);
    const useCaptures = await getHook();
    const { result } = renderHook(() => useCaptures());
    await act(async () => { await result.current.removeCapture('1'); });
    expect(api.capture.remove).toHaveBeenCalledWith('1');
  });
});
