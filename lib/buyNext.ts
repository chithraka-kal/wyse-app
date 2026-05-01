import { Item } from '@/types/wyse';

export function scoreSavingItem(item: Item, now: Date = new Date()): number {
  const priorityScore = item.priority * 1000;
  const ageInDays = (now.getTime() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = -(Math.floor(ageInDays / 7) * 100);
  const priceScore = item.price / 10;
  return priorityScore + ageScore + priceScore;
}

export function getBuyNextItem(savingItems: Item[]): Item | null {
  const active = savingItems.filter(i => i.status === 'active' && i.zone === 'saving');
  if (active.length === 0) return null;
  return active.sort((a, b) => scoreSavingItem(a) - scoreSavingItem(b))[0];
}

export function getDaysUntilAffordable(item: Item, availableSavings: number, weeklyContribution: number): number | null {
  const remaining = item.price - item.funded;
  const gap = remaining - availableSavings;
  if (gap <= 0) return 0;
  if (weeklyContribution <= 0) return null;
  return Math.ceil((gap / weeklyContribution) * 7);
}
