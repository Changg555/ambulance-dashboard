import React, { useState } from "react";
import { toMillis } from "../hooks/useIncidents";
import ReporterDetailModal from "./ReporterDetailModal";

// ป้ายกำกับประเภทเหตุฉุกเฉิน อิงจากฝั่ง Mobile (src/constants/incident.js)
const TYPE_LABELS = {
  sos: "🚨 แจ้งเหตุด่วน (SOS)",
  car_accident: "🚗 อุบัติเหตุรถ",
  cardiac: "❤️ หัวใจ/หมดสติ",
  injury: "🩹 บาดเจ็บ",
  fire: "🔥 ไฟไหม้",
  drowning: "🌊 จมน้ำ",
  other: "⚠️ เหตุอื่น ๆ",
};

// ระดับความรุนแรง อิงจากฝั่ง Mobile (src/constants/incident.js)
const SEVERITY_CONFIG = {
  low: { label: "ไม่รุนแรง", className: "bg-emerald-100 text-emerald-700" },
  medium: { label: "ปานกลาง", className: "bg-amber-100 text-amber-700" },
  high: { label: "รุนแรง", className: "bg-orange-100 text-orange-700" },
  critical: { label: "วิกฤต", className: "bg-red-100 text-red-700" },
};

// ป้ายกำกับสถานะของเคส อิงตามฝั่ง Mobile
const STATUS_LABELS = {
  pending: "รอเจ้าหน้าที่รับเรื่อง",
  accepted: "เจ้าหน้าที่รับเรื่องแล้ว",
  on_the_way: "กำลังเดินทางไปหาคุณ",
  arrived: "ถึงจุดเกิดเหตุแล้ว",
  completed: "ช่วยเหลือเสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

// ลำดับปุ่มเปลี่ยนสถานะที่เจ้าหน้าที่สามารถกดได้ (ใช้ค่าตรงกับ Mobile STATUS_FLOW)
const STATUS_OPTIONS = [
  { value: "accepted", label: "รับเคส" },
  { value: "on_the_way", label: "กำลังเดินทาง" },
  { value: "arrived", label: "ถึงจุดเกิดเหตุ" },
  { value: "completed", label: "เสร็จสิ้น" },
];

// flow สถานะที่บังคับให้เปลี่ยนทีละขั้นเพื่อกันการข้ามขั้นตอน (ตรงกับ Mobile STATUS_FLOW)
const STATUS_FLOW = ["pending", "accepted", "on_the_way", "arrived", "completed"];

// ข้อความยืนยัน action ที่มีผลต่อข้อมูลจริง
const CONFIRM_MESSAGES = {
  cancel: "ต้องการยกเลิกเคสนี้ใช่หรือไม่? เคสจะถูกเก็บไว้ในประวัติ",
  delete: "ต้องการลบเคสนี้ถาวรใช่หรือไม่? ข้อมูลจะหายจาก Firebase ทันที",
};

// แสดงวันที่/เวลาแบบไทย และกันค่าว่างไม่ให้แสดง Invalid Date
function formatTime(time) {
  const ms = toMillis(time);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("th-TH");
}

// เช็คว่าสถานะถัดไปเป็นขั้นถัดไปจริงหรือไม่
function canGoToStatus(currentStatus, nextStatus) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus || "pending");
  const nextIndex = STATUS_FLOW.indexOf(nextStatus);

  return nextIndex === currentIndex + 1;
}

// รวมรูปจากฝั่ง Mobile ({ url, publicId }) และ schema เดิมให้เป็น array ของ URL
function getIncidentImages(incident) {
  const raw = incident?.images || (incident?.image ? [incident.image] : []);
  return raw
    .map((item) => (typeof item === "string" ? item : item?.url))
    .filter(Boolean);
}

// เช็คว่ามีพิกัดครบพอสำหรับแสดงตัวเลข lat/lng หรือไม่
function getCoords(location) {
  const lat = Number(location?.latitude ?? location?.lat);
  const lng = Number(location?.longitude ?? location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  return { lat, lng };
}

// จำกัด timeline ให้แสดงเฉพาะรายการท้าย ๆ เพื่อไม่ให้ card ยาวเกินไป
function getLatestTimelineItems(timeline) {
  return (timeline || []).slice(-5);
}

// รวม class ของ card ตามสถานะ selected เพื่อให้อ่าน layout หลักง่ายขึ้น
function getCardClassName(isSelected) {
  const selectedClass =
    "border-2 border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.15)] bg-amber-50/20";
  const defaultClass = "border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md";

  return `bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 ${
    isSelected ? selectedClass : defaultClass
  }`;
}

// เลือกสี badge สถานะตามความหมายของสถานะปัจจุบัน
function getStatusBadgeClassName(status) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "cancelled") return "bg-slate-200 text-slate-700";
  if (status === "pending") return "bg-red-500 text-white animate-pulse";
  return "bg-blue-100 text-blue-700";
}

