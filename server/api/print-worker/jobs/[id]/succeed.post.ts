import { getRouterParam, readBody } from 'h3';
import { defineApiHandler } from '../../../../utils/api-handler';
import { markPrintJobSucceeded } from '../../../../utils/print-jobs';
import { parseSucceedPrintJobBody } from '../../../../utils/print-job-validation';
import { requirePrintWorkerContext } from '../../../../utils/print-worker-auth';
import { parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = await readBody(event);
  const input = parseSucceedPrintJobBody(body);
  const { supabase } = await requirePrintWorkerContext(event, input.deviceKey);

  return markPrintJobSucceeded(supabase, id, input.deviceKey);
});
