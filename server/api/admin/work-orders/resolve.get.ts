import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { resolveAdminWorkOrderByPaperOrderNo } from '../../../utils/work-orders';
import { parsePaperOrderResolveQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parsePaperOrderResolveQuery(getQuery(event));

  return resolveAdminWorkOrderByPaperOrderNo(supabase, query.paperOrderNo);
});
