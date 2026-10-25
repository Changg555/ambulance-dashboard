
export function csvCell(val, { asText = false } = {}) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "";

  let str = String(val);

  // เบอร์โทร/รหัสที่ต้องคงเลข 0 นำหน้า -> ="0812345678"
  if (asText) return `"=""${str.replace(/"/g, '""')}"""`;

  // กัน formula injection จากข้อความที่ผู้ใช้กรอกมา
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;

  return `"${str.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows) {
  return "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// วันที่/เวลาแบบ ISO ท้องถิ่น (Excel อ่านเป็นวันที่ได้และเรียงลำดับได้)
export const isoDate = (ms) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "");
export const isoTime = (ms) => (ms ? new Date(ms).toLocaleTimeString("en-GB") : "");
export const diffMinutes = (a, b) =>
  a && b && b >= a ? Math.round((b - a) / 60000) : null;

export const maskPhone = (p) =>
  p && p.length >= 10 ? `${p.slice(0, 3)}-xxx-${p.slice(-4)}` : p || "";