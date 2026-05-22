import { getRouterParam } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import { defineApiHandler } from '../../../../utils/api-handler';
import { retryAdminPrintJob } from '../../../../utils/print-jobs';
import { parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');

  return retryAdminPrintJob(supabase, id, userId);
});