// badge พื้นฐานที่ใช้ซ้ำกับข้อมูลสถานะ/พื้นที่บริการ/ระยะทาง
function Badge({ children, className }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${className}`}>
      {children}
    </span>
  );
}

// badge แสดงว่าเหตุอยู่ในหรือนอกพื้นที่บริการ
function ServiceAreaBadge({ incident }) {
  if (incident?.isInsideServiceArea === true) {
    return <Badge className="bg-emerald-100 text-emerald-700">อยู่ในพื้นที่</Badge>;
  }

  if (incident?.isInsideServiceArea === false) {
    return <Badge className="bg-red-100 text-red-700">นอกพื้นที่</Badge>;
  }

  return <Badge className="bg-slate-100 text-slate-500">ยังไม่ตรวจพื้นที่</Badge>;
}

// ส่วนหัวของ card: ประเภทเหตุ เลขเคส เวลาแจ้งเหตุ และสถานะปัจจุบัน
function IncidentHeader({ incident, currentStatus }) {
  const caseNumber = incident.caseNumber || `KPS-${incident.id?.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="font-bold text-slate-800 text-lg">
          {TYPE_LABELS[incident.type] || incident.type || "ไม่ระบุเหตุ"}
        </h3>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-mono">
            {caseNumber}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {formatTime(incident.createdAt)}
          </span>
        </div>
      </div>

      <span
        className={`text-[11px] px-3 py-1.5 rounded-full font-bold shadow-sm whitespace-nowrap ${getStatusBadgeClassName(
          currentStatus
        )}`}
      >
        {STATUS_LABELS[currentStatus] || currentStatus}
      </span>
    </div>
  );
}

// badge ข้อมูลเสริม เช่น ความรุนแรง โหมดการแจ้งเหตุ พื้นที่บริการ และระยะห่างจากศูนย์
function IncidentMetaBadges({ incident }) {
  const severityInfo = SEVERITY_CONFIG[incident.severity];

  return (
    <div className="flex gap-2 flex-wrap mt-3.5">
      {severityInfo && (
        <Badge className={severityInfo.className}>
          ความรุนแรง: {severityInfo.label}
        </Badge>
      )}

      {incident.mode === "quick" && (
        <Badge className="bg-red-600 text-white">SOS ด่วน</Badge>
      )}

      <ServiceAreaBadge incident={incident} />

      {incident.distanceFromServiceCenter != null && (
        <Badge className="bg-slate-100 text-slate-600">
          ห่างศูนย์ {incident.distanceFromServiceCenter} ม.
        </Badge>
      )}
    </div>
  );
}

