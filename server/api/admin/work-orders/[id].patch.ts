import { getRouterParam, readBody } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { patchAdminWorkOrder } from '../../../utils/work-orders';
import { parsePatchWorkOrderBody, parseUuid } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = await readBody(event);
  const patch = parsePatchWorkOrderBody(body);

  return patchAdminWorkOrder(supabase, id, patch);
});
