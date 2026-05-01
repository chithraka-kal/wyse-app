export function tierFromPrice(price: number): 'big' | 'medium' | 'small' {
  if (price >= 200) return 'big';
  if (price >= 50) return 'medium';
  return 'small';
}
