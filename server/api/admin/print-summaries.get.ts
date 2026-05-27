import { getQuery } from 'h3';
import { requireAdminContext } from '../../utils/admin-auth';
import { defineApiHandler } from '../../utils/api-handler';
import { parsePrintSummaryQuery } from '../../utils/print-job-validation';
import { listAdminPrintSummaries } from '../../utils/print-summaries';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parsePrintSummaryQuery(getQuery(event));

  return listAdminPrintSummaries(supabase, query);
});
