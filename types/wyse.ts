export type Zone = "incubator" | "definite";
export type Tier = "high" | "mid" | "low";
export type ItemStatus = "active" | "done" | "dropped";

export type Item = {
  _id: string;
  name: string;
  price: number;
  funded: number;
  zone: Zone;
  tier: Tier | null;
  status: ItemStatus;
  promoteAfter: string | null;
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
