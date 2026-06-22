import { getHeader } from 'h3';
import { defineApiHandler } from '../../../utils/api-handler';
import { processLineJobs, requireLineJobProcessorSecret } from '../../../utils/line-job-processor';
import { getServiceRoleSupabaseClient } from '../../../utils/supabase-clients';

export default defineApiHandler(async (event) => {
  const config = useRuntimeConfig(event);
  requireLineJobProcessorSecret(getHeader(event, 'authorization'), config.lineJobProcessorSecret);
  const supabase = await getServiceRoleSupabaseClient(event);
  return { data: await processLineJobs(supabase, config.lineChannelAccessToken) };
});
