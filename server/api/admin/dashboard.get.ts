import { requireAdminContext } from '../../utils/admin-auth';
import { defineApiHandler } from '../../utils/api-handler';
import { getAdminDashboardSummary } from '../../utils/work-orders';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);

  return getAdminDashboardSummary(supabase);
});
