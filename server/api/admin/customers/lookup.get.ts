import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { lookupAdminCustomers } from '../../../utils/work-orders';
import { parseCustomerLookupQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseCustomerLookupQuery(getQuery(event));

  return lookupAdminCustomers(supabase, query.normalizedPhone);
});
