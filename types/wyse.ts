export type Zone = 'wishlist' | 'saving';
export type Tier = 'big' | 'medium' | 'small';
export type ItemStatus = 'active' | 'done' | 'removed';
export type Priority = 1 | 2 | 3;

export type Item = {
  _id: string;
  userId?: string | null;
  name: string;
  price: number;
  funded: number;
  zone: Zone;
  tier: Tier | null;
  status: ItemStatus;
  priority: Priority;
  notes: string;
  url: string;
  imageUrl: string;
  aiSuggested?: boolean;
  tags?: string[];
  addedAt: string;
  challengeQuestion?: string;
};

export type FundAllocation = {
  itemId: string;
  amount: number;
};

export type Fund = {
  _id: string;
  userId?: string | null;
  amount: number;
  source: string;
  unallocated: number;
  allocations: Array<{
    itemId: string | Item;
    amount: number;
  }>;
  aiAssisted?: boolean;
  receivedAt: string;
};
