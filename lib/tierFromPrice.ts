export function tierFromPrice(price: number): 'big' | 'medium' | 'small' {
  // LKR thresholds:
  // big: > 10000, medium: 4000-10000, small: < 4000
  if (price > 10000) return 'big';
  if (price >= 4000) return 'medium';
  return 'small';
}
