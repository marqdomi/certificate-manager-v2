// frontend/src/utils/formatters.js
// ============================================================================
// CMT Design System — Shared Utility Functions
// ============================================================================
// Centralized helpers that were previously duplicated across 4+ files.
// Import from here instead of reimplementing per-component.
// ============================================================================

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ---------------------------------------------------------------------------
// 1. Date Formatting
// ---------------------------------------------------------------------------

/**
 * Format a date string or timestamp into a human-readable format.
 * @param {string|Date|number|null|undefined} date
 * @param {string} format - dayjs format string (default: 'MMM D, YYYY')
 * @returns {string} Formatted date or '—' for invalid input
 */
export function formatDate(date, format = 'MMM D, YYYY') {
  if (!date) return '—';
  const d = dayjs(date);
  return d.isValid() ? d.format(format) : '—';
}

/**
 * Format a date with time.
 * @param {string|Date|number|null|undefined} date
 * @returns {string}
 */
export function formatDateTime(date) {
  return formatDate(date, 'MMM D, YYYY · HH:mm');
}

/**
 * Get a relative time string (e.g., "2 hours ago", "in 3 days").
 * @param {string|Date|number|null|undefined} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  if (!date) return '—';
  const d = dayjs(date);
  return d.isValid() ? d.fromNow() : '—';
}

/**
 * Calculate days remaining until a date.
 * @param {string|Date|null|undefined} date
 * @returns {number|null}
 */
export function daysUntil(date) {
  if (!date) return null;
  const d = dayjs(date);
  if (!d.isValid()) return null;
  return d.diff(dayjs(), 'day');
}

// ---------------------------------------------------------------------------
// 2. Clipboard
// ---------------------------------------------------------------------------

/**
 * Copy text to clipboard with error handling.
 * @param {string} text
 * @returns {Promise<boolean>} true if copy succeeded
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. File Download
// ---------------------------------------------------------------------------

/**
 * Download content as a file.
 * @param {string|Blob} content - File content
 * @param {string} filename - Name for the downloaded file
 * @param {string} [mimeType='text/plain'] - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download data as CSV.
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCSV(csvContent, filename) {
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

// ---------------------------------------------------------------------------
// 4. Number Formatting
// ---------------------------------------------------------------------------

/**
 * Format a number with locale-aware separators.
 * @param {number} num
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(num, decimals = 0) {
  if (num == null || isNaN(num)) return '—';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format bytes into human-readable size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// 5. String Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 40) {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/**
 * Get initials from a full name (e.g., "John Doe" → "JD").
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
