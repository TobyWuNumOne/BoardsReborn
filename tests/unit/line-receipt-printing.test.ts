import { describe, expect, it, vi } from 'vitest';
import { LineBindTokenRequiredError } from '../../server/utils/api-errors';
import { deriveLineBindPlaintextToken } from '../../server/utils/line-bind-tokens';
import {
  buildCustomerReceiptDispatchPayload,
  createCustomerReceiptPrintJob,
} from '../../server/utils/print-jobs';

const TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'line-bind-secret-for-tests';
const runtimeConfig = {
  liffId: '1234567890-test',
  lineBindTokenSecret: SECRET,
  repairStatusUrl: 'https://status.surfboards-reborn.com/repair-status',
};

describe('customer receipt QR decisions', () => {
  it('issues a token for an unbound initial receipt and stores only its row reference', async () => {
    const issueToken = vi.fn().mockResolvedValue({ row: { id: TOKEN_ID } });
    const createSnapshot = vi.fn().mockResolvedValue({ id: 'job-1' });

    await expect(
      createCustomerReceiptPrintJob(
        {
          customerId: 'customer-1',
          hasBinding: false,
          mode: 'initial',
          userId: 'admin-1',
          workOrderId: 'work-order-1',
        },
        { createSnapshot, findActiveToken: vi.fn(), issueToken },
      ),
    ).resolves.toMatchObject({ qrKind: 'line_bind', warning: null });

    expect(createSnapshot).toHaveBeenCalledWith({
      lineBindTokenId: TOKEN_ID,
      qrKind: 'line_bind',
      userId: 'admin-1',
      workOrderId: 'work-order-1',
    });
    expect(JSON.stringify(createSnapshot.mock.calls)).not.toContain('liff.line.me');
    expect(JSON.stringify(createSnapshot.mock.calls)).not.toContain(
      deriveLineBindPlaintextToken(TOKEN_ID, SECRET),
    );
  });

  it('uses repair status for a bound customer without issuing a token', async () => {
    const issueToken = vi.fn();
    const createSnapshot = vi.fn().mockResolvedValue({ id: 'job-1' });
    await createCustomerReceiptPrintJob(
      {
        customerId: 'customer-1',
        hasBinding: true,
        mode: 'initial',
        userId: 'admin-1',
        workOrderId: 'work-order-1',
      },
      { createSnapshot, findActiveToken: vi.fn(), issueToken },
    );
    expect(issueToken).not.toHaveBeenCalled();
    expect(createSnapshot).toHaveBeenCalledWith({
      lineBindTokenId: null,
      qrKind: 'repair_status',
      userId: 'admin-1',
      workOrderId: 'work-order-1',
    });
  });

  it('falls back to repair status when initial token issuance fails', async () => {
    const createSnapshot = vi.fn().mockResolvedValue({ id: 'job-1' });
    await expect(
      createCustomerReceiptPrintJob(
        {
          customerId: 'customer-1',
          hasBinding: false,
          mode: 'initial',
          userId: 'admin-1',
          workOrderId: 'work-order-1',
        },
        {
          createSnapshot,
          findActiveToken: vi.fn(),
          issueToken: vi.fn().mockRejectedValue(new Error('token insert failed')),
        },
      ),
    ).resolves.toMatchObject({ qrKind: 'repair_status', warning: 'LINE_BIND_TOKEN_ISSUE_FAILED' });
  });

  it('reuses an active pending token for reprint and never auto-issues', async () => {
    const issueToken = vi.fn();
    const createSnapshot = vi.fn().mockResolvedValue({ id: 'job-2' });
    await createCustomerReceiptPrintJob(
      {
        customerId: 'customer-1',
        hasBinding: false,
        mode: 'reprint',
        userId: 'admin-1',
        workOrderId: 'work-order-1',
      },
      { createSnapshot, findActiveToken: vi.fn().mockResolvedValue({ id: TOKEN_ID }), issueToken },
    );
    expect(issueToken).not.toHaveBeenCalled();
    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ lineBindTokenId: TOKEN_ID, qrKind: 'line_bind' }),
    );
  });

  it('requires explicit reissue when an unbound reprint has no pending token', async () => {
    await expect(
      createCustomerReceiptPrintJob(
        {
          customerId: 'customer-1',
          hasBinding: false,
          mode: 'reprint',
          userId: 'admin-1',
          workOrderId: 'work-order-1',
        },
        {
          createSnapshot: vi.fn(),
          findActiveToken: vi.fn().mockResolvedValue(null),
          issueToken: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(LineBindTokenRequiredError);
  });
});

describe('customer receipt worker dispatch', () => {
  it('temporarily rebuilds a LIFF URL from a token row reference', () => {
    const payload = {
      lineBindTokenId: TOKEN_ID,
      paperOrderNo: '260001',
      qrKind: 'line_bind',
      templateVersion: 2,
    };
    const dispatched = buildCustomerReceiptDispatchPayload(payload, runtimeConfig);
    expect(payload).not.toHaveProperty('publicLookupUrl');
    expect(dispatched.publicLookupUrl).toBe(
      `https://liff.line.me/1234567890-test/?t=${deriveLineBindPlaintextToken(TOKEN_ID, SECRET)}`,
    );
  });

  it('temporarily supplies repair status and preserves immutable legacy snapshots', () => {
    expect(
      buildCustomerReceiptDispatchPayload(
        { paperOrderNo: '260001', qrKind: 'repair_status', templateVersion: 2 },
        runtimeConfig,
      ),
    ).toMatchObject({ publicLookupUrl: runtimeConfig.repairStatusUrl });

    const legacy = {
      paperOrderNo: '250001',
      publicLookupUrl: 'https://legacy.example/repair-status',
      templateVersion: 1,
    };
    expect(buildCustomerReceiptDispatchPayload(legacy, runtimeConfig)).toEqual(legacy);
  });
});
