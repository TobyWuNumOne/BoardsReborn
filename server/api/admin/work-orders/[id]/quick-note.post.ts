import { getRouterParam, readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import { defineApiHandler } from '../../../../utils/api-handler';
import { appendAdminWorkOrderScanQuickNote } from '../../../../utils/work-orders';
import { parseAdminWorkOrderScanQuickNoteBody, parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = await readBody(event);
  const input = parseAdminWorkOrderScanQuickNoteBody(body);
  const response = await appendAdminWorkOrderScanQuickNote(supabase, id, input);

  setResponseStatus(event, 201);

  return response;
});
