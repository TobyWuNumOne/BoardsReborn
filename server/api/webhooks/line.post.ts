import { getHeader, readRawBody } from 'h3';
import { defineApiHandler } from '../../utils/api-handler';
import { getServiceRoleSupabaseClient } from '../../utils/supabase-clients';
import {
  verifyLineWebhookSignature,
  parseLineWebhookBody,
  processLineWebhookEvents,
  updateLineFriendshipStatus,
} from '../../utils/line-webhook';

export default defineApiHandler(async (event) => {
  const rawBody = (await readRawBody(event, false)) ?? Buffer.alloc(0);
  const config = useRuntimeConfig(event);
  verifyLineWebhookSignature(
    rawBody,
    getHeader(event, 'x-line-signature'),
    config.lineChannelSecret,
  );
  const body = parseLineWebhookBody(rawBody);
  const supabase = await getServiceRoleSupabaseClient(event);
  const result = await processLineWebhookEvents(body, {
    updateFriendship: (input) => updateLineFriendshipStatus(supabase, input),
  });

  return { data: result };
});
