import { describe, expect, it } from 'vitest';

import { LIST_TYPES } from './listTypes.js';

describe('list type store field support', () => {
  it('enables store fields and sorting for packing lists', () => {
    expect(LIST_TYPES.packing.fields.store).toBe(true);
    expect(LIST_TYPES.packing.sortLevels).toContain('store');
  });

  it('enables store fields and sorting for project lists', () => {
    expect(LIST_TYPES.project.fields.store).toBe(true);
    expect(LIST_TYPES.project.sortLevels).toContain('store');
  });
});
