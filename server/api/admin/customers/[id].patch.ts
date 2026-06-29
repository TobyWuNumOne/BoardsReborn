import { getRouterParam, readBody } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { updateAdminCustomer } from '../../../utils/admin-customers';
import { defineApiHandler } from '../../../utils/api-handler';
import { parseAdminCustomerUpdateBody, parseUuid } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = parseAdminCustomerUpdateBody(await readBody(event));

  return updateAdminCustomer(supabase, id, body);
});
