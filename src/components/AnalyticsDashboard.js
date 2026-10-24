import React, { useMemo, useState } from "react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { toMillis } from "../hooks/useIncidents";

const KPS_CENTER = { lat: 14.028746607870978, lng: 99.97823358223988 };

const MAP_OPTIONS = {
  mapTypeId: "hybrid",
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

/**
 * ป้ายกำกับสำหรับประเภทเหตุฉุกเฉินต่างๆ อิงจากฝั่ง Mobile (src/constants/incident.js)
 */
const TYPE_LABELS = {
  sos: "🚨 แจ้งเหตุด่วน (SOS)",
  car_accident: "🚗 อุบัติเหตุรถ",
  cardiac: "❤️ หัวใจ/หมดสติ",
  injury: "🩹 บาดเจ็บ",
  fire: "🔥 ไฟไหม้",
  drowning: "🌊 จมน้ำ",
  other: "⚠️ เหตุอื่น ๆ",
};

const TYPE_MAP_CONFIG = {
  car_accident: { label: "🚗 อุบัติเหตุรถ", shortLabel: "อุบัติเหตุรถ", color: "#3B82F6" },
  cardiac: { label: "❤️ หัวใจ/หมดสติ", shortLabel: "หัวใจ/หมดสติ", color: "#EC4899" },
  injury: { label: "🩹 บาดเจ็บ", shortLabel: "บาดเจ็บ", color: "#F59E0B" },
  fire: { label: "🔥 ไฟไหม้", shortLabel: "ไฟไหม้", color: "#EF4444" },
  drowning: { label: "🌊 จมน้ำ", shortLabel: "จมน้ำ", color: "#06B6D4" },
  sos: { label: "🚨 แจ้งเหตุด่วน (SOS)", shortLabel: "SOS", color: "#DC2626" },
  other: { label: "⚠️ เหตุอื่น ๆ", shortLabel: "เหตุอื่น ๆ", color: "#64748B" },
};

const SEVERITY_MAP_CONFIG = {
  critical: { label: "วิกฤต", color: "#EF4444" },
  high: { label: "รุนแรง", color: "#F97316" },
  medium: { label: "ปานกลาง", color: "#F59E0B" },
  low: { label: "ไม่รุนแรง", color: "#22C55E" },
};

const STATUS_LABELS = {
  pending: "รอเจ้าหน้าที่รับเรื่อง",
  accepted: "เจ้าหน้าที่รับเรื่องแล้ว",
  on_the_way: "กำลังเดินทางไปหาคุณ",
  arrived: "ถึงจุดเกิดเหตุแล้ว",
  completed: "ช่วยเหลือเสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

const DATE_PRESETS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "today", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "custom", label: "กำหนดช่วงวันที่เอง" },
];

function getCoordinates(location) {
  const lat = Number(location?.latitude ?? location?.lat);
  const lng = Number(location?.longitude ?? location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  return { lat, lng };
}

function normalizeIncidentType(rawType) {
  if (!rawType) return "other";
  if (rawType === "vehicle_accident") return "car_accident";
  return TYPE_MAP_CONFIG[rawType] ? rawType : "other";
}

function createMapMarkerIcon(color = "#EF4444") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2" />
      <circle cx="16" cy="16" r="6.5" fill="white" />
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(30, 38),
    anchor: new window.google.maps.Point(15, 38),
  };
}

// ตรวจสอบว่าเวลาอยู่ในช่วงวันที่ที่เลือกหรือไม่
function isWithinDateRange(createdAtMs, datePreset, customStart, customEnd) {
  if (datePreset === "all") return true;
  if (!createdAtMs) return false;

  const now = new Date();

  if (datePreset === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
    return createdAtMs >= startOfToday && createdAtMs <= endOfToday;
  }

  if (datePreset === "week") {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diffToMonday
    ).getTime();
    const endOfToday =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() +
      24 * 60 * 60 * 1000 -
      1;
    return createdAtMs >= startOfWeek && createdAtMs <= endOfToday;
  }

  if (datePreset === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    ).getTime();
    return createdAtMs >= startOfMonth && createdAtMs <= endOfMonth;
  }

  if (datePreset === "custom") {
    let minMs = -Infinity;
    let maxMs = Infinity;
    if (customStart) {
      const [y, m, d] = customStart.split("-").map(Number);
      minMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    }
    if (customEnd) {
      const [y, m, d] = customEnd.split("-").map(Number);
      maxMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    }
    return createdAtMs >= minMs && createdAtMs <= maxMs;
  }

  return true;
}

