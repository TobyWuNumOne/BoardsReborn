import { getRouterParam, readBody } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { parseUpdatePrintDeviceBody } from '../../../utils/print-job-validation';
import { updateAdminPrintDevice } from '../../../utils/print-devices';
import { parseUuid } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = await readBody(event);
  const input = parseUpdatePrintDeviceBody(body);

  return updateAdminPrintDevice(supabase, id, input);
});
