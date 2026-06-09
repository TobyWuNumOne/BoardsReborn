import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { lookupAdminWorkOrderScan } from '../../../utils/work-orders';
import { parseAdminWorkOrderScanLookupQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseAdminWorkOrderScanLookupQuery(getQuery(event));

  return lookupAdminWorkOrderScan(supabase, query.code);
});
