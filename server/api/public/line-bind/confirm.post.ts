import { readBody, setHeader } from 'h3';
import { defineApiHandler } from '../../../utils/api-handler';
import { verifyLineIdentity } from '../../../utils/line-platform';
import {
  confirmPublicLineBinding,
  parsePublicLineBindConfirmBody,
} from '../../../utils/public-line-bindings';
import { enforcePublicLineBindRateLimit } from '../../../utils/public-rate-limit';
import { getServiceRoleSupabaseClient } from '../../../utils/supabase-clients';

export default defineApiHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  enforcePublicLineBindRateLimit(event);
  const input = parsePublicLineBindConfirmBody(await readBody(event));
  const config = useRuntimeConfig(event);
  const supabase = await getServiceRoleSupabaseClient(event);

  return confirmPublicLineBinding(supabase, input, {
    officialLineUrl: config.public.lineOfficialUrl,
    verifyLineIdentity: (tokens) =>
      verifyLineIdentity(tokens, { channelId: config.lineLoginChannelId }),
  });
});
