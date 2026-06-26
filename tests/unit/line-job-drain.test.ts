import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  drainLineJobsAfterLinkedBindingBestEffort,
  triggerLineJobDrainBestEffort,
} from '../../server/utils/line-job-drain';
import { processLineJobs } from '../../server/utils/line-job-processor';

vi.mock('../../server/utils/line-job-processor', () => ({
  processLineJobs: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const processLineJobsMock = vi.mocked(processLineJobs);

describe('LINE job immediate drain', () => {
  it('runs the processor after a newly linked binding', async () => {
    processLineJobsMock.mockResolvedValue({
      claimed: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
      succeeded: 1,
    });

    await expect(
      drainLineJobsAfterLinkedBindingBestEffort(
        { data: { outcome: 'linked' } },
        { channelAccessToken: 'channel-token', supabase: 'supabase-client' as never },
      ),
    ).resolves.toEqual({ claimed: 1, failed: 0, retried: 0, skipped: 0, succeeded: 1 });

    expect(processLineJobsMock).toHaveBeenCalledOnce();
    expect(processLineJobsMock).toHaveBeenCalledWith('supabase-client', 'channel-token');
  });

  it('does not run the processor for idempotent already-linked confirms', async () => {
    await expect(
      drainLineJobsAfterLinkedBindingBestEffort(
        { data: { outcome: 'already_linked' } },
        { channelAccessToken: 'channel-token', supabase: 'supabase-client' as never },
      ),
    ).resolves.toBeNull();

    expect(processLineJobsMock).not.toHaveBeenCalled();
  });

  it('swallows processor failures without logging sensitive values', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    processLineJobsMock.mockRejectedValue(new Error('recipient U123 token plaintext-token'));

    await expect(
      triggerLineJobDrainBestEffort({
        channelAccessToken: 'channel-token',
        reason: 'confirm_binding_linked',
        supabase: 'supabase-client' as never,
      }),
    ).resolves.toBeNull();

    expect(consoleWarn).toHaveBeenCalledOnce();
    const serializedWarning = JSON.stringify(consoleWarn.mock.calls[0]);
    expect(serializedWarning).toContain('LINE job immediate drain failed');
    expect(serializedWarning).toContain('confirm_binding_linked');
    expect(serializedWarning).not.toContain('channel-token');
    expect(serializedWarning).not.toContain('plaintext-token');
    expect(serializedWarning).not.toContain('U123');
  });
});
