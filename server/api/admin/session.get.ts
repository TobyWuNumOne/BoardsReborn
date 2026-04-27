import { ForbiddenError, UnauthorizedError } from '../../utils/api-errors';
import { getAdminSessionState } from '../../utils/admin-auth';
import { defineApiHandler } from '../../utils/api-handler';

export default defineApiHandler(async (event) => {
  const session = await getAdminSessionState(event);

  if (session.status === 'anonymous') {
    throw new UnauthorizedError();
  }

  if (session.status === 'forbidden') {
    throw new ForbiddenError('Admin access required.');
  }

  return {
    data: {
      displayName: session.profile.display_name,
      id: session.profile.id,
    },
  };
});
