import { toMillis } from "../hooks/useIncidents";

// แปลง ms เป็นวันที่ไทย เช่น 03/11/2569
function formatThaiDate(ms) {
  return new Date(ms).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// หาวันที่แรกและวันที่สุดท้ายของเคสที่นำมาทำรายงาน
export function getDataDateRange(incidents) {
  const times = incidents.map((i) => toMillis(i.createdAt)).filter(Boolean);

  if (times.length === 0) return "ไม่มีข้อมูล";

  const first = Math.min(...times);
  const last = Math.max(...times);

  return formatThaiDate(first) === formatThaiDate(last)
    ? formatThaiDate(first)
    : `${formatThaiDate(first)} - ${formatThaiDate(last)}`;
}

// วันที่และเวลาที่กดส่งออก
export function getExportDateTime() {
  return new Date().toLocaleString("th-TH");
}