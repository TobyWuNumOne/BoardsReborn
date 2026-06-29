import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { listAdminCustomers } from '../../../utils/admin-customers';
import { defineApiHandler } from '../../../utils/api-handler';
import { parseAdminCustomerListQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseAdminCustomerListQuery(getQuery(event));

  return listAdminCustomers(supabase, query);
});
