import { readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { parseCreatePrintDeviceBody } from '../../../utils/print-job-validation';
import { createAdminPrintDevice } from '../../../utils/print-devices';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const body = await readBody(event);
  const input = parseCreatePrintDeviceBody(body);
  const response = await createAdminPrintDevice(supabase, input);

  setResponseStatus(event, 201);

  return response;
});
