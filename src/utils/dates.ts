export function nowIso(): string {
  return new Date().toISOString();
}

export function isBeforeDate(date: string, comparisonDate: string): boolean {
  return Date.parse(date) < Date.parse(comparisonDate);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}
