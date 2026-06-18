import { getQuery } from 'h3';
import { requireAdminContext } from '../../../utils/admin-auth';
import { defineApiHandler } from '../../../utils/api-handler';
import { getNextAdminPaperOrderNo } from '../../../utils/work-orders';
import { parseNextPaperOrderNoQuery } from '../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseNextPaperOrderNoQuery(getQuery(event));

  return getNextAdminPaperOrderNo(supabase, query.mode);
});
