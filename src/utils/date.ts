import dayjs from "dayjs";
import "dayjs/locale/es";

// Set global locale to Spanish once
dayjs.locale("es");

/**
 * Format a date to DD-MMM-YYYY (e.g., 05-Mar-2026)
 */
export function formatDate(date: dayjs.ConfigType): string {
  if (!date) return "-";
  return dayjs(date).format("DD-MMM-YYYY");
}

/**
 * Format a time to h:mm A (12h AM-PM)
 */
export function formatTime(date: dayjs.ConfigType): string {
  if (!date) return "";
  return dayjs(date).format("h:mm A");
}

/**
 * Convenience: range string with the same format
 */
export function formatDateRange(start?: dayjs.ConfigType, end?: dayjs.ConfigType): string {
  const s = start ? formatDate(start) : "";
  const e = end ? formatDate(end) : "";
  return s && e ? `${s} - ${e}` : s || e || "";
}
