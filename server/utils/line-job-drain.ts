import { processLineJobs } from './line-job-processor';
import type { ServiceRoleSupabaseClient } from './supabase-clients';

type LineJobDrainReason = 'confirm_binding_linked';
type ConfirmBindingResponse = { data: { outcome: string } };

export const triggerLineJobDrainBestEffort = async (input: {
  channelAccessToken: string;
  reason: LineJobDrainReason;
  supabase: ServiceRoleSupabaseClient;
}) => {
  try {
    return await processLineJobs(input.supabase, input.channelAccessToken);
  } catch (error) {
    console.warn('LINE job immediate drain failed', {
      errorName: error instanceof Error ? error.name : typeof error,
      reason: input.reason,
    });
    return null;
  }
};

export const drainLineJobsAfterLinkedBindingBestEffort = (
  response: ConfirmBindingResponse,
  input: {
    channelAccessToken: string;
    supabase: ServiceRoleSupabaseClient;
  },
) => {
  if (response.data.outcome !== 'linked') return Promise.resolve(null);

  return triggerLineJobDrainBestEffort({
    channelAccessToken: input.channelAccessToken,
    reason: 'confirm_binding_linked',
    supabase: input.supabase,
  });
};
