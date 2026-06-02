import React, { useState } from "react";

const TYPE_LABELS = {
  vehicle_accident: "🚗 อุบัติเหตุรถ",
  cardiac: "💛 หัวใจ/หมดสติ",
  injury: "🤕 บาดเจ็บ/ล้มหกล้ม",
  fire: "🔥 ไฟไหม้",
  other: "⚠️ อื่น ๆ",
};

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  accepted: "รับเคสแล้ว",
  en_route: "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกเคส",
};

const STATUS_OPTIONS = [
  { value: "accepted", label: "รับเคส" },
  { value: "en_route", label: "กำลังเดินทาง" },
  { value: "arrived", label: "ถึงจุดเกิดเหตุ" },
  { value: "completed", label: "เสร็จสิ้น" },
];

const STATUS_FLOW = [
  "pending",
  "accepted",
  "en_route",
  "arrived",
  "completed",
];

function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "pending";
}

function formatTime(time) {
  if (!time) return "-";
  return new Date(time).toLocaleString("th-TH");
}

function canGoToStatus(currentStatus, nextStatus) {
  const currentIndex = STATUS_FLOW.indexOf(normalizeStatus(currentStatus));
  const nextIndex = STATUS_FLOW.indexOf(normalizeStatus(nextStatus));

  return nextIndex === currentIndex + 1;
}

function ServiceAreaBadge({ incident }) {
  if (incident?.isInsideServiceArea === true) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
        อยู่ในพื้นที่
      </span>
    );
  }

  if (incident?.isInsideServiceArea === false) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
        นอกพื้นที่
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
      ยังไม่ตรวจพื้นที่
    </span>
  );
}

function IncidentImages({ incident, onPreview }) {
  const imageList =
    incident?.images || (incident?.image ? [incident.image] : []);

  if (!imageList || imageList.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">
        รูปภาพ ({imageList.length})
      </p>

      <div className="flex gap-2 flex-wrap">
        {imageList.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(url);
            }}
            className="block"
          >
            <img
              src={url}
              alt={`incident-${index}`}
              className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
            />
          </button>
        ))}
      </div>
    </div>
  );
}


function ImagePreviewModal({ imageUrl, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState("center center");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });

  if (!imageUrl) return null;

  const handleImageClick = (e) => {
    if (dragging) return;

    const rect = e.currentTarget.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setOrigin(`${x}% ${y}%`);

    setZoom((z) => {
      if (z >= 4) {
        setPosition({ x: 0, y: 0 });
        setOrigin("center center");
        return 1;
      }

      return z + 1;
    });
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;

    e.preventDefault();

    setDragging(true);
    setStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    setPosition({
      x: e.clientX - start.x,
      y: e.clientY - start.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const resetImage = () => {
    setZoom(1);
    setOrigin("center center");
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-10 right-0 flex gap-2">
          <button
            type="button"
            onClick={resetImage}
            className="text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg"
          >
            100%
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-white text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg"
          >
            ปิด
          </button>
        </div>

        <div className="overflow-hidden max-w-[95vw] max-h-[90vh] bg-black rounded-xl flex items-center justify-center">
          <img
            src={imageUrl}
            alt="preview"
            onClick={handleImageClick}
            onMouseDown={handleMouseDown}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: origin,
              cursor:
                zoom > 1
                  ? dragging
                    ? "grabbing"
                    : "grab"
                  : "zoom-in",
              userSelect: "none",
              transition: dragging ? "none" : "transform 0.2s ease",
            }}
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>

        <p className="text-white/80 text-xs text-center mt-2">
          จิ้มตรงจุดที่ต้องการซูม • ลากเพื่อดูภาพ • กด 100% เพื่อรีเซ็ต
        </p>
      </div>
    </div>
  );
}



