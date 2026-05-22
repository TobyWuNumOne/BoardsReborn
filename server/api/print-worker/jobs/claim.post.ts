import { readBody } from 'h3';
import { defineApiHandler } from '../../../utils/api-handler';
import { claimPrintJob } from '../../../utils/print-jobs';
import { parseClaimPrintJobBody } from '../../../utils/print-job-validation';
import { requirePrintWorkerContext } from '../../../utils/print-worker-auth';

export default defineApiHandler(async (event) => {
  const body = await readBody(event);
  const input = parseClaimPrintJobBody(body);
  const { supabase } = await requirePrintWorkerContext(event, input.deviceKey);

  return claimPrintJob(supabase, input);
});