// ข้อมูลผู้แจ้งเหตุและเจ้าหน้าที่ผู้รับผิดชอบ (จากฝั่ง Mobile reporter & assignedTo)
function IncidentReporterInfo({ reporter, assignedTo, hasReporterUid, onViewReporter }) {
  if (!reporter && !assignedTo && !hasReporterUid) return null;

  return (
    <div className="mt-3 space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
      {(reporter || hasReporterUid) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 font-medium">
              👤 ผู้แจ้ง:{" "}
              <strong className="text-slate-800">{reporter?.name || "-"}</strong>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewReporter();
              }}
              className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg shadow-sm transition flex items-center gap-1"
            >
              <span>🪪</span> ดูข้อมูลผู้แจ้ง
            </button>
          </div>
          {reporter?.phone && (
            <a
              href={`tel:${reporter.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
            >
              📞 {reporter.phone}
            </a>
          )}
        </div>
      )}

      {assignedTo && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
          <span className="text-slate-600 font-medium">
            🚑 ผู้รับผิดชอบ:{" "}
            <strong className="text-slate-800">
              {assignedTo.name || "-"}
              {assignedTo.vehicle ? ` (${assignedTo.vehicle})` : ""}
            </strong>
          </span>
          {assignedTo.phone && (
            <span className="text-slate-500 font-mono">{assignedTo.phone}</span>
          )}
        </div>
      )}
    </div>
  );
}

// รายละเอียดเหตุการณ์ที่ผู้แจ้งกรอกเข้ามา
function IncidentDescription({ description, mode }) {
  if (mode === "quick" && !description) return null;

  return (
    <p className="text-sm font-medium text-slate-700 mt-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
      {description || "ไม่มีรายละเอียดแจ้งไว้"}
    </p>
  );
}

// ตำแหน่งเหตุการณ์และพิกัด lat/lng ถ้ามีข้อมูลครบ
function IncidentLocation({ incident }) {
  const address = incident.address || incident.location?.address || "ไม่ทราบตำแหน่ง";
  const coords = getCoords(incident.location);

  return (
    <div className="mt-3">
      <p className="text-[13px] font-medium text-slate-500 flex items-start gap-1.5">
        <span className="text-red-500">📍</span>
        <span className="leading-snug">{address}</span>
      </p>

      {coords && (
        <p className="text-[11px] font-mono text-slate-400 mt-1.5 ml-5">
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          {incident.location?.source ? ` (${incident.location.source})` : ""}
        </p>
      )}
    </div>
  );
}

// รูปภาพแนบของเหตุการณ์ พร้อมปุ่มเปิด preview
function IncidentImages({ incident, onPreview }) {
  const imageList = getIncidentImages(incident);
  if (imageList.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
        รูปภาพ ({imageList.length})
      </p>

      <div className="flex gap-2 flex-wrap">
        {imageList.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPreview(url);
            }}
            className="block"
          >
            <img
              src={url}
              alt={`incident-${index}`}
              className="w-16 h-16 object-cover rounded-xl border border-slate-200 hover:opacity-80 transition hover:scale-105"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// timeline การเปลี่ยนสถานะของเหตุการณ์
function IncidentTimeline({ timeline }) {
  const timelineItems = getLatestTimelineItems(timeline);

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <p className="text-[11px] font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-1.5">
        <span className="text-red-500 text-sm">⏱</span> Timeline เหตุการณ์
      </p>

      <div className="space-y-0">
        {timelineItems.map((item, index) => {
          const timelineStatus = item?.status || "pending";
          const isLast = index === timelineItems.length - 1;
          const timeVal = item?.time ?? item?.at;

          return (
            <div key={item?.id || `${timelineStatus}-${index}`} className="flex gap-3">
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
                  {item?.note || item?.label || STATUS_LABELS[timelineStatus] || "-"}
                </span>

                <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 whitespace-nowrap w-fit">
                  {formatTime(timeVal)}
                </span>
              </div>
            </div>
          );
        })}

        {timelineItems.length === 0 && (
          <p className="text-xs font-medium text-slate-400 italic pl-1">
            ยังไม่มีการบันทึกสถานะ
          </p>
        )}
      </div>
    </div>
  );
}

// ปุ่มเปลี่ยนสถานะทีละขั้นแบบปุ่มเดียวตามสถานะปัจจุบัน (แทนการแสดง 4 ปุ่มพร้อมกัน)
function StatusActionGrid({ currentStatus, incidentId, onUpdateStatus }) {
  const nextOption = STATUS_OPTIONS.find((option) =>
    canGoToStatus(currentStatus, option.value)
  );

  if (!nextOption) return null;

  return (
    <div className="mt-2 pt-4 border-t border-slate-100">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onUpdateStatus(incidentId, nextOption.value);
        }}
        className="w-full text-xs font-bold rounded-xl px-3 py-3 transition-all bg-red-500 text-white hover:bg-red-600 shadow-sm"
      >
        {nextOption.label}
      </button>
    </div>
  );
}

// ปุ่มยกเลิกเคส โดยแยก confirm ไว้ให้ component หลักไม่รก
function DangerActions({ incidentId, canCancel, onCancel }) {
  const confirmAndRun = (event, message, action) => {
    event.stopPropagation();
    if (window.confirm(message)) action(incidentId);
  };

  if (!canCancel) return null;

  return (
    <button
      type="button"
      onClick={(event) => confirmAndRun(event, CONFIRM_MESSAGES.cancel, onCancel)}
      className="w-full mt-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-3 py-3 transition-all"
    >
      ยกเลิกเคส
    </button>
  );
}

// hook ภายในสำหรับจัดการ zoom/drag ของรูป preview ให้ modal อ่านง่ายขึ้น
function useImageZoom() {
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState("center center");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  const resetImage = () => {
    setZoom(1);
    setOrigin("center center");
    setPosition({ x: 0, y: 0 });
  };

  const handleImageClick = (event) => {
    if (dragging) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setOrigin(`${x}% ${y}%`);
    setZoom((currentZoom) => {
      if (currentZoom >= 4) {
        resetImage();
        return 1;
      }

      return currentZoom + 1;
    });
  };

  const handleMouseDown = (event) => {
    if (zoom <= 1) return;

    event.preventDefault();
    setDragging(true);
    setStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
  };

  const handleMouseMove = (event) => {
    if (!dragging) return;

    setPosition({
      x: event.clientX - start.x,
      y: event.clientY - start.y,
    });
  };

  const handleMouseUp = () => setDragging(false);

  return {
    dragging,
    imageStyle: {
      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
      transformOrigin: origin,
      cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
      userSelect: "none",
      transition: dragging ? "none" : "transform 0.2s ease",
    },
    handleImageClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetImage,
  };
}

// modal preview รูปภาพ รองรับคลิกเพื่อ zoom และลากดูรูปเมื่อ zoom แล้ว
function ImagePreviewModal({ imageUrl, onClose }) {
  const {
    imageStyle,
    handleImageClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetImage,
  } = useImageZoom();

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute -top-12 right-0 flex gap-2">
          <button
            type="button"
            onClick={resetImage}
            className="text-white text-sm font-semibold bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-xl transition"
          >
            100%
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-white text-sm font-semibold bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-xl transition shadow-lg shadow-red-500/30"
          >
            ปิดหน้าต่าง
          </button>
        </div>

        <div className="overflow-hidden max-w-[95vw] max-h-[90vh] bg-black rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl shadow-black">
          <img
            src={imageUrl}
            alt="preview"
            onClick={handleImageClick}
            onMouseDown={handleMouseDown}
            draggable={false}
            style={imageStyle}
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>

        <p className="text-white/60 text-xs font-medium text-center mt-3">
          จิ้มตรงจุดที่ต้องการซูม • ลากเพื่อดูภาพ • กด 100% เพื่อรีเซ็ต
        </p>
      </div>
    </div>
  );
}

// component หลักของ card เหตุฉุกเฉิน: รวม state preview และประกอบ section ย่อยเข้าด้วยกัน
export default function IncidentCard({
  incident,
  isSelected,
  onClick,
  onUpdateStatus,
  onCancel,
  onDelete,
  role,
}) {
  const [previewImage, setPreviewImage] = useState(null);
  const [showReporterModal, setShowReporterModal] = useState(false);

  if (!incident) return null;

  const currentStatus = incident.status || "pending";
  const isCompleted = currentStatus === "completed";
  const isCancelled = currentStatus === "cancelled";
  const canCancel = !isCompleted && !isCancelled;
  const canUpdateStatus = !isCompleted && !isCancelled;
  const reporterUid = incident.reporter?.uid || incident.userId || null;

  return (
    <>
      <div onClick={onClick} className={getCardClassName(isSelected)}>
        <IncidentHeader incident={incident} currentStatus={currentStatus} />
        <IncidentMetaBadges incident={incident} />
        <IncidentReporterInfo
          reporter={incident.reporter}
          assignedTo={incident.assignedTo}
          hasReporterUid={Boolean(reporterUid)}
          onViewReporter={() => setShowReporterModal(true)}
        />
        <IncidentDescription description={incident.description} mode={incident.mode} />
        <IncidentLocation incident={incident} />
        <IncidentImages incident={incident} onPreview={setPreviewImage} />
        <IncidentTimeline timeline={incident.timeline} />

        {canUpdateStatus && (
          <StatusActionGrid
            currentStatus={currentStatus}
            incidentId={incident.id}
            onUpdateStatus={onUpdateStatus}
          />
        )}

        <DangerActions
          incidentId={incident.id}
          canCancel={canCancel}
          role={role}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </div>

      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />

      <ReporterDetailModal
        isOpen={showReporterModal}
        onClose={() => setShowReporterModal(false)}
        reporterUid={reporterUid}
        fallbackReporter={incident.reporter}
        incidentId={incident.id}
        role={role}
      />
    </>
  );
}