/**
 * ฟังก์ชันนับจำนวนเหตุการณ์แยกตามประเภท
 */
function countByType(incidents) {
  const result = {};
  incidents.forEach((item) => {
    const rawType = item.type || "other";
    const type = rawType === "vehicle_accident" ? "car_accident" : rawType;
    result[type] = (result[type] || 0) + 1;
  });
  return Object.entries(result)
    .map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * ฟังก์ชันนับจำนวนเหตุการณ์แยกตามสถานะ
 */
function countByStatus(incidents) {
  const result = {};
  incidents.forEach((item) => {
    const status = item.status || "unknown";
    result[status] = (result[status] || 0) + 1;
  });
  return result;
}

/**
 * ฟังก์ชันนับจำนวนเหตุการณ์แยกตามระดับความรุนแรง
 */
function countBySeverity(incidents) {
  const result = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  incidents.forEach((item) => {
    const sev = item.severity;
    if (sev && result[sev] !== undefined) {
      result[sev] += 1;
    } else {
      result.unknown += 1;
    }
  });
  return result;
}

/**
 * ฟังก์ชันจัดกลุ่มสถิติแยกตามวันที่ (YYYY-MM-DD)
 */
function computeDailyStats(incidents) {
  const map = {};

  incidents.forEach((item) => {
    const ms = toMillis(item.createdAt);
    if (!ms) return;
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;

    if (!map[dateKey]) {
      map[dateKey] = {
        dateKey,
        dateDisplay: d.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        completed: 0,
        cancelled: 0,
        active: 0,
        totalResponseMs: 0,
        responseCount: 0,
      };
    }

    const row = map[dateKey];
    row.total += 1;

    if (item.severity === "critical") row.critical += 1;
    else if (item.severity === "high") row.high += 1;
    else if (item.severity === "medium") row.medium += 1;
    else if (item.severity === "low") row.low += 1;

    if (item.status === "completed") {
      row.completed += 1;
      const compMs = toMillis(item.completedAt);
      if (compMs && compMs >= ms) {
        row.totalResponseMs += compMs - ms;
        row.responseCount += 1;
      }
    } else if (item.status === "cancelled") {
      row.cancelled += 1;
    } else {
      row.active += 1;
    }
  });

  return Object.values(map)
    .map((row) => ({
      ...row,
      avgResponseMinutes:
        row.responseCount > 0
          ? Math.round(row.totalResponseMs / row.responseCount / 60000)
          : 0,
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * ส่งออกรายงานสรุปเชิงสถิติและการวิเคราะห์ภาพรวม (Executive Analytics Summary)
 * ออกแบบเฉพาะสำหรับหน้าสถิติ โดยไม่ซ้ำซ้อนกับรายงานประวัติรายเคสของ HistoryPage
 */
function exportAnalyticsReportToCsv({
  summary,
  severityStats,
  typeStats,
  dailyStats,
  datePresetLabel,
  typeFilterLabel,
  severityFilterLabel,
  totalCases,
  datePreset = "all",
  customStartDate = "",
  customEndDate = "",
  typeFilter = "all",
  severityFilter = "all",
}) {
  const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const now = new Date();
  const generatedTimeStr = now.toLocaleString("th-TH");
  const todayIso = now.toISOString().slice(0, 10);

  const total = summary?.total || 0;
  const calcPct = (cnt) =>
    total > 0 ? `${((cnt / total) * 100).toFixed(1)}%` : "0.0%";

  const lines = [];

  // --- ส่วนหัว: เมตาดาต้าของรายงานและเงื่อนไขการกรอง ---
  lines.push([
    escapeCsv(
      "รายงานสรุปเชิงสถิติและการวิเคราะห์การปฏิบัติการฉุกเฉิน (KPS Analytics Summary Report)"
    ),
  ]);
  lines.push([escapeCsv("วันที่ออกรายงาน"), escapeCsv(generatedTimeStr)]);
  lines.push([escapeCsv("ช่วงเวลาที่เลือก"), escapeCsv(datePresetLabel)]);
  lines.push([escapeCsv("เงื่อนไขประเภทเหตุ"), escapeCsv(typeFilterLabel)]);
  lines.push([
    escapeCsv("เงื่อนไขระดับความรุนแรง"),
    escapeCsv(severityFilterLabel),
  ]);
  lines.push([
    escapeCsv("จำนวนเคสทั้งหมดที่นำมาวิเคราะห์"),
    escapeCsv(`${totalCases} เคส`),
  ]);
  lines.push([]); // บรรทัดว่างคั่นส่วน

  // --- ส่วนที่ 1: ภาพรวมตัวชี้วัดประสิทธิภาพ (Key Performance Indicators) ---
  lines.push([
    escapeCsv("[ 1. สรุปตัวชี้วัดภาพรวมการปฏิบัติการ (Overview KPIs) ]"),
  ]);
  lines.push(["ตัวชี้วัด", "จำนวน (เคส)", "สัดส่วน (%)"].map(escapeCsv));
  lines.push(
    ["จำนวนเคสทั้งหมดในช่วงเวลา", total, "100.0%"].map(escapeCsv)
  );
  lines.push(
    [
      "ช่วยเหลือเสร็จสิ้น (Completed)",
      summary?.completed || 0,
      calcPct(summary?.completed || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "กำลังดำเนินการ (Active)",
      summary?.active || 0,
      calcPct(summary?.active || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "ยกเลิกการแจ้งเหตุ (Cancelled)",
      summary?.cancelled || 0,
      calcPct(summary?.cancelled || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "เวลาตอบสนองเฉลี่ย (นาที)",
      `${summary?.avgResponseTime ?? 0} นาที`,
      "-",
    ].map(escapeCsv)
  );
  lines.push([]); // บรรทัดว่างคั่นส่วน

  // --- ส่วนที่ 2: สถิติแยกตามระดับความรุนแรง (Severity Breakdown) ---
  lines.push([
    escapeCsv("[ 2. สถิติแยกตามระดับความรุนแรง (Severity Breakdown) ]"),
  ]);
  lines.push(["ระดับความรุนแรง", "จำนวน (เคส)", "สัดส่วน (%)"].map(escapeCsv));
  lines.push(
    [
      "วิกฤต (Critical - สีแดง)",
      severityStats?.critical || 0,
      calcPct(severityStats?.critical || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "รุนแรง (High - สีส้ม)",
      severityStats?.high || 0,
      calcPct(severityStats?.high || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "ปานกลาง (Medium - สีเหลือง)",
      severityStats?.medium || 0,
      calcPct(severityStats?.medium || 0),
    ].map(escapeCsv)
  );
  lines.push(
    [
      "ไม่รุนแรง (Low - สีเขียว)",
      severityStats?.low || 0,
      calcPct(severityStats?.low || 0),
    ].map(escapeCsv)
  );
  if (severityStats?.unknown) {
    lines.push(
      [
        "ไม่ระบุระดับความรุนแรง",
        severityStats.unknown,
        calcPct(severityStats.unknown),
      ].map(escapeCsv)
    );
  }
  lines.push([]); // บรรทัดว่างคั่นส่วน

  // --- ส่วนที่ 3: สถิติแยกตามประเภทเหตุฉุกเฉิน (Incident Type Breakdown) ---
  lines.push([
    escapeCsv("[ 3. สถิติแยกตามประเภทเหตุฉุกเฉิน (Incident Type Breakdown) ]"),
  ]);
  lines.push(["ประเภทเหตุฉุกเฉิน", "จำนวน (เคส)", "สัดส่วน (%)"].map(escapeCsv));
  if (!typeStats || typeStats.length === 0) {
    lines.push(["ไม่พบข้อมูลประเภทเหตุ", 0, "0.0%"].map(escapeCsv));
  } else {
    typeStats.forEach((t) => {
      lines.push([t.label, t.count, calcPct(t.count)].map(escapeCsv));
    });
  }
  lines.push([]); // บรรทัดว่างคั่นส่วน

  // --- ส่วนที่ 4: สถิติและแนวโน้มการออกเหตุรายวัน (Daily Breakdown) ---
  lines.push([
    escapeCsv(
      "[ 4. สถิติการออกเหตุและแนวโน้มแยกตามวันที่ (Daily Breakdown) ]"
    ),
  ]);
  lines.push(
    [
      "วันที่ (พ.ศ.)",
      "วันที่ (ค.ศ.)",
      "จำนวนเคสทั้งหมด",
      "วิกฤต",
      "รุนแรง",
      "ปานกลาง",
      "ไม่รุนแรง",
      "ช่วยเหลือเสร็จสิ้น",
      "กำลังดำเนินการ",
      "ยกเลิก",
      "เวลาเฉลี่ย (นาที)",
    ].map(escapeCsv)
  );

  if (!dailyStats || dailyStats.length === 0) {
    lines.push(
      ["ไม่พบข้อมูลรายวันในช่วงเวลาที่เลือก", "-", 0, 0, 0, 0, 0, 0, 0, 0, 0].map(
        escapeCsv
      )
    );
  } else {
    dailyStats.forEach((r) => {
      lines.push(
        [
          r.dateDisplay,
          r.dateKey,
          r.total,
          r.critical,
          r.high,
          r.medium,
          r.low,
          r.completed,
          r.active,
          r.cancelled,
          r.avgResponseMinutes,
        ].map(escapeCsv)
      );
    });
  }

  const csvContent = "\uFEFF" + lines.map((row) => row.join(",")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const rangeSuffix =
    datePreset === "custom" && (customStartDate || customEndDate)
      ? `${customStartDate || "start"}_to_${customEndDate || "end"}`
      : datePreset;
  const typeSuffix = typeFilter !== "all" ? `_${typeFilter}` : "";
  const sevSuffix = severityFilter !== "all" ? `_${severityFilter}` : "";
  const filename = `KPS_Analytics_Summary_${rangeSuffix}${typeSuffix}${sevSuffix}_${todayIso}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}



// --- Sub-components สำหรับ UI ---

const StatCard = ({ title, value, sub }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
      {title}
    </p>
    <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
    {sub && <p className="text-xs font-medium text-slate-400 mt-1">{sub}</p>}
  </div>
);

const StatusBox = ({ label, value, color }) => (
  <div
    className={`rounded-xl p-3 border border-slate-100 ${color} transition-transform hover:scale-[1.02]`}
  >
    <p className="text-[11px] font-bold opacity-80">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

const TypeProgressBar = ({ label, count, percentage }) => (
  <div>
    <div className="flex justify-between text-sm font-bold mb-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-800">{count} เคส</span>
    </div>
    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full bg-red-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

// แผนที่แสดงจุดเกิดเหตุสำหรับหน้าสถิติ
function AnalyticsIncidentMap({
  incidents,
  typeFilter = "all",
  severityFilter = "all",
  onTypeFilterChange,
  onSeverityFilterChange,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [colorMode, setColorMode] = useState("type"); // "type" | "severity"

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  const validIncidents = useMemo(
    () => incidents.filter((item) => getCoordinates(item.location)),
    [incidents]
  );

  const selectedIncident = useMemo(
    () => validIncidents.find((item) => item.id === selectedId) || null,
    [validIncidents, selectedId]
  );

  const mapCenter = useMemo(() => {
    if (validIncidents.length > 0) {
      return getCoordinates(validIncidents[0].location) || KPS_CENTER;
    }
    return KPS_CENTER;
  }, [validIncidents]);

  const getMarkerColor = (item) => {
    if (colorMode === "type") {
      const normType = normalizeIncidentType(item.type);
      return TYPE_MAP_CONFIG[normType]?.color || "#64748B";
    }
    return SEVERITY_MAP_CONFIG[item.severity]?.color || "#EF4444";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full min-h-[540px]">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              🗺️ แผนที่แสดงสถิติจุดเกิดเหตุ
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              แสดงตำแหน่งการเกิดเหตุตามเงื่อนไขที่กรอง ({validIncidents.length} จุดที่มีพิกัด)
            </p>
          </div>

          {/* ปุ่มสลับโหมดสีหมุด: ประเภทเหตุฉุกเฉิน vs ระดับความรุนแรง */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setColorMode("type")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                colorMode === "type"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🏷️ สีตามประเภทเหตุ
            </button>
            <button
              type="button"
              onClick={() => setColorMode("severity")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                colorMode === "severity"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🚨 สีตามความรุนแรง
            </button>
          </div>
        </div>

        {/* คำอธิบายสีหมุด (Legend) เปลี่ยนตามโหมดที่เลือก */}
        {colorMode === "type" ? (
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            {Object.entries(TYPE_MAP_CONFIG).map(([key, cfg]) => {
              const active = typeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    onTypeFilterChange?.(typeFilter === key ? "all" : key)
                  }
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
                    active
                      ? "bg-slate-800 text-white"
                      : "hover:bg-slate-200/70 text-slate-600"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{cfg.shortLabel}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            {Object.entries(SEVERITY_MAP_CONFIG).map(([key, cfg]) => {
              const active = severityFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    onSeverityFilterChange?.(
                      severityFilter === key ? "all" : key
                    )
                  }
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
                    active
                      ? "bg-slate-800 text-white"
                      : "hover:bg-slate-200/70 text-slate-600"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[450px]">
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-medium">
            กำลังโหลดแผนที่สถิติจุดเกิดเหตุ...
          </div>
        ) : (
          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={mapCenter}
            zoom={15}
            options={MAP_OPTIONS}
          >
            {validIncidents.map((item) => {
              const pos = getCoordinates(item.location);
              if (!pos) return null;
              return (
                <Marker
                  key={item.id}
                  position={pos}
                  icon={createMapMarkerIcon(getMarkerColor(item))}
                  onClick={() => setSelectedId(item.id)}
                />
              );
            })}

            {selectedIncident && (
              <InfoWindow
                position={getCoordinates(selectedIncident.location)}
                onCloseClick={() => setSelectedId(null)}
              >
                <div className="p-1 min-w-[200px] font-sans">
                  <p className="font-bold text-slate-800 text-sm mb-1">
                    {TYPE_LABELS[selectedIncident.type] ||
                      selectedIncident.type ||
                      "เหตุฉุกเฉิน"}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    {selectedIncident.severity && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                        ความรุนแรง:{" "}
                        {SEVERITY_MAP_CONFIG[selectedIncident.severity]?.label ||
                          selectedIncident.severity}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {STATUS_LABELS[selectedIncident.status] ||
                        selectedIncident.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs font-medium leading-snug">
                    📍{" "}
                    {selectedIncident.address ||
                      selectedIncident.location?.address ||
                      "ไม่ทราบตำแหน่ง"}
                  </p>
                  {selectedIncident.createdAt && (
                    <p className="text-slate-400 text-[11px] mt-1">
                      🕒{" "}
                      {new Date(
                        toMillis(selectedIncident.createdAt)
                      ).toLocaleString("th-TH")}
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function AnalyticsDashboard({ incidents = [] }) {
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // กรองเหตุการณ์ตาม ช่วงเวลา + ประเภทเหตุฉุกเฉิน + ระดับความรุนแรง ที่เลือก
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      const matchDate = isWithinDateRange(
        toMillis(item.createdAt),
        datePreset,
        customStartDate,
        customEndDate
      );
      if (!matchDate) return false;

      if (typeFilter !== "all") {
        const normType = normalizeIncidentType(item.type);
        if (normType !== typeFilter) return false;
      }

      if (severityFilter !== "all" && item.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [
    incidents,
    datePreset,
    customStartDate,
    customEndDate,
    typeFilter,
    severityFilter,
  ]);

  // คำนวณสถิติภาพรวมตามช่วงวันที่ที่เลือก
  const filteredSummary = useMemo(() => {
    const completedCases = filteredIncidents.filter(
      (i) => i.status === "completed"
    );
    const activeCases = filteredIncidents.filter(
      (i) =>
        !i.archived && i.status !== "completed" && i.status !== "cancelled"
    );
    const cancelledCases = filteredIncidents.filter(
      (i) => i.status === "cancelled"
    );
    const completedWithTime = completedCases.filter((i) => {
      const start = toMillis(i.createdAt);
      const end = toMillis(i.completedAt);
      return start && end && end >= start;
    });

    const avgResponseTime =
      completedWithTime.length > 0
        ? Math.round(
            completedWithTime.reduce(
              (sum, i) => sum + (toMillis(i.completedAt) - toMillis(i.createdAt)),
              0
            ) /
              completedWithTime.length /
              60000
          )
        : 0;

    return {
      total: filteredIncidents.length,
      completed: completedCases.length,
      active: activeCases.length,
      cancelled: cancelledCases.length,
      avgResponseTime,
    };
  }, [filteredIncidents]);

  const typeStats = useMemo(
    () => countByType(filteredIncidents),
    [filteredIncidents]
  );
  const statusStats = useMemo(
    () => countByStatus(filteredIncidents),
    [filteredIncidents]
  );
  const severityStats = useMemo(
    () => countBySeverity(filteredIncidents),
    [filteredIncidents]
  );
  const dailyStats = useMemo(
    () => computeDailyStats(filteredIncidents),
    [filteredIncidents]
  );

  const handleExportAnalyticsReport = () => {
    let datePresetLabel = "ทั้งหมด";
    if (datePreset === "custom") {
      datePresetLabel = `${customStartDate || "เริ่มต้น"} ถึง ${customEndDate || "ปัจจุบัน"}`;
    } else {
      datePresetLabel =
        DATE_PRESETS.find((p) => p.value === datePreset)?.label || "ทั้งหมด";
    }

    const typeFilterLabel =
      typeFilter === "all"
        ? "ทุกประเภทเหตุ"
        : TYPE_MAP_CONFIG[typeFilter]?.label || typeFilter;

    const severityFilterLabel =
      severityFilter === "all"
        ? "ทุกระดับความรุนแรง"
        : SEVERITY_MAP_CONFIG[severityFilter]?.label || severityFilter;

    exportAnalyticsReportToCsv({
      summary: filteredSummary,
      severityStats,
      typeStats,
      dailyStats,
      datePresetLabel,
      typeFilterLabel,
      severityFilterLabel,
      totalCases: filteredIncidents.length,
      datePreset,
      customStartDate,
      customEndDate,
      typeFilter,
      severityFilter,
    });
  };

  const maxTypeCount = useMemo(
    () =>
      typeStats.length > 0
        ? Math.max(...typeStats.map((item) => item.count))
        : 1,
    [typeStats]
  );

  const maxDailyCount = useMemo(
    () =>
      dailyStats.length > 0
        ? Math.max(...dailyStats.map((item) => item.total))
        : 1,
    [dailyStats]
  );

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar bg-slate-50 space-y-6">
      {/* แถบตัวกรองสถิติ: ช่วงเวลา + ประเภทเหตุฉุกเฉิน + ระดับความรุนแรง + ส่งออกรายงานสรุปสถิติ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              📊 ตัวกรองสถิติและการวิเคราะห์
            </h2>
            <p className="text-xs font-medium text-slate-500">
              วิเคราะห์ภาพรวมตามช่วงเวลา ประเภทเหตุ และระดับความรุนแรง พร้อมส่งออกรายงานสรุปเชิงสถิติ
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportAnalyticsReport}
            disabled={filteredIncidents.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm self-start lg:self-auto"
            title="ส่งออกรายงานสรุปสถิติ (Overview KPIs, ความรุนแรง, ประเภทเหตุ, และสรุปรายวัน)"
          >
            <span>📊</span> ส่งออกรายงานสรุปสถิติ (Analytics CSV)
          </button>
        </div>

        {/* แถวตัวกรองระดับเดียวกัน: ช่วงเวลา + ประเภทเหตุฉุกเฉิน + ระดับความรุนแรง */}
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* ส่วนเลือกช่วงเวลา */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 whitespace-nowrap">
              📅 ช่วงเวลา:
            </span>
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDatePreset(preset.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-red-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}

            {datePreset === "custom" && (
              <div className="flex items-center gap-2 flex-wrap ml-1">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700"
                />
                <span className="text-xs font-bold text-slate-400">ถึง</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700"
                />
              </div>
            )}
          </div>

          {/* ส่วน Dropdown ประเภทเหตุฉุกเฉิน + ระดับความรุนแรง (ระดับเดียวกับช่วงเวลา) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[210px]">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                🚨 ประเภทเหตุ:
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">ทุกประเภทเหตุ</option>
                {Object.entries(TYPE_MAP_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[190px]">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                ⚠️ ความรุนแรง:
              </span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="flex-1 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">ทุกระดับความรุนแรง</option>
                <option value="critical">🔴 วิกฤต (Critical)</option>
                <option value="high">🟠 รุนแรง (High)</option>
                <option value="medium">🟡 ปานกลาง (Medium)</option>
                <option value="low">🟢 ไม่รุนแรง (Low)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4 กล่องสถิติหลักด้านบน */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="เคสในช่วงเวลาที่เลือก"
          value={filteredSummary.total}
          sub={`จากทั้งหมด ${incidents.length} เคสในระบบ`}
        />
        <StatCard
          title="ช่วยเหลือเสร็จสิ้น"
          value={filteredSummary.completed}
          sub="เคสที่ปิดงานสำเร็จ"
        />
        <StatCard
          title="กำลังดำเนินการ"
          value={filteredSummary.active}
          sub="เคสที่ยังไม่เสร็จสิ้น"
        />
        <StatCard
          title="เวลาตอบสนองเฉลี่ย"
          value={`${filteredSummary.avgResponseTime} นาที`}
          sub="ตั้งแต่แจ้งเหตุจนเสร็จสิ้น"
        />
      </div>

      {/* แบ่ง 2 คอลัมน์: ซ้าย = ประเภทเหตุ + ความรุนแรง + สถานะ / ขวา = แผนที่แสดงสถิติการเกิดเหตุ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* คอลัมน์ซ้าย: สถิติตามประเภทเหตุฉุกเฉิน -> สถิติตามระดับความรุนแรง -> สถิติตามสถานะการดำเนินงาน */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              📊 สถิติตามประเภทเหตุฉุกเฉิน
            </h2>
            {typeStats.length === 0 ? (
              <p className="text-slate-400 text-center py-8 font-medium">
                ไม่มีข้อมูลเหตุฉุกเฉินในช่วงเวลาที่เลือก
              </p>
            ) : (
              <div className="space-y-5">
                {typeStats.map((item) => (
                  <TypeProgressBar
                    key={item.type}
                    label={item.label}
                    count={item.count}
                    percentage={(item.count / maxTypeCount) * 100}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              🚨 สถิติตามระดับความรุนแรง
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatusBox
                label="🔴 วิกฤต (Critical)"
                value={severityStats.critical}
                color="bg-red-50 text-red-700"
              />
              <StatusBox
                label="🟠 รุนแรง (High)"
                value={severityStats.high}
                color="bg-orange-50 text-orange-700"
              />
              <StatusBox
                label="🟡 ปานกลาง (Medium)"
                value={severityStats.medium}
                color="bg-amber-50 text-amber-700"
              />
              <StatusBox
                label="🟢 ไม่รุนแรง (Low)"
                value={severityStats.low}
                color="bg-emerald-50 text-emerald-700"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              📈 สถิติตามสถานะการดำเนินงาน
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatusBox
                label="รอเจ้าหน้าที่รับเรื่อง"
                value={statusStats.pending || 0}
                color="bg-red-50 text-red-600"
              />
              <StatusBox
                label="เจ้าหน้าที่รับเรื่องแล้ว"
                value={statusStats.accepted || 0}
                color="bg-amber-50 text-amber-600"
              />
              <StatusBox
                label="กำลังเดินทาง"
                value={statusStats.on_the_way || 0}
                color="bg-blue-50 text-blue-600"
              />
              <StatusBox
                label="ถึงจุดเกิดเหตุแล้ว"
                value={statusStats.arrived || 0}
                color="bg-purple-50 text-purple-600"
              />
              <StatusBox
                label="ช่วยเหลือเสร็จสิ้น"
                value={statusStats.completed || 0}
                color="bg-emerald-50 text-emerald-600"
              />
              <StatusBox
                label="ยกเลิกแล้ว"
                value={statusStats.cancelled || 0}
                color="bg-zinc-100 text-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* คอลัมน์ขวา: แผนที่แสดงสถิติการเกิดเหตุ */}
        <AnalyticsIncidentMap
          incidents={filteredIncidents}
          typeFilter={typeFilter}
          severityFilter={severityFilter}
          onTypeFilterChange={setTypeFilter}
          onSeverityFilterChange={setSeverityFilter}
        />
      </div>

      {/* ตารางและกราฟการเก็บสถิติตามวันที่ (Daily Statistics Breakdown) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            🗓️ สถิติการออกเหตุแยกตามวันที่ (Daily Statistics)
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-1">
            สรุปจำนวนเคส ความรุนแรง สถานะ และเวลาตอบสนองเฉลี่ยแยกตามรายวัน ({dailyStats.length} วันที่มีการแจ้งเหตุ)
          </p>
        </div>

        {dailyStats.length === 0 ? (
          <p className="text-slate-400 text-center py-10 font-medium">
            ไม่พบข้อมูลสถิติรายวันในช่วงเวลาที่เลือก
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">วันที่</th>
                  <th className="py-3 px-4 font-bold">จำนวนเคสรวม</th>
                  <th className="py-3 px-4 font-bold text-center">🔴 วิกฤต</th>
                  <th className="py-3 px-4 font-bold text-center">🟠 รุนแรง</th>
                  <th className="py-3 px-4 font-bold text-center">🟡 ปานกลาง</th>
                  <th className="py-3 px-4 font-bold text-center">🟢 ไม่รุนแรง</th>
                  <th className="py-3 px-4 font-bold text-center">เสร็จสิ้น</th>
                  <th className="py-3 px-4 font-bold text-center">ยกเลิก</th>
                  <th className="py-3 px-4 font-bold text-right">เวลาเฉลี่ย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dailyStats.map((day) => {
                  const pct = Math.round((day.total / maxDailyCount) * 100);
                  return (
                    <tr
                      key={day.dateKey}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                        <div>{day.dateDisplay}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {day.dateKey}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 w-8">
                            {day.total}
                          </span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block min-w-[28px] py-0.5 px-2 rounded-md text-xs font-bold bg-red-50 text-red-700">
                          {day.critical}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block min-w-[28px] py-0.5 px-2 rounded-md text-xs font-bold bg-orange-50 text-orange-700">
                          {day.high}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block min-w-[28px] py-0.5 px-2 rounded-md text-xs font-bold bg-amber-50 text-amber-700">
                          {day.medium}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block min-w-[28px] py-0.5 px-2 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700">
                          {day.low}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {day.completed}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-500">
                        {day.cancelled}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-700 whitespace-nowrap">
                        {day.avgResponseMinutes > 0
                          ? `${day.avgResponseMinutes} นาที`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
