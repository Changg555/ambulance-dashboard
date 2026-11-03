export const DATE_PRESETS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "today", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "custom", label: "กำหนดช่วงวันที่เอง" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-03" -> เวลาเริ่มต้นหรือสิ้นสุดของวันนั้น (ms)
function parseDateInput(text, endOfDay) {
  const [y, m, d] = text.split("-").map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
    : new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

// เวลา createdAtMs อยู่ในช่วงที่เลือกหรือไม่
export function isWithinDateRange(createdAtMs, preset, customStart, customEnd) {
  if (preset === "all") return true;
  if (!createdAtMs) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + DAY_MS - 1;

  if (preset === "today") {
    return createdAtMs >= startOfToday && createdAtMs <= endOfToday;
  }

  if (preset === "week") {
    // สัปดาห์เริ่มวันจันทร์
    const dayOfWeek = now.getDay(); // 0 = อาทิตย์
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = startOfToday - daysSinceMonday * DAY_MS;
    return createdAtMs >= startOfWeek && createdAtMs <= endOfToday;
  }

  if (preset === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    return createdAtMs >= startOfMonth && createdAtMs <= endOfMonth;
  }

  if (preset === "custom") {
    const min = customStart ? parseDateInput(customStart, false) : -Infinity;
    const max = customEnd ? parseDateInput(customEnd, true) : Infinity;
    return createdAtMs >= min && createdAtMs <= max;
  }

  return true;
}