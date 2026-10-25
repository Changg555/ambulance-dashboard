import React, { useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { toMillis } from "../hooks/useIncidents";
import ReporterDetailModal from "./ReporterDetailModal";
import { INCIDENT_TYPES, SEVERITIES, STATUS_LABELS, SORT_OPTIONS, toOptions } from "../constants/incident";
import { sortIncidents } from "../utils/sortIncidents";
import { csvCell, rowsToCsv, downloadCsv, isoDate, isoTime, maskPhone } from "../utils/csv";
import { diffMin, round1 } from "../utils/analyticsStats";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "completed", label: STATUS_LABELS.completed },
  { value: "cancelled", label: STATUS_LABELS.cancelled },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: "all", label: "ทุกระดับความรุนแรง" },
  ...toOptions(SEVERITIES),
];

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "ทุกประเภทเหตุฉุกเฉิน" },
  ...toOptions(INCIDENT_TYPES),
];

const DATE_PRESETS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "today", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "custom", label: "กำหนดช่วงวันที่เอง" },
];

// class กลางของ input/select เพื่อไม่ต้องเขียนซ้ำหลายจุด
const CONTROL_CLASS =
  "bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all";

// แสดงวันที่/เวลาในรูปแบบไทย และกันค่าว่างไม่ให้ UI พัง
function formatDate(time) {
  const ms = toMillis(time);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("th-TH");
}

