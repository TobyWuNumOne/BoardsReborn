import { getHeader, type H3Event } from 'h3';
import { ForbiddenError, InternalServerError, UnauthorizedError } from './api-errors';
import { getServiceRoleSupabaseClient, type ServiceRoleSupabaseClient } from './supabase-clients';
import type { Database } from '../../types/database.types';

const PRINT_WORKER_AUTH_HEADER = 'authorization';

type PrintDeviceRow = Pick<
  Database['public']['Tables']['print_devices']['Row'],
  'device_key' | 'id' | 'name' | 'status'
>;

const readFirstNonEmpty = (...values: Array<string | undefined | null>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const resolvePrintWorkerToken = (env: NodeJS.ProcessEnv = process.env) =>
  readFirstNonEmpty(env.PRINT_WORKER_TOKEN, env.PRINT_AGENT_TOKEN);

const parseBearerToken = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export interface PrintWorkerContext {
  device: PrintDeviceRow;
  supabase: ServiceRoleSupabaseClient;
}

export const requirePrintWorkerContext = async (
  event: H3Event,
  deviceKey: string,
): Promise<PrintWorkerContext> => {
  const configuredToken = resolvePrintWorkerToken();

  if (!configuredToken) {
    throw new InternalServerError('Print worker authentication is not configured.');
  }

  const presentedToken = parseBearerToken(getHeader(event, PRINT_WORKER_AUTH_HEADER));

  if (!presentedToken || presentedToken !== configuredToken) {
    throw new UnauthorizedError('Print worker authentication failed.');
  }

  const supabase = await getServiceRoleSupabaseClient(event);
  const { data: device, error } = await supabase
    .from('print_devices')
    .select('id, name, device_key, status')
    .eq('device_key', deviceKey)
    .maybeSingle();

  if (error) {
    throw new InternalServerError('Unable to verify print worker device.');
  }

  if (!device) {
    throw new UnauthorizedError('Print worker authentication failed.');
  }

  if (device.status !== 'active') {
    throw new ForbiddenError('Print worker device is inactive.');
  }

  return {
    device,
    supabase,
  };
};
