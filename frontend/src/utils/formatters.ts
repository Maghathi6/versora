/**
 * Versora Formatting Utilities
 * Lightweight helpers for presentation formatting without external dependencies.
 */

/**
 * Formats a duration in seconds into a clean, human-readable string (e.g. "45s", "3m 12s", "2h 15m").
 */
export function formatUptime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0s';

  const seconds = Math.floor(totalSeconds % 60);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Formats an ISO string, timestamp, or Date into a standardized readable date-time.
 */
export function formatDate(input: string | number | Date): string {
  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return String(input);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(input);
  }
}

/**
 * Formats an arbitrary byte count into a human-friendly representation (e.g. "1.2 MB").
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (isNaN(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const normalizedIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, normalizedIndex)).toFixed(decimals))} ${sizes[normalizedIndex]}`;
}
