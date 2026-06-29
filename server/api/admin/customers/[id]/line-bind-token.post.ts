import { getRouterParam, readBody, setResponseStatus } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import {
  issueAdminCustomerLineBindToken,
  parseAdminLineBindTokenBody,
} from '../../../../utils/admin-line-bindings';
import { defineApiHandler } from '../../../../utils/api-handler';
import { resolveLineBindTokenConfig } from '../../../../utils/line-bind-tokens';
import { parseUuid } from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase, userId } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  parseAdminLineBindTokenBody(await readBody(event));
  const config = useRuntimeConfig(event);
  const response = await issueAdminCustomerLineBindToken(
    supabase,
    { customerId: id, userId },
    resolveLineBindTokenConfig({
      liffId: config.public.liffId,
      lineBindTokenSecret: config.lineBindTokenSecret,
    }),
  );

  setResponseStatus(event, 201);
  return response;
});
