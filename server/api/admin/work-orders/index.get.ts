import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { listAdminWorkOrders } from '../../../utils/work-orders';
import { parseWorkOrderListQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseWorkOrderListQuery(getQuery(event));

  return listAdminWorkOrders(supabase, query);
});
