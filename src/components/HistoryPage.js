import React, { useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

// ป้ายกำกับประเภทเหตุฉุกเฉินที่ใช้แสดงบนหน้าประวัติ
const TYPE_LABELS = {
  vehicle_accident: "🚗 อุบัติเหตุรถ",
  cardiac: "💛 หัวใจ/หมดสติ",
  injury: "🩹 บาดเจ็บ/ล้มหกล้ม",
  fire: "🔥 ไฟไหม้",
  other: "⚠️ อื่น ๆ",
};

// ป้ายกำกับสถานะของเคสหลัง normalize แล้ว
const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  accepted: "รับเคสแล้ว",
  en_route: "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกเคส",
};

// ตัวเลือกสถานะใน dropdown filter
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "completed", label: "เสร็จสิ้น" },
  { value: "cancelled", label: "ยกเลิกเคส" },
  { value: "accepted", label: "รับเคสแล้ว" },
  { value: "en_route", label: "กำลังเดินทาง" },
  { value: "arrived", label: "ถึงจุดเกิดเหตุ" },
];

// class กลางของ input/select เพื่อไม่ต้องเขียนซ้ำหลายจุด
const CONTROL_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all";

// แปลงชื่อสถานะเก่าให้เป็นรูปแบบเดียวกับหน้าปัจจุบัน
function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "pending";
}

// แสดงวันที่/เวลาในรูปแบบไทย และกันค่าว่างไม่ให้ UI พัง
function formatDate(time) {
  if (!time) return "-";
  return new Date(time).toLocaleString("th-TH");
}

// คำนวณเวลาที่ใช้ตั้งแต่เปิดเคสจนถึงปิดหรือยกเลิกเคส
function getDuration(start, end) {
  if (!start || !end) return "-";

  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} นาที`;

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours} ชม. ${remainMinutes} นาที`;
}

// รวมรูปจาก schema เก่าและใหม่ให้เป็น array เดียว
function getIncidentImages(item) {
  return item.images || (item.image ? [item.image] : []);
}

// เช็คว่าข้อมูลตำแหน่งมีพิกัดครบพอสำหรับแสดงแผนที่หรือไม่
function hasCoordinates(location) {
  return Boolean(location?.lat && location?.lng);
}