function getDurationMinutes(start, end) {
  const startMs = toMillis(start);
  const endMs = toMillis(end);
  if (!startMs || !endMs || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

// คำนวณเวลาที่ใช้ตั้งแต่เปิดเคสจนถึงปิดหรือยกเลิกเคส
function getDuration(start, end) {
  const minutes = getDurationMinutes(start, end);
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} นาที`;

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours} ชม. ${remainMinutes} นาที`;
}

// รวมรูปจากฝั่ง Mobile ({ url, publicId }) และ schema เดิมให้เป็น array ของ URL
function getIncidentImages(item) {
  const raw = item.images || (item.image ? [item.image] : []);
  return raw
    .map((img) => (typeof img === "string" ? img : img?.url))
    .filter(Boolean);
}

// เช็คว่าข้อมูลตำแหน่งมีพิกัดครบพอสำหรับแสดงแผนที่หรือไม่
function getCoords(location) {
  const lat = Number(location?.latitude ?? location?.lat);
  const lng = Number(location?.longitude ?? location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  return { lat, lng };
}

// เตรียมข้อความรวมสำหรับ search ในจุดเดียว
function getSearchText(item) {
  return [
    item.caseNumber,
    item.id,
    item.type,
    INCIDENT_TYPES[item.type]?.label,
    SEVERITIES[item.severity]?.label,
    item.description,
    item.address,
    item.location?.address,
    item.reporter?.name,
    item.reporter?.phone,
    item.assignedTo?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ตรวจสอบว่าเวลาของเคสอยู่ในช่วงเวลาที่เลือกหรือไม่
function isWithinDateRange(createdAtMs, datePreset, customStart, customEnd) {
  if (datePreset === "all") return true;
  if (!createdAtMs) return false;

  const now = new Date();

  if (datePreset === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
    return createdAtMs >= startOfToday && createdAtMs <= endOfToday;
  }

  if (datePreset === "week") {
    const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
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

// ฟังก์ชันแปลงข้อมูลเคสเป็น CSV (รองรับภาษาไทยใน Excel ด้วย UTF-8 BOM)
function exportIncidentsToCsv(
  incidents,
  datePreset,
  customStart,
  customEnd,
  typeFilter = "all",
  severityFilter = "all",
  role = "staff"
) {
  const headers = [
    "ลำดับ",
    "เลขเหตุการณ์",
    "วันที่แจ้งเหตุ",
    "เวลาที่แจ้งเหตุ",
    "ประเภทเหตุ",
    "ระดับความรุนแรง",
    "รายละเอียดเหตุ",
    "สถานะ",
    "ชื่อผู้แจ้ง",
    "เบอร์โทรผู้แจ้ง",
    "เจ้าหน้าที่ผู้รับผิดชอบ",
    "สถานที่",
    "พิกัด (Latitude, Longitude)",
    "พื้นที่ให้บริการ",
    "เวลาที่ใช้ดำเนินการ (นาที)",
  ];

  const rows = incidents.map((item, idx) => {
    const createdMs = toMillis(item.createdAt);
    const completedMs = toMillis(item.completedAt);
    const coords = getCoords(item.location);
    const phone = item.reporter?.phone || "";

    const area =
      item.isInsideServiceArea === true ? "ในพื้นที่"
        : item.isInsideServiceArea === false ? "นอกพื้นที่"
          : "ไม่ทราบ";

    return [
      csvCell(idx + 1),
      csvCell(item.caseNumber || `KPS-${(item.id || "").slice(0, 8).toUpperCase()}`),
      csvCell(isoDate(createdMs)),
      csvCell(isoTime(createdMs)),
      csvCell(INCIDENT_TYPES[item.type]?.label || item.type || "ไม่ระบุประเภท"),
      csvCell(SEVERITIES[item.severity]?.label || "ไม่ระบุ"),
      csvCell(item.description || ""),
      csvCell(STATUS_LABELS[item.status] || item.status || ""),
      csvCell(item.reporter?.name || ""),
      // Admin เห็นเบอร์เต็ม, Staff เห็นแบบ mask ; asText คงเลข 0 นำหน้า
      csvCell(role === "admin" ? phone : maskPhone(phone), { asText: true }),
      csvCell(item.assignedTo?.name || ""),
      csvCell(item.address || item.location?.address || "ไม่ทราบตำแหน่ง"),
      csvCell(coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : ""),
      csvCell(area),
      // เฉพาะเคสเสร็จสิ้น (นิยามเดียวกับหน้าสถิติ) ; เคสยกเลิกเว้นว่าง
      csvCell(item.status === "completed" ? round1(diffMin(createdMs, completedMs)) : null),
    ];
  });

  const rangeSuffix =
    datePreset === "custom" && (customStart || customEnd)
      ? `${customStart || "start"}_to_${customEnd || "end"}`
      : datePreset;
  const typeSuffix = typeFilter !== "all" ? `_${typeFilter}` : "";
  const sevSuffix = severityFilter !== "all" ? `_${severityFilter}` : "";

  downloadCsv(
    `KPS_Emergency_Report_${rangeSuffix}${typeSuffix}${sevSuffix}_${isoDate(Date.now())}.csv`,
    rowsToCsv([headers.map((h) => csvCell(h)), ...rows])
  );
}

// ป้ายสถานะขนาดเล็กที่ใช้ซ้ำทั้ง archived/status
function StatusBadge({ children, tone = "slate" }) {
  const toneClass = {
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${toneClass}`}>
      {children}
    </span>
  );
}

// แสดงรายการรูปแนบของเคส และเปิด preview เมื่อกดรูป
function HistoryImages({ item, onPreview }) {
  const imageList = getIncidentImages(item);
  if (imageList.length === 0) return null;

  return (
    <div className="mt-4 flex gap-2 flex-wrap">
      {imageList.map((url, index) => (
        <button
          key={`${url}-${index}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPreview(url);
          }}
          className="block transition-transform hover:scale-105"
        >
          <img
            src={url}
            alt={`incident-${index}`}
            className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm"
          />
        </button>
      ))}
    </div>
  );
}

// แสดง timeline การเปลี่ยนสถานะของเคสแต่ละรายการ
function IncidentTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <p className="text-xs font-medium text-slate-400 italic pl-1">
        ยังไม่มีการบันทึกสถานะ
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {timeline.map((log, index) => {
        const status = log.status || "pending";
        const isLast = index === timeline.length - 1;
        const timeVal = log.time ?? log.at;

        return (
          <div key={log.id || `${status}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 ${isLast ? "bg-red-500 ring-4 ring-red-50" : "bg-slate-300"
                  }`}
              />
              {!isLast && <div className="w-0.5 h-full bg-slate-200 my-1" />}
            </div>

            <div className="flex-1 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span
                className={`text-[13px] ${isLast ? "font-bold text-slate-800" : "font-semibold text-slate-500"
                  }`}
              >
                {log.note || log.label || STATUS_LABELS[status] || status}
              </span>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 whitespace-nowrap w-fit">
                {formatDate(timeVal)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// แสดงตำแหน่งและปุ่มเปิด modal แผนที่ของเคส
function IncidentLocation({ item, onPreviewMap }) {
  const address = item.address || item.location?.address || "ไม่ทราบตำแหน่ง";
  const coords = getCoords(item.location);

  return (
    <div className="mt-3 bg-slate-50 rounded-xl border border-slate-100 p-3 w-fit max-w-full">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-slate-600 flex items-start gap-1.5 leading-snug">
            <span className="text-red-500 shrink-0 mt-[2px]">📍</span>
            <span className="line-clamp-2">{address}</span>
          </p>

          {coords && (
            <p className="text-[11px] font-mono text-slate-400 mt-1 ml-5">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>

        {coords && (
          <button
            type="button"
            onClick={() => onPreviewMap({ ...coords, address })}
            className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all shadow-sm"
          >
            แผนที่
          </button>
        )}
      </div>
    </div>
  );
}

// สรุปเวลาสำคัญของเคส เช่น เวลาแจ้งเหตุ เวลาจบเคส และระยะเวลารวม
function IncidentTimeStats({ item }) {
  return (
    <div className="lg:text-right text-[13px] font-medium text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 min-w-[200px]">
      <p className="mb-1">
        แจ้งเหตุ: <span className="text-slate-800">{formatDate(item.createdAt)}</span>
      </p>
      {item.completedAt && (
        <p className="mb-1">
          เสร็จสิ้น: <span className="text-slate-800">{formatDate(item.completedAt)}</span>
        </p>
      )}
      {item.cancelledAt && (
        <p className="mb-1">
          ยกเลิก: <span className="text-slate-800">{formatDate(item.cancelledAt)}</span>
        </p>
      )}
      <div className="mt-2 pt-2 border-t border-slate-200">
        <p className="font-bold text-red-600">
          ใช้เวลา: {getDuration(item.createdAt, item.completedAt || item.cancelledAt)}
        </p>
      </div>
    </div>
  );
}

// ปุ่ม action ด้านล่างของ card
function IncidentActions({ item, role, onRestore, onDelete }) {
  const canDelete = role === "admin";

  return (
    <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100">
      {item.archived && (
        <button
          type="button"
          onClick={() => onRestore(item.id)}
          className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors"
        >
          นำกลับมาหน้าหลัก
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              "ต้องการลบประวัติเคสนี้ถาวรใช่หรือไม่? ข้อมูลจะหายจากระบบ"
            );
            if (ok) onDelete(item.id);
          }}
          className="text-xs font-bold px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
        >
          ลบประวัติถาวร
        </button>
      )}
    </div>
  );
}

// card หลักของเคสหนึ่งรายการ
function IncidentHistoryCard({
  item,
  onRestore,
  onDelete,
  onPreviewImage,
  onPreviewMap,
  role,
}) {
  const [showReporterModal, setShowReporterModal] = useState(false);
  const status = item.status || "pending";
  const isCancelled = status === "cancelled";
  const caseNumber = item.caseNumber || `KPS-${item.id?.slice(0, 8).toUpperCase()}`;
  const reporterUid = item.reporter?.uid || item.userId || null;

  const severityTone =
    item.severity === "critical"
      ? "red"
      : item.severity === "high"
        ? "orange"
        : item.severity === "medium"
          ? "amber"
          : "emerald";

  return (
    <>
      <div className="border border-slate-200 rounded-2xl p-5 bg-white hover:shadow-md transition-shadow">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-bold text-slate-800 text-lg">
                {INCIDENT_TYPES[item.type]?.label || item.type || "ไม่ระบุประเภท"}
              </h3>
              <StatusBadge tone={isCancelled ? "slate" : "emerald"}>
                {STATUS_LABELS[status] || status}
              </StatusBadge>
              {item.severity && SEVERITIES[item.severity] && (
                <StatusBadge tone={severityTone}>
                  ความรุนแรง: {SEVERITIES[item.severity].label}
                </StatusBadge>
              )}
              {item.archived && <StatusBadge tone="amber">เก็บประวัติแล้ว</StatusBadge>}
            </div>

            <p className="text-xs font-bold text-red-500 bg-red-50 inline-block px-2 py-1 rounded-md font-mono mb-2">
              {caseNumber}
            </p>

            {(item.reporter || item.assignedTo || reporterUid) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1 mb-2">
                {(item.reporter || reporterUid) && (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>
                      ผู้แจ้ง: <strong>{item.reporter?.name || "-"}</strong>{" "}
                      {item.reporter?.phone ? `(${item.reporter.phone})` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReporterModal(true)}
                      className="text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm transition flex items-center gap-1"
                    >
                      ดูข้อมูลผู้แจ้ง
                    </button>
                  </span>
                )}
                {item.assignedTo && (
                  <span>
                    เจ้าหน้าที่: <strong>{item.assignedTo.name || "-"}</strong>
                    {item.assignedTo.vehicle ? ` (${item.assignedTo.vehicle})` : ""}
                  </span>
                )}
              </div>
            )}

            {item.description && (
              <p className="text-sm font-medium text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 w-fit max-w-full">
                {item.description}
              </p>
            )}

            <IncidentLocation item={item} onPreviewMap={onPreviewMap} />
            <HistoryImages item={item} onPreview={onPreviewImage} />
          </div>

          <IncidentTimeStats item={item} />
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-red-500 text-sm">⏱</span> Timeline เหตุการณ์
          </p>
          <IncidentTimeline timeline={item.timeline} />
        </div>

        <IncidentActions
          item={item}
          role={role}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      </div>

      <ReporterDetailModal
        isOpen={showReporterModal}
        onClose={() => setShowReporterModal(false)}
        reporterUid={reporterUid}
        fallbackReporter={item.reporter}
        incidentId={item.id}
        role={role}
      />
    </>
  );
}

// toolbar ด้านบนสำหรับค้นหา กรองช่วงเวลา กรองสถานะ/ประเภทเหตุ/ความรุนแรง เรียงลำดับ และส่งออกรายงาน CSV
function HistoryToolbar({
  search,
  statusFilter,
  typeFilter,
  severityFilter,
  sortBy,
  datePreset,
  customStartDate,
  customEndDate,
  resultCount,
  role,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onSeverityChange,
  onSortChange,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
  onExportCsv,
  onBulkDelete,
}) {
  return (
    <div className="space-y-4 mb-6 pb-5 border-b border-slate-100">
      {/* แถวบน: หัวข้อ + ปุ่มส่งออกรายงาน CSV + ปุ่มลบทั้งหมด */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            ประวัติย้อนหลัง
            <span className="text-xs font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-full">
              พบ {resultCount} เคส
            </span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            เลือกช่วงเวลา ประเภทเหตุฉุกเฉิน และระดับความรุนแรง เพื่อดูข้อมูลหรือสร้างรายงาน CSV
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={resultCount === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            สร้างรายงาน CSV ({resultCount} เคส)
          </button>

          {role === "admin" && resultCount > 0 && (
            <button
              type="button"
              onClick={onBulkDelete}
              className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              ลบที่แสดง ({resultCount})
            </button>
          )}
        </div>
      </div>

      {/* แถวตัวกรองช่วงเวลา (Date Range Picker) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            ช่วงเวลา:
          </span>
          {DATE_PRESETS.map((preset) => {
            const active = datePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onDatePresetChange(preset.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${active
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {datePreset === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">ตั้งแต่:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">ถึง:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* แถวค้นหา + กรองประเภทเหตุฉุกเฉิน + กรองระดับความรุนแรง + กรองสถานะ + เรียงลำดับเคส */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 px-1">
            ค้นหาข้อความ
          </label>
          <input
            className={CONTROL_CLASS}
            placeholder="เลขเคส / ผู้แจ้ง / สถานที่..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 px-1">
            ประเภทเหตุฉุกเฉิน
          </label>
          <select
            className={CONTROL_CLASS}
            value={typeFilter}
            onChange={(event) => onTypeChange(event.target.value)}
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 px-1">
            ระดับความรุนแรง
          </label>
          <select
            className={CONTROL_CLASS}
            value={severityFilter}
            onChange={(event) => onSeverityChange(event.target.value)}
          >
            {SEVERITY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 px-1">
            สถานะการดำเนินงาน
          </label>
          <select
            className={CONTROL_CLASS}
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-500 px-1">
            เรียงลำดับเคส
          </label>
          <select
            className={CONTROL_CLASS}
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// empty state เมื่อไม่มีรายการหลังค้นหาหรือกรองสถานะ
function EmptyHistoryState() {
  return (
    <div className="text-center py-16">
      <span className="text-4xl opacity-50 mb-3 block">📭</span>
      <p className="text-slate-500 font-medium">ไม่พบประวัติเคสในช่วงเวลาหรือเงื่อนไขที่ค้นหา</p>
    </div>
  );
}

// modal preview รูปภาพแนบขนาดใหญ่
function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh]" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 text-white text-sm font-bold bg-white/20 hover:bg-red-500 px-4 py-2 rounded-xl transition"
        >
          ปิดรูปภาพ
        </button>
        <img
          src={imageUrl}
          alt="preview"
          className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10"
        />
      </div>
    </div>
  );
}

// modal แสดงตำแหน่งบน Google Map พร้อมที่อยู่และพิกัด
function MapPreviewModal({ location, onClose, isLoaded }) {
  if (!location) return null;

  const center = { lat: Number(location.lat), lng: Number(location.lng) };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            ตำแหน่งจุดเกิดเหตุ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors font-bold"
          >
            ✕
          </button>
        </div>

        <div className="h-[50vh] sm:h-[60vh] w-full bg-slate-100">
          {isLoaded ? (
            <GoogleMap
              mapContainerClassName="w-full h-full"
              center={center}
              zoom={16}
              options={{ mapTypeId: "hybrid", streetViewControl: false, mapTypeControl: false }}
            >
              <Marker position={center} />
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-medium">
              กำลังโหลดแผนที่...
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-sm font-medium text-slate-600 line-clamp-2">
            {location.address || "ไม่ทราบตำแหน่ง"}
          </p>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Lat: {center.lat.toFixed(6)}, Lng: {center.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}

// component หลัก: จัดการ state การค้นหา/filter/date range/sort/export และส่งข้อมูลให้ component ย่อย
export default function HistoryPage({ incidents = [], onRestore, onDelete, role }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [previewImage, setPreviewImage] = useState(null);
  const [previewMap, setPreviewMap] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // กรองรายการตามคำค้นหา ประเภทเหตุ สถานะ ความรุนแรง และช่วงเวลา พร้อมเรียงลำดับ
  const filteredIncidents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const filtered = incidents.filter((item) => {
      const status = item.status || "pending";
      const matchSearch = !keyword || getSearchText(item).includes(keyword);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      const matchType =
        typeFilter === "all" || item.type === typeFilter;
      const matchSeverity =
        severityFilter === "all" || item.severity === severityFilter;
      const matchDate = isWithinDateRange(
        toMillis(item.createdAt),
        datePreset,
        customStartDate,
        customEndDate
      );

      return (
        matchSearch && matchStatus && matchType && matchSeverity && matchDate
      );
    });

    return sortIncidents(filtered, sortBy);
  }, [
    incidents,
    search,
    statusFilter,
    typeFilter,
    severityFilter,
    sortBy,
    datePreset,
    customStartDate,
    customEndDate,
  ]);

  const handleExportCsv = () => {
    if (filteredIncidents.length === 0) return;
    exportIncidentsToCsv(
      filteredIncidents,
      datePreset,
      customStartDate,
      customEndDate,
      typeFilter,
      severityFilter,
      role
    );
  };

  // ลบรายการที่กำลังแสดงทั้งหมด โดยถามยืนยันก่อนเพื่อกันการลบถาวรโดยไม่ตั้งใจ
  const handleBulkDelete = () => {
    const ok = window.confirm(
      `คำเตือน: คุณต้องการลบประวัติที่แสดงอยู่นี้ทั้งหมด (${filteredIncidents.length} รายการ) ใช่หรือไม่?\nข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร และไม่สามารถกู้คืนได้`
    );

    if (ok) {
      filteredIncidents.forEach((item) => onDelete(item.id));
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar relative">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <HistoryToolbar
          search={search}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          severityFilter={severityFilter}
          sortBy={sortBy}
          datePreset={datePreset}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          resultCount={filteredIncidents.length}
          role={role}
          onSearchChange={setSearch}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onSeverityChange={setSeverityFilter}
          onSortChange={setSortBy}
          onDatePresetChange={setDatePreset}
          onCustomStartChange={setCustomStartDate}
          onCustomEndChange={setCustomEndDate}
          onExportCsv={handleExportCsv}
          onBulkDelete={handleBulkDelete}
        />

        {filteredIncidents.length === 0 ? (
          <EmptyHistoryState />
        ) : (
          <div className="space-y-4">
            {filteredIncidents.map((item) => (
              <IncidentHistoryCard
                key={item.id}
                item={item}
                role={role}
                onRestore={onRestore}
                onDelete={onDelete}
                onPreviewImage={setPreviewImage}
                onPreviewMap={setPreviewMap}
              />
            ))}
          </div>
        )}
      </div>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      <MapPreviewModal
        location={previewMap}
        onClose={() => setPreviewMap(null)}
        isLoaded={isLoaded}
      />
    </div>
  );
}
