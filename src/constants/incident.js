export const INCIDENT_TYPES = {
  car_accident: { label: "อุบัติเหตุรถ", shortLabel: "อุบัติเหตุรถ", color: "#3B82F6" },
  cardiac: { label: "หัวใจ/หมดสติ", shortLabel: "หัวใจ/หมดสติ", color: "#EC4899" },
  injury: { label: "บาดเจ็บ", shortLabel: "บาดเจ็บ", color: "#F59E0B" },
  fire: { label: "ไฟไหม้", shortLabel: "ไฟไหม้", color: "#EF4444" },
  drowning: { label: "จมน้ำ", shortLabel: "จมน้ำ", color: "#06B6D4" },
  sos: { label: "แจ้งเหตุด่วน (SOS)", shortLabel: "SOS", color: "#DC2626" },
  other: { label: "เหตุอื่น ๆ", shortLabel: "เหตุอื่น ๆ", color: "#64748B" },
};

export const SEVERITIES = {
  critical: { label: "วิกฤต", rank: 4, color: "#EF4444" },
  high: { label: "รุนแรง", rank: 3, color: "#F97316" },
  medium: { label: "ปานกลาง", rank: 2, color: "#F59E0B" },
  low: { label: "ไม่รุนแรง", rank: 1, color: "#22C55E" },
};

export const STATUS_LABELS = {
  pending: "รอเจ้าหน้าที่รับเรื่อง",
  accepted: "เจ้าหน้าที่รับเรื่องแล้ว",
  on_the_way: "กำลังเดินทางไปหาคุณ",
  arrived: "ถึงจุดเกิดเหตุแล้ว",
  completed: "ช่วยเหลือเสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

export const STATUS_COLORS = {
  pending: "#EF4444",
  accepted: "#3B82F6",
  on_the_way: "#8B5CF6",
  arrived: "#14B884",
  completed: "#16A34A",
};

export const STATUS_FLOW = ["pending", "accepted", "on_the_way", "arrived", "completed"];
export const CLOSED_STATUSES = ["completed", "cancelled"];

export const SORT_OPTIONS = [
  { value: "newest", label: "เวลาแจ้ง: เรียงจากล่าสุด" },
  { value: "oldest", label: "เวลาแจ้ง: เรียงจากเก่าสุด" },
  { value: "severity_desc", label: "ความรุนแรง: วิกฤต → ไม่รุนแรง" },
  { value: "severity_asc", label: "ความรุนแรง: ไม่รุนแรง → วิกฤต" },
];

export function toOptions(config) {
  return Object.entries(config).map(([value, item]) => ({ value, label: item.label }));
}