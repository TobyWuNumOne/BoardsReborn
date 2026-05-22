import { readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { createAdminPrintJob } from '../../../utils/print-jobs';
import { parseCreatePrintJobBody } from '../../../utils/print-job-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const body = await readBody(event);
  const input = parseCreatePrintJobBody(body);
  const response = await createAdminPrintJob(supabase, input, userId);

  setResponseStatus(event, 201);

  return response;
});
