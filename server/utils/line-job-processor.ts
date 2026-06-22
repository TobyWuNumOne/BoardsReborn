import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { ServiceRoleSupabaseClient } from './supabase-clients';
import { InternalServerError, InternalUnauthorizedError } from './api-errors';
import { throwMappedSupabaseError } from './supabase-errors';

const BATCH_SIZE = 20;
const STALE_LOCK_SECONDS = 300;

type PreparedMessage = Record<string, unknown>;
type PushResult = { kind: 'accepted' | 'failed' | 'retry' };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const requireSecret = (value: string, message: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new InternalServerError(message);
  return trimmed;
};

export const requireLineJobProcessorSecret = (
  authorization: string | undefined,
  configuredSecret: string,
) => {
  const expected = Buffer.from(
    requireSecret(configuredSecret, 'LINE job processor configuration is missing.'),
  );
  const prefix = 'Bearer ';
  const received = Buffer.from(authorization?.startsWith(prefix) ? authorization.slice(7) : '');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InternalUnauthorizedError();
  }
};

export const classifyLinePushResult = (response: Response): PushResult => {
  if (response.ok) return { kind: 'accepted' };
  if (response.status === 409 && response.headers.has('x-line-accepted-request-id')) {
    return { kind: 'accepted' };
  }
  if (response.status === 429 || response.status >= 500) return { kind: 'retry' };
  return { kind: 'failed' };
};

export const sendLinePushMessage = async (
  input: { messages: PreparedMessage[]; recipient: string; retryKey: string },
  channelAccessToken: string,
  fetch: FetchLike = globalThis.fetch,
): Promise<PushResult> => {
  const token = requireSecret(channelAccessToken, 'LINE Messaging API configuration is missing.');
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      body: JSON.stringify({ messages: input.messages, to: input.recipient }),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Line-Retry-Key': input.retryKey,
      },
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    return classifyLinePushResult(response);
  } catch {
    return { kind: 'retry' };
  }
};

interface ClaimedJob {
  id: string;
}

interface PreparedJob {
  messages?: PreparedMessage[];
  outcome: 'failed' | 'ready' | 'skipped';
  recipient?: string;
  retryKey?: string;
}

interface BatchDependencies {
  claim: () => Promise<ClaimedJob[]>;
  prepare: (job: ClaimedJob) => Promise<PreparedJob>;
  record: (job: ClaimedJob, result: PushResult) => Promise<{ outcome: string }>;
  send: (job: PreparedJob) => Promise<PushResult>;
}

export const processLineJobBatch = async (dependencies: BatchDependencies) => {
  const jobs = await dependencies.claim();
  const summary = { claimed: jobs.length, failed: 0, retried: 0, skipped: 0, succeeded: 0 };

  for (const job of jobs) {
    const prepared = await dependencies.prepare(job);
    if (prepared.outcome === 'skipped') {
      summary.skipped += 1;
      continue;
    }
    if (prepared.outcome === 'failed') {
      summary.failed += 1;
      continue;
    }

    const outcome = await dependencies.record(job, await dependencies.send(prepared));
    if (outcome.outcome === 'succeeded') summary.succeeded += 1;
    else if (outcome.outcome === 'retried') summary.retried += 1;
    else summary.failed += 1;
  }
  return summary;
};

const assertRecord = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InternalServerError();
  }
  return value as Record<string, unknown>;
};

const claimJobs = async (supabase: ServiceRoleSupabaseClient, lockedBy: string) => {
  const { data, error } = await supabase.rpc('claim_line_jobs', {
    p_batch_size: BATCH_SIZE,
    p_locked_by: lockedBy,
    p_stale_lock_seconds: STALE_LOCK_SECONDS,
  });
  if (error) throwMappedSupabaseError(error);
  const jobs = assertRecord(data).jobs;
  if (!Array.isArray(jobs)) throw new InternalServerError();
  return jobs.map((job) => ({ id: String(assertRecord(job).id) }));
};

const prepareJob = async (
  supabase: ServiceRoleSupabaseClient,
  lockedBy: string,
  job: ClaimedJob,
): Promise<PreparedJob> => {
  const { data, error } = await supabase.rpc('prepare_line_job', {
    p_job_id: job.id,
    p_locked_by: lockedBy,
  });
  if (error) throwMappedSupabaseError(error);
  const result = assertRecord(data);
  if (result.outcome !== 'ready') return { outcome: result.outcome as 'failed' | 'skipped' };
  if (
    !Array.isArray(result.messages) ||
    typeof result.recipient !== 'string' ||
    typeof result.retryKey !== 'string'
  ) {
    throw new InternalServerError();
  }
  return {
    messages: result.messages as PreparedMessage[],
    outcome: 'ready',
    recipient: result.recipient,
    retryKey: result.retryKey,
  };
};

const recordResult = async (
  supabase: ServiceRoleSupabaseClient,
  lockedBy: string,
  job: ClaimedJob,
  result: PushResult,
) => {
  const retryAt = new Date(Date.now() + 60_000).toISOString();
  const { data, error } = await supabase.rpc('record_line_job_result', {
    p_available_at: result.kind === 'retry' ? retryAt : undefined,
    p_error: result.kind === 'accepted' ? undefined : `line_api_${result.kind}`,
    p_job_id: job.id,
    p_locked_by: lockedBy,
    p_result: result.kind === 'accepted' ? 'succeeded' : result.kind,
    p_sent_at: result.kind === 'accepted' ? new Date().toISOString() : undefined,
  });
  if (error) throwMappedSupabaseError(error);
  return assertRecord(data) as { outcome: string };
};

export const processLineJobs = async (
  supabase: ServiceRoleSupabaseClient,
  channelAccessToken: string,
) => {
  const lockedBy = `nuxt-${randomUUID()}`;
  return processLineJobBatch({
    claim: () => claimJobs(supabase, lockedBy),
    prepare: (job) => prepareJob(supabase, lockedBy, job),
    record: (job, result) => recordResult(supabase, lockedBy, job, result),
    send: (prepared) =>
      sendLinePushMessage(
        {
          messages: prepared.messages ?? [],
          recipient: prepared.recipient ?? '',
          retryKey: prepared.retryKey ?? '',
        },
        channelAccessToken,
      ),
  });
};
