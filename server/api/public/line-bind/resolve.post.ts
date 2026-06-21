import { readBody, setHeader } from 'h3';
import { defineApiHandler } from '../../../utils/api-handler';
import {
  parsePublicLineBindResolveBody,
  resolvePublicLineBinding,
} from '../../../utils/public-line-bindings';
import { enforcePublicLineBindRateLimit } from '../../../utils/public-rate-limit';
import { getServiceRoleSupabaseClient } from '../../../utils/supabase-clients';

export default defineApiHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  enforcePublicLineBindRateLimit(event);
  const input = parsePublicLineBindResolveBody(await readBody(event));
  const supabase = await getServiceRoleSupabaseClient(event);
  return resolvePublicLineBinding(supabase, input.token);
});
