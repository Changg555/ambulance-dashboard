import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../config/firebase';

// กำหนดสถานะตามลำดับ พร้อมสีและข้อความที่ใช้แสดงในรายการ
const STATUS_ITEMS = [
  {
    key: 'pending',
    label: 'รอรับเรื่อง',
    icon: '📋',
    colorClassName: 'bg-red-50 text-red-700 border-red-200',
    activeClassName: 'bg-red-600 text-white border-red-600',
  },
  {
    key: 'accepted',
    label: 'รับเรื่องแล้ว',
    icon: '✅',
    colorClassName: 'bg-orange-50 text-orange-700 border-orange-200',
    activeClassName: 'bg-orange-500 text-white border-orange-500',
  },
  {
    key: 'en_route',
    label: 'กำลังเดินทาง',
    icon: '🚑',
    colorClassName: 'bg-blue-50 text-blue-700 border-blue-200',
    activeClassName: 'bg-blue-600 text-white border-blue-600',
  },
  {
    key: 'arrived',
    label: 'ถึงที่เกิดเหตุ',
    icon: '📍',
    colorClassName: 'bg-purple-50 text-purple-700 border-purple-200',
    activeClassName: 'bg-purple-600 text-white border-purple-600',
  },
  {
    key: 'completed',
    label: 'เสร็จสิ้น',
    icon: '🏁',
    colorClassName: 'bg-green-50 text-green-700 border-green-200',
    activeClassName: 'bg-green-600 text-white border-green-600',
  },
];

// แปลงรหัสประเภทเหตุให้เป็นข้อความสำหรับส่วนหัว
const TYPE_LABELS = {
  vehicle_accident: '🚗 อุบัติเหตุรถ',
  motorcycle: '🏍️ รถจักรยานยนต์',
  cardiac: '💛 หัวใจ/หมดสติ',
  injury: '🤕 บาดเจ็บ',
  fire: '🔥 ไฟไหม้',
  other: '⚠️ เหตุอื่นๆ',
};

// รวมรูปแบบข้อมูลรูปจาก schema ปัจจุบันและ schema เดิมให้เป็น array เดียว
function getIncidentImages(incident) {
  return incident?.images || (incident?.image ? [incident.image] : []);
}

