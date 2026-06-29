import { getQuery, getRouterParam } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { getAdminCustomerDetail } from '../../../utils/admin-customers';
import { defineApiHandler } from '../../../utils/api-handler';
import {
  parseAdminCustomerDetailQuery,
  parseUuid,
} from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const query = parseAdminCustomerDetailQuery(getQuery(event));

  return getAdminCustomerDetail(supabase, id, query);
});
