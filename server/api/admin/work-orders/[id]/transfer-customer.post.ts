import { getRouterParam, readBody } from 'h3';
import { requireAdminContext } from '../../../../utils/admin-auth';
import { defineApiHandler } from '../../../../utils/api-handler';
import { transferAdminWorkOrderCustomer } from '../../../../utils/admin-customers';
import {
  parseUuid,
  parseWorkOrderTransferCustomerBody,
} from '../../../../utils/work-order-validation';

export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const id = parseUuid(getRouterParam(event, 'id'), 'id');
  const body = parseWorkOrderTransferCustomerBody(await readBody(event));

  return transferAdminWorkOrderCustomer(supabase, id, body.targetCustomerId);
});
