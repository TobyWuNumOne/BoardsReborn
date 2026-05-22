import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { listAdminPrintDevices } from '../../../utils/print-devices';
import { parsePrintDeviceListQuery } from '../../../utils/print-job-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parsePrintDeviceListQuery(getQuery(event));

  return listAdminPrintDevices(supabase, query);
});
