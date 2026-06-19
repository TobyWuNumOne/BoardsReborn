import type { Database } from '../../types/database.types';

type BoardType = Database['public']['Enums']['board_type'];

export interface PublicRepairFeeItem {
  amount: string;
  label: string;
}

export interface PublicRepairFeeSection {
  items: PublicRepairFeeItem[];
  title: string;
}

export interface PublicBoardRepairInfo {
  boardLabel: string;
  feeNote: string;
  feeSections: PublicRepairFeeSection[];
  workdayNote: string;
}

export const PUBLIC_REPAIR_SHOP_INFO = {
  address: '宜蘭縣頭城鎮青雲路三段387巷1號',
  bankAccount: '5425899016440',
  bankCode: '006',
  businessHours: '週一～五 8AM~17PM / 週六、日 7AM~12PM',
  officialLineHref: 'https://lin.ee/9KhX6kf',
  officialLineLabel: '官方 LINE',
  ownerName: '李小龍',
  pickupReminder: '取板務必請先透過官方 LINE 預約',
  shopName: '板再生維修',
} as const;

const surfboardInfo: PublicBoardRepairInfo = {
  boardLabel: '衝浪板',
  feeNote: '以上皆需現場評估報價為主',
  feeSections: [
    {
      title: '費用計算',
      items: [
        { amount: 'NT$400', label: '基本費（每張）' },
        { amount: 'NT$100', label: '+1公分' },
        { amount: 'NT$400，最多 NT$1500', label: '+上色一色' },
        { amount: 'NT$400，最多 NT$1500', label: '+拋光一處' },
        { amount: 'NT$2500', label: '長板中舵 Fin Box' },
        { amount: 'NT$2000', label: 'FCS2 Fin Box' },
        { amount: 'NT$2000', label: 'FUTURES Fin Box' },
        { amount: 'NT$800', label: 'FCS1 Fin Box' },
      ],
    },
  ],
  workdayNote: '補板工作天數估計，沒進水約七個工作天；有進水約十個工作天以上，視情況而定。',
};

export const PUBLIC_BOARD_REPAIR_INFO: Record<BoardType, PublicBoardRepairInfo> = {
  SNOWBOARD: {
    boardLabel: '雪板',
    feeNote: '以上皆需現場評估報價為主',
    feeSections: [
      {
        title: '費用計算',
        items: [
          { amount: 'NT$400', label: '3cm 以下' },
          { amount: 'NT$800', label: '3~8cm' },
          { amount: '每公分 +NT$200', label: '8cm 以上' },
          { amount: 'NT$200', label: '鋼邊修復 1cm' },
          { amount: 'NT$200', label: '拋光（1處）' },
          { amount: 'NT$200', label: '噴色一色' },
          { amount: 'NT$400', label: '店家代送費' },
        ],
      },
      {
        title: '雪板保養費用',
        items: [
          { amount: 'NT$1000', label: '手工打蠟（單層）' },
          { amount: 'NT$1500', label: '手工打蠟（三層）' },
          { amount: 'NT$1000', label: '開刃' },
          { amount: 'NT$1000', label: '修刃（含除鏽）' },
          { amount: 'NT$500', label: '鋼邊局部除鏽' },
        ],
      },
    ],
    workdayNote: '補板工作天數估計，約五個工作天。',
  },
  SUP: {
    ...surfboardInfo,
    boardLabel: 'SUP',
  },
  SURFBOARD: surfboardInfo,
};

export const PUBLIC_REPAIR_NOTICE_ITEMS = [
  '補板前請仔細檢查板子，將待補位置圈寫至補板單，上方留下姓名與電話，以便報價與聯繫。',
  `補板費請於完成報價後三日內完成轉帳付款。（銀行代號：${PUBLIC_REPAIR_SHOP_INFO.bankCode} 帳號：${PUBLIC_REPAIR_SHOP_INFO.bankAccount}）`,
  '付完款後才會進入修補排程，我們不主動通知修補進度，請主動於預估時程內來電確認維修進度，再電話預約時間取板。',
  '調色不保證百分百無色差，對色差極度敏銳者，請謹慎考慮。',
  '通知修理工作完成日起算 14 日內，請將板子領回；超過 14 日不領者，每周加收 NT$200 寄板費，費用累計超過補板費用時，板子將以補板費價格出售。',
] as const;

export const getPublicBoardRepairInfo = (boardType: BoardType) =>
  PUBLIC_BOARD_REPAIR_INFO[boardType];
