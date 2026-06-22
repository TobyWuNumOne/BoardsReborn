import { describe, expect, it, vi } from 'vitest';
import {
  LineAccessTokenInvalidError,
  LineIdTokenInvalidError,
  LinePlatformUnavailableError,
} from '../../server/utils/api-errors';
import { verifyLineIdentity } from '../../server/utils/line-platform';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });

describe('LINE Platform verification', () => {
  it('verifies the ID token and trusts only the server response subject', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        aud: '1234567890',
        name: 'LINE User',
        picture: 'https://profile.example/avatar.jpg',
        sub: 'U-trusted',
      }),
    );

    await expect(
      verifyLineIdentity({ idToken: 'id-token-from-liff' }, { channelId: '1234567890' }, fetch),
    ).resolves.toEqual({
      displayName: 'LINE User',
      friendship: 'unknown',
      lineUserId: 'U-trusted',
      pictureUrl: 'https://profile.example/avatar.jpg',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/oauth2/v2.1/verify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('verifies optional access token, profile identity, and friendship status', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sub: 'U-trusted' }))
      .mockResolvedValueOnce(
        jsonResponse({ client_id: '1234567890', expires_in: 1000, scope: 'profile' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          displayName: 'LINE User',
          pictureUrl: 'https://profile.example/avatar.jpg',
          userId: 'U-trusted',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ friendFlag: true }));

    await expect(
      verifyLineIdentity(
        { accessToken: 'access-token-from-liff', idToken: 'id-token-from-liff' },
        { channelId: '1234567890' },
        fetch,
      ),
    ).resolves.toMatchObject({ friendship: 'friend', lineUserId: 'U-trusted' });
  });

  it('rejects invalid ID and mismatched access-token identities', async () => {
    await expect(
      verifyLineIdentity(
        { idToken: 'invalid' },
        { channelId: '1234567890' },
        vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_request' }, 400)),
      ),
    ).rejects.toBeInstanceOf(LineIdTokenInvalidError);

    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sub: 'U-one' }))
      .mockResolvedValueOnce(jsonResponse({ client_id: '1234567890', expires_in: 1000 }))
      .mockResolvedValueOnce(jsonResponse({ userId: 'U-two' }));
    await expect(
      verifyLineIdentity(
        { accessToken: 'access', idToken: 'id' },
        { channelId: '1234567890' },
        fetch,
      ),
    ).rejects.toBeInstanceOf(LineAccessTokenInvalidError);
  });

  it('maps LINE network and 5xx failures to platform unavailable', async () => {
    await expect(
      verifyLineIdentity(
        { idToken: 'id' },
        { channelId: '1234567890' },
        vi.fn().mockRejectedValue(new Error('network error')),
      ),
    ).rejects.toBeInstanceOf(LinePlatformUnavailableError);
  });
});
