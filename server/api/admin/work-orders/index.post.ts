import { readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { createAdminWorkOrder } from '../../../utils/work-orders';
import { parseCreateWorkOrderBody } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const body = await readBody(event);
  const input = parseCreateWorkOrderBody(body);
  const response = await createAdminWorkOrder(supabase, input, userId);

  setResponseStatus(event, 201);

  return response;
});
