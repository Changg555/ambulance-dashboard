import { toMillis } from "../hooks/useIncidents";
import { INCIDENT_TYPES, SEVERITIES } from "../constants/incident";

export const diffMin = (from, to) => {
  const a = toMillis(from);
  const b = toMillis(to);
  return a && b && b >= a ? (b - a) / 60000 : null;
};

export const round1 = (n) =>
  n === null || n === undefined ? null : Math.round(n * 10) / 10;

export const avgMin = (list) => {
  const v = (list || []).filter((x) => x !== null && x !== undefined);
  return v.length ? round1(v.reduce((s, x) => s + x, 0) / v.length) : null;
};

// เวลาที่เคสเข้าสถานะนั้น ๆ (root field ก่อน แล้วค่อย fallback ไป timeline)
export const getStatusTime = (item, status) =>
  toMillis(item?.[`${status}At`]) ??
  item?.timeline?.find((t) => t.status === status)?.time ??
  null;

export const normType = (t) => (INCIDENT_TYPES[t] ? t : "other");
export const normSeverity = (s) => (SEVERITIES[s] ? s : "unknown");

const emptySeverity = () => ({
  ...Object.fromEntries(Object.keys(SEVERITIES).map((k) => [k, 0])),
  unknown: 0,
});

const emptyDay = (dateKey, dateDisplay) => ({
  dateKey,
  dateDisplay,
  total: 0,
  severity: emptySeverity(),
  types: {},
  completed: 0,
  cancelled: 0,
  active: 0,
  acceptSamples: [],   // นาที: createdAt -> accepted
  handlingSamples: [], // นาที: createdAt -> completedAt (เฉพาะเคสเสร็จสิ้น)
});

/** สถิติรายวัน มีทั้งแยกตามความรุนแรงและประเภทในแถวเดียว */
export function computeDailyStats(incidents) {
  const map = {};

  incidents.forEach((item) => {
    const ms = toMillis(item.createdAt);
    if (!ms) return;
    const d = new Date(ms);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!map[dateKey]) {
      map[dateKey] = emptyDay(
        dateKey,
        d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
      );
    }
    const row = map[dateKey];
    row.total += 1;
    row.severity[normSeverity(item.severity)] += 1;
    const t = normType(item.type);
    row.types[t] = (row.types[t] || 0) + 1;

    if (item.status === "completed") {
      row.completed += 1;
      const m = diffMin(ms, item.completedAt);
      if (m !== null) row.handlingSamples.push(m);
    } else if (item.status === "cancelled") {
      row.cancelled += 1;
    } else if (!item.archived) {
      row.active += 1; // นิยามเดียวกับ filteredSummary.active
    }

    const acc = diffMin(ms, getStatusTime(item, "accepted"));
    if (acc !== null) row.acceptSamples.push(acc);
  });

  return Object.values(map)
    .map((r) => ({
      ...r,
      avgAcceptMinutes: avgMin(r.acceptSamples),
      avgHandlingMinutes: avgMin(r.handlingSamples),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/** แถวรวมของตารางรายวัน (เฉลี่ยแบบรวมตัวอย่างทั้งหมด ไม่ใช่เฉลี่ยของค่าเฉลี่ย) */
export function sumDaily(dailyStats) {
  const t = emptyDay("total", "รวมทั้งหมด");
  dailyStats.forEach((d) => {
    t.total += d.total;
    t.completed += d.completed;
    t.cancelled += d.cancelled;
    t.active += d.active;
    Object.keys(d.severity).forEach((k) => (t.severity[k] += d.severity[k]));
    Object.entries(d.types).forEach(([k, v]) => (t.types[k] = (t.types[k] || 0) + v));
    t.acceptSamples.push(...d.acceptSamples);
    t.handlingSamples.push(...d.handlingSamples);
  });
  t.avgAcceptMinutes = avgMin(t.acceptSamples);
  t.avgHandlingMinutes = avgMin(t.handlingSamples);
  return t;
}

/** ตารางไขว้ ประเภท × ความรุนแรง */
export function buildCrossTab(incidents) {
  const table = {};
  Object.keys(INCIDENT_TYPES).forEach((t) => (table[t] = emptySeverity()));
  incidents.forEach((i) => {
    table[normType(i.type)][normSeverity(i.severity)] += 1;
  });
  return table;
}