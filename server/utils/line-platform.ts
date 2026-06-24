import {
  InternalServerError,
  LineAccessTokenInvalidError,
  LineIdTokenInvalidError,
  LinePlatformUnavailableError,
} from './api-errors';

interface VerifyLineIdentityInput {
  accessToken?: string;
  idToken: string;
}

interface LinePlatformConfig {
  channelId: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const parseJson = async (response: Response) => {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new LinePlatformUnavailableError();
  }
};

const fetchLine = async (fetch: FetchLike, input: string, init?: RequestInit) => {
  try {
    return await fetch(input, init);
  } catch {
    throw new LinePlatformUnavailableError();
  }
};

const assertConfig = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new InternalServerError('LINE Login configuration is missing.');
  return trimmed;
};

export const verifyLineIdentity = async (
  input: VerifyLineIdentityInput,
  config: LinePlatformConfig,
  fetch: FetchLike = globalThis.fetch,
) => {
  const channelId = assertConfig(config.channelId);
  const idResponse = await fetchLine(fetch, 'https://api.line.me/oauth2/v2.1/verify', {
    body: new URLSearchParams({ client_id: channelId, id_token: input.idToken }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (idResponse.status >= 500) throw new LinePlatformUnavailableError();
  if (!idResponse.ok) throw new LineIdTokenInvalidError();

  const idPayload = await parseJson(idResponse);
  if (typeof idPayload.sub !== 'string' || idPayload.sub.length === 0) {
    throw new LineIdTokenInvalidError();
  }

  let displayName = typeof idPayload.name === 'string' ? idPayload.name : null;
  let pictureUrl = typeof idPayload.picture === 'string' ? idPayload.picture : null;
  let friendship: 'friend' | 'not_friend' | 'unknown' = 'unknown';

  if (input.accessToken) {
    try {
      const accessResponse = await fetchLine(
        fetch,
        `https://api.line.me/oauth2/v2.1/verify?${new URLSearchParams({ access_token: input.accessToken })}`,
      );
      if (accessResponse.status >= 500) throw new LinePlatformUnavailableError();
      if (!accessResponse.ok) throw new LineAccessTokenInvalidError();
      const accessPayload = await parseJson(accessResponse);
      if (accessPayload.client_id !== channelId) throw new LineAccessTokenInvalidError();

      const authorization = { Authorization: `Bearer ${input.accessToken}` };
      const profileResponse = await fetchLine(fetch, 'https://api.line.me/v2/profile', {
        headers: authorization,
      });
      if (profileResponse.status >= 500) throw new LinePlatformUnavailableError();
      if (!profileResponse.ok) throw new LineAccessTokenInvalidError();
      const profile = await parseJson(profileResponse);
      if (profile.userId !== idPayload.sub) throw new LineAccessTokenInvalidError();
      displayName = typeof profile.displayName === 'string' ? profile.displayName : displayName;
      pictureUrl = typeof profile.pictureUrl === 'string' ? profile.pictureUrl : pictureUrl;

      const friendshipResponse = await fetchLine(
        fetch,
        'https://api.line.me/friendship/v1/status',
        {
          headers: authorization,
        },
      );
      if (friendshipResponse.status >= 500) throw new LinePlatformUnavailableError();
      if (!friendshipResponse.ok) throw new LineAccessTokenInvalidError();
      const friendshipPayload = await parseJson(friendshipResponse);
      if (typeof friendshipPayload.friendFlag !== 'boolean')
        throw new LineAccessTokenInvalidError();
      friendship = friendshipPayload.friendFlag ? 'friend' : 'not_friend';
    } catch (error) {
      if (
        !(error instanceof LineAccessTokenInvalidError) &&
        !(error instanceof LinePlatformUnavailableError)
      ) {
        throw error;
      }
    }
  }

  return {
    displayName,
    friendship,
    lineUserId: idPayload.sub,
    pictureUrl,
  };
};
