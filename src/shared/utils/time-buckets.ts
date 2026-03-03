export type Granularity = 'hour' | 'day' | 'week' | 'month';

export function getBucketStart(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  switch (granularity) {
    case 'hour':
      d.setMinutes(0, 0, 0);
      return d;
    case 'day':
      d.setHours(0, 0, 0, 0);
      return d;
    case 'week': {
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      return d;
    }
    case 'month':
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      return d;
  }
}

export function formatBucketKey(date: Date, granularity: Granularity): string {
  const bucket = getBucketStart(date, granularity);
  return bucket.toISOString();
}
