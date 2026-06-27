import type { Json } from '../../types/database.types';
import lineBindingSuccessTemplate from '../../line-flex-message/line_binding_success.json';
import workOrderReadyForPickupTemplate from '../../line-flex-message/work_order_ready_for_pickup.json';
import workOrderReceivedTemplate from '../../line-flex-message/work_order_received.json';

type LineJobType = 'line_binding_success' | 'work_order_ready_for_pickup' | 'work_order_received';

export type LineFlexPreparedMessage = { [key: string]: Json | undefined };

interface LineFlexMessageInput {
  jobType: LineJobType;
  paperOrderNo: string;
}

const templatesByJobType: Record<LineJobType, unknown> = {
  line_binding_success: lineBindingSuccessTemplate,
  work_order_ready_for_pickup: workOrderReadyForPickupTemplate,
  work_order_received: workOrderReceivedTemplate,
};

const cloneTemplate = (template: unknown): Json => JSON.parse(JSON.stringify(template)) as Json;

const replacePaperOrderNo = (value: Json, paperOrderNo: string): Json => {
  if (typeof value === 'string') {
    return value
      .replaceAll('{{paperOrderNo}}', paperOrderNo)
      .replace(/\b260001\b/g, paperOrderNo)
      .replace(/\b260002\b/g, paperOrderNo);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePaperOrderNo(item, paperOrderNo));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replacePaperOrderNo(item ?? null, paperOrderNo),
      ]),
    );
  }

  return value;
};

export const getLineFlexAltText = (input: LineFlexMessageInput) => {
  if (input.jobType === 'work_order_ready_for_pickup') {
    return `工單 ${input.paperOrderNo} 維修完成，請預約取板`;
  }

  if (input.jobType === 'line_binding_success') {
    return `工單 ${input.paperOrderNo} 已綁定 LINE 通知`;
  }

  return `工單 ${input.paperOrderNo} 已收件`;
};

export const buildLineFlexMessages = (input: LineFlexMessageInput): LineFlexPreparedMessage[] => {
  const template = templatesByJobType[input.jobType];
  const contents = replacePaperOrderNo(cloneTemplate(template), input.paperOrderNo);

  return [
    {
      altText: getLineFlexAltText(input),
      contents,
      type: 'flex',
    },
  ];
};

export const isLineFlexMessageArray = (messages: unknown): messages is LineFlexPreparedMessage[] =>
  Array.isArray(messages) &&
  messages.some(
    (message) =>
      typeof message === 'object' &&
      message !== null &&
      !Array.isArray(message) &&
      (message as Record<string, unknown>).type === 'flex',
  );
