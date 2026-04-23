import { getRouterParam, readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import { defineApiHandler } from '../../../../utils/api-handler';
import { transitionAdminWorkOrderStatus } from '../../../../utils/work-orders';
import { parseStatusTransitionBody, parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = await readBody(event);
  const input = parseStatusTransitionBody(body);
  const response = await transitionAdminWorkOrderStatus(supabase, id, input, userId);

  setResponseStatus(event, 201);

  return response;
});
