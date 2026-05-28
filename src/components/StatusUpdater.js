// src/components/StatusUpdater.js
import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../config/firebase';

/**
 * Panel อัปเดตสถานะเหตุการณ์สำหรับเจ้าหน้าที่
 *
 * Props:
 *   incident  - object เหตุการณ์ปัจจุบัน
 *   onClose   - callback เมื่อปิด panel
 */

const ALL_STATUSES = [
  {
    key:    'pending',
    label:  'รอรับเรื่อง',
    icon:   '📋',
    color:  'bg-red-50 text-red-700 border-red-200',
    active: 'bg-red-600 text-white border-red-600',
  },
  {
    key:    'accepted',
    label:  'รับเรื่องแล้ว',
    icon:   '✅',
    color:  'bg-orange-50 text-orange-700 border-orange-200',
    active: 'bg-orange-500 text-white border-orange-500',
  },
  {
    key:    'en_route',
    label:  'กำลังเดินทาง',
    icon:   '🚑',
    color:  'bg-blue-50 text-blue-700 border-blue-200',
    active: 'bg-blue-600 text-white border-blue-600',
  },
  {
    key:    'arrived',
    label:  'ถึงที่เกิดเหตุ',
    icon:   '📍',
    color:  'bg-purple-50 text-purple-700 border-purple-200',
    active: 'bg-purple-600 text-white border-purple-600',
  },
  {
    key:    'completed',
    label:  'เสร็จสิ้น',
    icon:   '🏁',
    color:  'bg-green-50 text-green-700 border-green-200',
    active: 'bg-green-600 text-white border-green-600',
  },
];

const TYPE_LABELS = {
  vehicle_accident: '🚗 อุบัติเหตุรถ',
  motorcycle:       '🏍️ รถจักรยานยนต์',
  cardiac:          '💛 หัวใจ/หมดสติ',
  injury:           '🤕 บาดเจ็บ',
  fire:             '🔥 ไฟไหม้',
  other:            '⚠️ เหตุอื่นๆ',
};

export default function StatusUpdater({ incident, onClose }) {
  const [updating, setUpdating] = useState(false);
  const [note, setNote]         = useState('');
  const [success, setSuccess]   = useState(false);

  if (!incident) return null;

  const currentIdx = ALL_STATUSES.findIndex((s) => s.key === incident.status);

  const handleUpdate = async (newStatus) => {
    if (newStatus === incident.status) return;
    setUpdating(true);
    setSuccess(false);
    try {
      await update(ref(db, `incidents/${incident.id}`), {
        status:    newStatus,
        note:      note.trim() || null,
        updatedAt: Date.now(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setUpdating(false);
    }
  };

  const timeStr = new Date(incident.createdAt).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">

      {/* Header */}
      <div className="bg-red-700 px-5 py-4 flex items-start justify-between">
        <div>
          <p className="text-white font-semibold text-base">
            {TYPE_LABELS[incident.type] || incident.type}
          </p>
          <p className="text-red-200 text-sm mt-0.5">
            #{incident.id?.slice(-8).toUpperCase()}  ·  {timeStr}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white text-xl leading-none ml-4 mt-0.5"
          >
            ✕
          </button>
        )}
      </div>

      {/* ตำแหน่ง */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">ตำแหน่งเกิดเหตุ</p>
        <p className="text-sm font-medium text-gray-700">
          📍 {incident.location?.address || 'ไม่ทราบตำแหน่ง'}
        </p>
        {incident.location?.lat && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            {incident.location.lat.toFixed(5)}, {incident.location.lng.toFixed(5)}
          </p>
        )}
      </div>

      {/* รายละเอียด */}
      {incident.description && (
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-1">รายละเอียด</p>
          <p className="text-sm text-gray-600">{incident.description}</p>
        </div>
      )}

      {/* รูปภาพ */}
      {incident.images?.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-2">รูปภาพ ({incident.images.length})</p>
          <div className="flex gap-2 flex-wrap">
            {incident.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* อัปเดตสถานะ */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          อัปเดตสถานะ
        </p>

        {/* Timeline ปุ่มสถานะ */}
        <div className="flex flex-col gap-2">
          {ALL_STATUSES.map((s, idx) => {
            const isCurrent = s.key === incident.status;
            const isPast    = idx < currentIdx;
            const isFuture  = idx > currentIdx;

            return (
              <button
                key={s.key}
                onClick={() => handleUpdate(s.key)}
                disabled={updating || isCurrent}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium
                  transition-all text-left
                  ${isCurrent
                    ? s.active + ' cursor-default'
                    : isPast
                      ? 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100 cursor-pointer'
                      : s.color + ' hover:opacity-80 cursor-pointer'
                  }
                  disabled:opacity-60
                `}
              >
                <span className="text-base">{s.icon}</span>
                <span className="flex-1">{s.label}</span>
                {isCurrent && (
                  <span className="text-xs opacity-75 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse"></span>
                    ปัจจุบัน
                  </span>
                )}
                {isPast && <span className="text-xs opacity-50">✓ ผ่านแล้ว</span>}
              </button>
            );
          })}
        </div>

        {/* หมายเหตุ */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-1.5">หมายเหตุ (ไม่บังคับ)</p>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700
              placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
            rows={2}
            placeholder="เพิ่มหมายเหตุสำหรับเหตุการณ์นี้..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Feedback */}
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
      </div>
    </div>
  );
}