import { getRouterParam } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import { unlinkAdminCustomerLineBinding } from '../../../../utils/admin-line-bindings';
import { defineApiHandler } from '../../../../utils/api-handler';
import { parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');

  return unlinkAdminCustomerLineBinding(supabase, id);
});
