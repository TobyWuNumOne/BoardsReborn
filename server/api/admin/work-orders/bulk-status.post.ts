import { readBody } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { bulkAdminWorkOrderStatus } from '../../../utils/work-orders';
import { parseBulkStatusBody } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const body = await readBody(event);
  const input = parseBulkStatusBody(body);

  return bulkAdminWorkOrderStatus(supabase, input, userId);
});