// คืนเวลาแจ้งเหตุในรูปแบบภาษาไทยสำหรับแสดงบนส่วนหัว
function formatIncidentTime(createdAt) {
  if (!createdAt) return '-';

  return new Date(createdAt).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// คืนข้อความแสดงเลขเคส โดยใช้ท้าย ID เป็นค่าทดแทนเมื่อไม่มี caseNumber
function getCaseNumber(incident) {
  return incident.caseNumber || incident.id?.slice(-8).toUpperCase() || '-';
}

// แสดงภาพขนาดใหญ่ พร้อมซูม ลากภาพ และปิดหน้าต่างตัวอย่าง
function ImagePreviewModal({ imageUrl, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState('center center');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!imageUrl) return null;

  // เลือกจุดซูมจากตำแหน่งที่คลิก และวนระดับซูมก่อนกลับสู่ขนาดปกติ
  const handleImageClick = (event) => {
    if (dragging) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    setOrigin(`${x}% ${y}%`);
    setZoom((currentZoom) => {
      if (currentZoom >= 4) {
        setPosition({ x: 0, y: 0 });
        setOrigin('center center');
        return 1;
      }

      return currentZoom + 1;
    });
  };

  // เริ่มลากภาพเมื่ออยู่ในระดับซูม
  const handleMouseDown = (event) => {
    if (zoom <= 1) return;

    event.preventDefault();
    setDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
  };

  // ปรับตำแหน่งภาพตามการลากของเมาส์
  const handleMouseMove = (event) => {
    if (!dragging) return;

    setPosition({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };

  // คืนภาพสู่ขนาดและตำแหน่งเริ่มต้น
  const resetImage = () => {
    setZoom(1);
    setOrigin('center center');
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh]"
        onClick={(event) => event.stopPropagation()}
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
              cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
              userSelect: 'none',
              transition: dragging ? 'none' : 'transform 0.2s ease',
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

// แสดงประเภท เลขเคส เวลา และปุ่มปิดของเหตุการณ์
function IncidentHeader({ incident, onClose }) {
  const typeLabel = TYPE_LABELS[incident.type] || incident.type;

  return (
    <div className="bg-red-700 px-5 py-4 flex items-start justify-between">
      <div>
        <p className="text-white font-semibold text-base">{typeLabel}</p>
        <p className="text-red-200 text-sm mt-0.5">
          #{getCaseNumber(incident)} · {formatIncidentTime(incident.createdAt)}
        </p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดรายละเอียดเหตุการณ์"
          className="text-red-200 hover:text-white text-xl leading-none ml-4 mt-0.5"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// แสดงที่อยู่และพิกัดของเหตุ โดยรองรับพิกัดละติจูดหรือ longitude ที่มีค่าเป็นศูนย์
function IncidentLocation({ location }) {
  const hasCoordinates =
    Number.isFinite(location?.lat) && Number.isFinite(location?.lng);

  return (
    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
      <p className="text-xs text-gray-400 mb-0.5">ตำแหน่งเกิดเหตุ</p>
      <p className="text-sm font-medium text-gray-700">
        📍 {location?.address || 'ไม่ทราบตำแหน่ง'}
      </p>
      {hasCoordinates && (
        <p className="text-xs text-gray-400 font-mono mt-0.5">
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}

// แสดงรายละเอียดเพิ่มเติมเมื่อเหตุการณ์มีคำอธิบาย
function IncidentDescription({ description }) {
  if (!description) return null;

  return (
    <div className="px-5 py-3 border-b border-gray-100">
      <p className="text-xs text-gray-400 mb-1">รายละเอียด</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

// แสดงภาพย่อและเปิดภาพที่เลือกใน modal
function IncidentImages({ images, onPreview }) {
  if (images.length === 0) return null;

  return (
    <div className="px-5 py-3 border-b border-gray-100">
      <p className="text-xs text-gray-400 mb-2">รูปภาพ ({images.length})</p>
      <div className="flex gap-2 flex-wrap">
        {images.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => onPreview(url)}
            aria-label={`ดูรูปเหตุการณ์ ${index + 1}`}
            className="block"
          >
            <img
              src={url}
              alt={`incident-${index}`}
              className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// สร้าง class ของปุ่มตามสถานะปัจจุบัน สถานะที่ผ่านมา และสถานะที่ยังมาไม่ถึง
function getStatusClassName(status, isCurrent, isPast) {
  if (isCurrent) return `${status.activeClassName} cursor-default`;
  if (isPast) {
    return 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100 cursor-pointer';
  }

  return `${status.colorClassName} hover:opacity-80 cursor-pointer`;
}

// แสดงสถานะทั้งหมด พร้อมบอกว่าสถานะใดกำลังทำงานหรือผ่านไปแล้ว
function StatusList({ currentStatus, updating, onUpdate }) {
  const currentIndex = STATUS_ITEMS.findIndex(
    (status) => status.key === currentStatus,
  );

  return (
    <div className="flex flex-col gap-2">
      {STATUS_ITEMS.map((status, index) => {
        const isCurrent = status.key === currentStatus;
        const isPast = currentIndex >= 0 && index < currentIndex;

        return (
          <button
            key={status.key}
            type="button"
            onClick={() => onUpdate(status.key)}
            disabled={updating || isCurrent}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${getStatusClassName(status, isCurrent, isPast)} disabled:opacity-60`}
          >
            <span className="text-base">{status.icon}</span>
            <span className="flex-1">{status.label}</span>
            {isCurrent && (
              <span className="text-xs opacity-75 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse" />
                ปัจจุบัน
              </span>
            )}
            {isPast && <span className="text-xs opacity-50">✓ ผ่านแล้ว</span>}
          </button>
        );
      })}
    </div>
  );
}

// แสดงช่องหมายเหตุประกอบการเปลี่ยนสถานะ
function StatusNote({ note, onChange }) {
  return (
    <div className="mt-4">
      <label className="block text-xs text-gray-400 mb-1.5">
        หมายเหตุ (ไม่บังคับ)
        <textarea
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
          rows={2}
          placeholder="เพิ่มหมายเหตุสำหรับเหตุการณ์นี้..."
          value={note}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

// แสดงผลสำเร็จหรือสถานะกำลังบันทึกให้ผู้ใช้เห็น
function UpdateFeedback({ success, updating }) {
  return (
    <>
      {success && (
        <div className="mt-3 bg-green-50 text-green-700 text-sm px-4 py-2 rounded-xl border border-green-200 flex items-center gap-2">
          <span>✅</span> อัปเดตสถานะเรียบร้อยแล้ว
        </div>
      )}
      {updating && (
        <div className="mt-3 bg-blue-50 text-blue-600 text-sm px-4 py-2 rounded-xl border border-blue-200 flex items-center gap-2">
          <span className="animate-spin inline-block">⏳</span> กำลังอัปเดต...
        </div>
      )}
    </>
  );
}

// รวมรายการสถานะ หมายเหตุ และผลการบันทึกไว้ในส่วนอัปเดตเดียว
function StatusUpdateSection({
  currentStatus,
  updating,
  note,
  success,
  onNoteChange,
  onUpdate,
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        อัปเดตสถานะ
      </p>
      <StatusList
        currentStatus={currentStatus}
        updating={updating}
        onUpdate={onUpdate}
      />
      <StatusNote note={note} onChange={onNoteChange} />
      <UpdateFeedback success={success} updating={updating} />
    </div>
  );
}

// จัดการ state และบันทึกสถานะใหม่ของเหตุการณ์ลง Firebase
export default function StatusUpdater({ incident, onClose }) {
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  if (!incident) return null;

  const images = getIncidentImages(incident);

  // บันทึกสถานะ หมายเหตุ และเวลาที่อัปเดต แล้วแสดงผลตามผลการบันทึก
  const handleUpdate = async (newStatus) => {
    if (newStatus === incident.status || updating) return;

    setUpdating(true);
    setSuccess(false);

    try {
      await update(ref(db, `incidents/${incident.id}`), {
        status: newStatus,
        note: note.trim() || null,
        updatedAt: Date.now(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <IncidentHeader incident={incident} onClose={onClose} />
        <IncidentLocation location={incident.location} />
        <IncidentDescription description={incident.description} />
        <IncidentImages images={images} onPreview={setPreviewImage} />
        <StatusUpdateSection
          currentStatus={incident.status}
          updating={updating}
          note={note}
          success={success}
          onNoteChange={setNote}
          onUpdate={handleUpdate}
        />
      </div>
      <ImagePreviewModal
        imageUrl={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}