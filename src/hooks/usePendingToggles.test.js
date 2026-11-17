import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingToggles } from './usePendingToggles.js';

const makeItems = (checkedById = {}) => ['a', 'b'].map((id) => ({
  id,
  listId: 'list-1',
  isChecked: checkedById[id] ?? false,
}));

describe('usePendingToggles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const onCommitToggle = vi.fn().mockResolvedValue(undefined);
    const view = renderHook(
      ({ items }) => usePendingToggles({ items, onCommitToggle }),
      { initialProps: { items: makeItems() } },
    );
    return { onCommitToggle, ...view };
  };

  it('commits immediately but holds the item in its section', async () => {
    const { result, onCommitToggle } = setup();
    const [a] = makeItems();

    await act(async () => {
      result.current.handleToggle(a);
    });

    expect(onCommitToggle).toHaveBeenCalledWith('list-1', 'a', true);
    expect(result.current.getEffectiveChecked(a)).toBe(true);
    expect(result.current.getPlacementChecked(a)).toBe(false);
  });

  it('extends the hold on each toggle and releases all items together', async () => {
    const { result, rerender, onCommitToggle } = setup();
    const [a, b] = makeItems();

    await act(async () => {
      result.current.handleToggle(a);
    });
    const afterA = makeItems({ a: true });
    rerender({ items: afterA });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      result.current.handleToggle(b);
    });
    const afterB = makeItems({ a: true, b: true });
    rerender({ items: afterB });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onCommitToggle).toHaveBeenCalledTimes(2);
    expect(result.current.getPlacementChecked(afterB[0])).toBe(false);
    expect(result.current.getPlacementChecked(afterB[1])).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.getPlacementChecked(afterB[0])).toBe(true);
    expect(result.current.getPlacementChecked(afterB[1])).toBe(true);
  });

  it('un-crossing within the hold commits the reversal and never moves the item', async () => {
    const { result, onCommitToggle } = setup();
    const [a] = makeItems();

    await act(async () => {
      result.current.handleToggle(a);
    });
    await act(async () => {
      result.current.handleToggle(a);
    });

    expect(onCommitToggle.mock.calls).toEqual([
      ['list-1', 'a', true],
      ['list-1', 'a', false],
    ]);
    expect(result.current.getEffectiveChecked(a)).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.getEffectiveChecked(a)).toBe(false);
    expect(result.current.getPlacementChecked(a)).toBe(false);
  });

  it('reverts the optimistic state when the commit fails', async () => {
    const onCommitToggle = vi.fn().mockRejectedValue(new Error('offline'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(
      ({ items }) => usePendingToggles({ items, onCommitToggle }),
      { initialProps: { items: makeItems() } },
    );
    const [a] = makeItems();

    await act(async () => {
      result.current.handleToggle(a);
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.getEffectiveChecked(a)).toBe(false);
    consoleError.mockRestore();
  });
});
