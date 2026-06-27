import { describe, expect, it } from 'vitest';
import {
  buildLineFlexMessages,
  getLineFlexAltText,
  isLineFlexMessageArray,
} from '../../server/utils/line-flex-messages';

const stringify = (value: unknown) => JSON.stringify(value);

describe('LINE Flex message templates', () => {
  it.each([
    ['line_binding_success', '880001', '工單 880001 已綁定 LINE 通知'],
    ['work_order_received', '880002', '工單 880002 已收件'],
    ['work_order_ready_for_pickup', '880003', '工單 880003 維修完成，請預約取板'],
  ] as const)('builds %s with the dynamic paper order number', (jobType, paperOrderNo, altText) => {
    const messages = buildLineFlexMessages({ jobType, paperOrderNo });
    const source = stringify(messages);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ altText, type: 'flex' });
    expect(source).toContain(paperOrderNo);
    expect(source).not.toContain('260001');
    expect(source).not.toContain('260002');
  });

  it('keeps the ready-for-pickup reservation button as a message action', () => {
    const messages = buildLineFlexMessages({
      jobType: 'work_order_ready_for_pickup',
      paperOrderNo: '880003',
    });

    expect(stringify(messages)).toContain('"type":"message"');
    expect(stringify(messages)).toContain('"label":"預約取板"');
    expect(stringify(messages)).toContain('"text":"預約取板"');
  });

  it('uses safe alt text per notification type', () => {
    expect(getLineFlexAltText({ jobType: 'work_order_received', paperOrderNo: '880002' })).toBe(
      '工單 880002 已收件',
    );
    expect(isLineFlexMessageArray([{ type: 'flex' }])).toBe(true);
    expect(isLineFlexMessageArray([{ text: 'plain text', type: 'text' }])).toBe(false);
  });
});
