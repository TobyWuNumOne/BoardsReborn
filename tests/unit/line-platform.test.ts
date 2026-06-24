import { describe, expect, it, vi } from 'vitest';
import {
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

  it('rejects invalid ID tokens', async () => {
    await expect(
      verifyLineIdentity(
        { idToken: 'invalid' },
        { channelId: '1234567890' },
        vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid_request' }, 400)),
      ),
    ).rejects.toBeInstanceOf(LineIdTokenInvalidError);
  });

  it('treats optional access token failures as best-effort enrichment misses', async () => {
    const invalidAccessFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ name: 'ID Name', picture: 'id-picture', sub: 'U-one' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid_token' }, 401));

    await expect(
      verifyLineIdentity(
        { accessToken: 'bad-access', idToken: 'id' },
        { channelId: '1234567890' },
        invalidAccessFetch,
      ),
    ).resolves.toEqual({
      displayName: 'ID Name',
      friendship: 'unknown',
      lineUserId: 'U-one',
      pictureUrl: 'id-picture',
    });

    const mismatchedProfileFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sub: 'U-one' }))
      .mockResolvedValueOnce(jsonResponse({ client_id: '1234567890', expires_in: 1000 }))
      .mockResolvedValueOnce(jsonResponse({ userId: 'U-two' }));
    await expect(
      verifyLineIdentity(
        { accessToken: 'access', idToken: 'id' },
        { channelId: '1234567890' },
        mismatchedProfileFetch,
      ),
    ).resolves.toMatchObject({ friendship: 'unknown', lineUserId: 'U-one' });
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