// เตรียมข้อความรวมสำหรับ search ในจุดเดียว เพื่อลด logic ซ้ำใน filter
function getSearchText(item) {
  return [
    item.caseNumber,
    item.id,
    item.type,
    item.description,
    item.location?.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ป้ายสถานะขนาดเล็กที่ใช้ซ้ำทั้ง archived/status
function StatusBadge({ children, tone = "slate" }) {
  const toneClass = {
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
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
        const status = normalizeStatus(log.status);
        const isLast = index === timeline.length - 1;

        return (
          <div key={`${status}-${log.time || index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 ${
                  isLast ? "bg-red-500 ring-4 ring-red-50" : "bg-slate-300"
                }`}
              />
              {!isLast && <div className="w-0.5 h-full bg-slate-200 my-1" />}
            </div>

            <div className="flex-1 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span
                className={`text-[13px] ${
                  isLast ? "font-bold text-slate-800" : "font-semibold text-slate-500"
                }`}
              >
                {STATUS_LABELS[status] || log.label || status}
              </span>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 whitespace-nowrap w-fit">
                {formatDate(log.time)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// แสดงตำแหน่งและปุ่มเปิด modal แผนที่ของเคส
function IncidentLocation({ location, onPreviewMap }) {
  const canOpenMap = hasCoordinates(location);

  return (
    <div className="mt-3 bg-slate-50 rounded-xl border border-slate-100 p-3 w-fit max-w-full">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-slate-600 flex items-start gap-1.5 leading-snug">
            <span className="text-red-500 shrink-0 mt-[2px]">📍</span>
            <span className="line-clamp-2">
              {location?.address || "ไม่ทราบตำแหน่ง"}
            </span>
          </p>

          {canOpenMap && (
            <p className="text-[11px] font-mono text-slate-400 mt-1 ml-5">
              {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
            </p>
          )}
        </div>

        {canOpenMap && (
          <button
            type="button"
            onClick={() => onPreviewMap(location)}
            className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all shadow-sm"
          >
            <span>🗺️</span> แผนที่
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

// ปุ่ม action ด้านล่างของ card แยกออกมาเพื่อลดความยาวของ component หลัก
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

// card หลักของเคสหนึ่งรายการ รวมเฉพาะ layout และเรียก component ย่อยที่แยกไว้
function IncidentHistoryCard({
  item,
  onRestore,
  onDelete,
  onPreviewImage,
  onPreviewMap,
  role,
}) {
  const status = normalizeStatus(item.status);
  const isCancelled = status === "cancelled";
  const caseNumber = item.caseNumber || item.id?.slice(0, 8);

  return (
    <div className="border border-slate-200 rounded-2xl p-5 bg-white hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-bold text-slate-800 text-lg">
              {TYPE_LABELS[item.type] || item.type || "ไม่ระบุประเภท"}
            </h3>
            <StatusBadge tone={isCancelled ? "slate" : "emerald"}>
              {STATUS_LABELS[status] || status}
            </StatusBadge>
            {item.archived && <StatusBadge tone="amber">เก็บประวัติแล้ว</StatusBadge>}
          </div>

          <p className="text-xs font-bold text-red-500 bg-red-50 inline-block px-2 py-1 rounded-md font-mono mb-2">
            #{caseNumber}
          </p>

          <p className="text-sm font-medium text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 w-fit max-w-full">
            {item.description || "ไม่มีรายละเอียด"}
          </p>

          <IncidentLocation location={item.location} onPreviewMap={onPreviewMap} />
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
  );
}

// toolbar ด้านบนสำหรับค้นหา กรองสถานะ และลบหลายรายการสำหรับ admin
function HistoryToolbar({
  search,
  statusFilter,
  resultCount,
  role,
  onSearchChange,
  onStatusChange,
  onBulkDelete,
}) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
      <div className="shrink-0">
        <h2 className="text-xl font-bold text-slate-800">ประวัติย้อนหลัง</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          เคสที่เสร็จสิ้น ยกเลิก หรือถูกเก็บเข้าประวัติ
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-1 xl:justify-end w-full">
        <input
          className={`flex-1 sm:w-auto ${CONTROL_CLASS}`}
          placeholder="ค้นหาเลขเคส / ประเภทเหตุ / สถานที่"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          className={`sm:w-auto shrink-0 ${CONTROL_CLASS}`}
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {role === "admin" && resultCount > 0 && (
          <button
            type="button"
            onClick={onBulkDelete}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            <span>🗑️</span> ลบทั้งหมด
          </button>
        )}
      </div>
    </div>
  );
}

// empty state เมื่อไม่มีรายการหลังค้นหาหรือกรองสถานะ
function EmptyHistoryState() {
  return (
    <div className="text-center py-16">
      <span className="text-4xl opacity-50 mb-3 block">📭</span>
      <p className="text-slate-500 font-medium">ไม่พบประวัติเคสที่ค้นหา</p>
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
            <span className="text-red-500">📍</span> ตำแหน่งจุดเกิดเหตุ
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

// component หลัก: จัดการ state การค้นหา/filter/modal และส่งข้อมูลให้ component ย่อย
export default function HistoryPage({ incidents = [], onRestore, onDelete, role }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewImage, setPreviewImage] = useState(null);
  const [previewMap, setPreviewMap] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // กรองรายการตามคำค้นหาและสถานะ โดย cache ผลลัพธ์ไว้จนกว่า input จะเปลี่ยน
  const filteredIncidents = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return incidents.filter((item) => {
      const status = normalizeStatus(item.status);
      const matchSearch = !keyword || getSearchText(item).includes(keyword);
      const matchStatus = statusFilter === "all" || status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [incidents, search, statusFilter]);

  // ลบรายการที่กำลังแสดงทั้งหมด โดยถามยืนยันก่อนเพื่อกันการลบถาวรโดยไม่ตั้งใจ
  const handleBulkDelete = () => {
    const ok = window.confirm(
      `🚨 คำเตือน: คุณต้องการลบประวัติที่แสดงอยู่นี้ทั้งหมด (${filteredIncidents.length} รายการ) ใช่หรือไม่?\nข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร และไม่สามารถกู้คืนได้`
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
          resultCount={filteredIncidents.length}
          role={role}
          onSearchChange={setSearch}
          onStatusChange={setStatusFilter}
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
