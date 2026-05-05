import { readBody } from 'h3';
import { defineApiHandler } from '../../../utils/api-handler';
import { enforcePublicLookupRateLimit } from '../../../utils/public-rate-limit';
import { getServiceRoleSupabaseClient } from '../../../utils/supabase-clients';
import { parsePublicWorkOrderLookupBody } from '../../../utils/work-order-validation';
import { lookupPublicWorkOrder } from '../../../utils/work-orders';

export default defineApiHandler(async (event) => {
  enforcePublicLookupRateLimit(event);

  const body = await readBody(event);
  const input = parsePublicWorkOrderLookupBody(body);
  const supabase = await getServiceRoleSupabaseClient(event);

  return lookupPublicWorkOrder(supabase, input);
});