export default function IncidentCard({
  incident,
  isSelected,
  onClick,
  onUpdateStatus,
  onArchive,
  onCancel,
  onDelete,
  role,
}) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!incident) return null;

  const currentStatus = normalizeStatus(incident.status);
  const isCompleted = currentStatus === "completed";
  const isCancelled = currentStatus === "cancelled";
  const canCancel = !isCompleted && !isCancelled;

  return (
    <>
      <div
        onClick={onClick}
        className={`bg-white rounded-xl border p-4 cursor-pointer shadow-sm hover:shadow-md transition ${
          isSelected ? "border-red-600 ring-2 ring-red-100" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-800">
              {TYPE_LABELS[incident.type] || incident.type || "ไม่ระบุเหตุ"}
            </h3>

            <p className="text-xs text-gray-500 mt-1 font-mono">
              {incident.caseNumber || incident.id}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              {formatTime(incident.createdAt)}
            </p>
          </div>

          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isCompleted
                ? "bg-green-100 text-green-700"
                : isCancelled
                  ? "bg-gray-200 text-gray-700"
                  : currentStatus === "pending"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-blue-100 text-blue-700"
            }`}
          >
            {STATUS_LABELS[currentStatus] || currentStatus}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          <ServiceAreaBadge incident={incident} />

          {incident.distanceFromServiceCenter && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              ห่างศูนย์กลาง {incident.distanceFromServiceCenter} ม.
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 mt-3">
          {incident.description || "ไม่มีรายละเอียด"}
        </p>

        <p className="text-xs text-gray-500 mt-2">
          📍 {incident.location?.address || "ไม่ทราบตำแหน่ง"}
        </p>

        <IncidentImages incident={incident} onPreview={setPreviewImage} />

        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            Timeline
          </p>

          <div className="space-y-1">
            {(incident.timeline || []).slice(-4).map((item, index) => {
              const timelineStatus = normalizeStatus(item?.status);

              return (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-600" />

                  <span className="text-gray-700">
                    {STATUS_LABELS[timelineStatus] || item?.label || "-"}
                  </span>

                  <span className="text-gray-400">
                    {formatTime(item?.time)}
                  </span>
                </div>
              );
            })}

            {(!incident.timeline || incident.timeline.length === 0) && (
              <p className="text-xs text-gray-400">
                ยังไม่มี timeline
              </p>
            )}
          </div>
        </div>

        {!isCompleted && !isCancelled && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {STATUS_OPTIONS.map((item) => {
              const isAllowed = canGoToStatus(currentStatus, item.value);

              return (
                <button
                  key={item.value}
                  onClick={(e) => {
                    e.stopPropagation();

                    if (!isAllowed) return;

                    onUpdateStatus(incident.id, item.value);
                  }}
                  disabled={!isAllowed}
                  className={`text-xs rounded-lg px-2 py-2 transition ${
                    isAllowed
                      ? "bg-gray-100 hover:bg-red-50 hover:text-red-700"
                      : "bg-gray-100 opacity-40 cursor-not-allowed"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {canCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();

              const ok = window.confirm(
                "ต้องการยกเลิกเคสนี้ใช่หรือไม่? เคสจะถูกเก็บไว้ในประวัติ"
              );

              if (ok) onCancel(incident.id);
            }}
            className="w-full mt-3 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-3 py-2"
          >
            ยกเลิกเคส
          </button>
        )}

        {isCompleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive(incident.id);
            }}
            className="w-full mt-3 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2"
          >
            เก็บเข้าประวัติ
          </button>
        )}

        {role === "admin" && (
          <button
            onClick={(e) => {
              e.stopPropagation();

              const ok = window.confirm(
                "ต้องการลบเคสนี้ถาวรใช่หรือไม่? ข้อมูลจะหายจาก Firebase ทันที"
              );

              if (ok) onDelete(incident.id);
            }}
            className="w-full mt-2 text-xs bg-red-700 hover:bg-red-800 text-white rounded-lg px-3 py-2"
          >
            ลบเคสถาวร
          </button>
        )}
      </div>

      <ImagePreviewModal
        imageUrl={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}