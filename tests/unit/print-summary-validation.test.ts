import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../server/utils/api-errors';
import { parsePrintSummaryQuery } from '../../server/utils/print-job-validation';

describe('parsePrintSummaryQuery', () => {
  it('accepts repeated workOrderId values and deduplicates duplicates', () => {
    expect(
      parsePrintSummaryQuery({
        workOrderId: [
          '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
          '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
          '2b09da30-74a1-4a5b-a47b-62b01431c1bf',
        ],
      }),
    ).toEqual({
      workOrderIds: [
        '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
        '2b09da30-74a1-4a5b-a47b-62b01431c1bf',
      ],
    });
  });

  it('rejects missing query, invalid UUIDs, and more than 50 ids', () => {
    expect(() => parsePrintSummaryQuery({})).toThrow(ValidationError);
    expect(() =>
      parsePrintSummaryQuery({
        workOrderId: ['not-a-uuid'],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      parsePrintSummaryQuery({
        workOrderId: Array.from({ length: 51 }, (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        ),
      }),
    ).toThrow(ValidationError);
  });
});
