// src/components/StatsBar.js
import React from 'react';

const STAT_CONFIG = [
  { key: 'pending',   label: 'รอรับเรื่อง',    color: 'text-red-600',    bg: 'bg-red-50' },
  { key: 'en_route',  label: 'กำลังเดินทาง',   color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { key: 'completed', label: 'เสร็จสิ้นวันนี้', color: 'text-green-600',  bg: 'bg-green-50' },
  { key: 'total',     label: 'รวมทั้งหมด',      color: 'text-gray-700',   bg: 'bg-gray-50' },
];

export default function StatsBar({ stats }) {
  return (
    <div className="flex gap-3 px-4 pt-3">
      {STAT_CONFIG.map((s) => (
        <div
          key={s.key}
          className={`flex-1 ${s.bg} rounded-xl px-4 py-3`}
        >
          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
          <p className={`text-2xl font-semibold ${s.color}`}>{stats?.[s.key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
