import { describe, expect, it } from 'vitest';
import { useScaffoldStatus } from '../../app/composables/useScaffoldStatus';

describe('useScaffoldStatus', () => {
  it('keeps scaffold state explicit about implemented and pending pieces', () => {
    const items = useScaffoldStatus();

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Nuxt app', state: 'ready' }),
        expect.objectContaining({ label: 'Tooling', state: 'ready' }),
        expect.objectContaining({ label: 'Server API', state: 'pending' }),
        expect.objectContaining({ label: 'Supabase schema', state: 'ready' }),
      ]),
    );
  });
});
