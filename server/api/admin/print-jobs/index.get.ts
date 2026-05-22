import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { listAdminPrintJobs } from '../../../utils/print-jobs';
import { parsePrintJobListQuery } from '../../../utils/print-job-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parsePrintJobListQuery(getQuery(event));

  return listAdminPrintJobs(supabase, query);
});
