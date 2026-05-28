import React from "react";

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
  on_the_way: "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้น",
};

const STATUS_OPTIONS = [
  { value: "accepted", label: "รับเคส" },
  { value: "on_the_way", label: "กำลังเดินทาง" },
  { value: "arrived", label: "ถึงจุดเกิดเหตุ" },
  { value: "completed", label: "เสร็จสิ้น" },
];

function formatTime(time) {
  if (!time) return "-";
  return new Date(time).toLocaleString("th-TH");
}

function ServiceAreaBadge({ incident }) {
  if (incident.isInsideServiceArea === true) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
        อยู่ในพื้นที่
      </span>
    );
  }

  if (incident.isInsideServiceArea === false) {
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

export default function IncidentCard({
  incident,
  isSelected,
  onClick,
  onUpdateStatus,
  onArchive,
}) {
  const isCompleted = incident.status === "completed";

  return (
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

          <p className="text-xs text-gray-500 mt-1">
            {formatTime(incident.createdAt)}
          </p>
        </div>

        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isCompleted
              ? "bg-green-100 text-green-700"
              : incident.status === "pending"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {STATUS_LABELS[incident.status] || incident.status}
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

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Timeline
        </p>

        <div className="space-y-1">
          {(incident.timeline || []).slice(-4).map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              <span className="text-gray-700">{item.label}</span>
              <span className="text-gray-400">
                {formatTime(item.time)}
              </span>
            </div>
          ))}

          {(!incident.timeline || incident.timeline.length === 0) && (
            <p className="text-xs text-gray-400">
              ยังไม่มี timeline
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {STATUS_OPTIONS.map((item) => (
          <button
            key={item.value}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(incident.id, item.value);
            }}
            disabled={incident.status === item.value}
            className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 rounded-lg px-2 py-2"
          >
            {item.label}
          </button>
        ))}
      </div>

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
    </div>
  );
}