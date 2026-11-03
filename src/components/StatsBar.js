import React from "react";

// รายการ stat ที่ต้องการแสดงบนแถบสรุป แก้ config นี้จุดเดียวเพื่อเพิ่ม/เปลี่ยน card
const STAT_ITEMS = [
  {
    key: "pending",
    label: "รอรับเรื่อง",
    valueClassName: "text-red-500",
    cardClassName: "bg-red-50/50 border-red-100",
  },
  {
    key: "on_the_way",
    label: "กำลังเดินทาง",
    valueClassName: "text-amber-500",
    cardClassName: "bg-amber-50/50 border-amber-100",
  },
  {
    key: "arrived",
    label: "ถึงจุดเกิดเหตุ",
    valueClassName: "text-teal-600",
    cardClassName: "bg-teal-50/50 border-teal-100",
  },
  {
    key: "completed",
    label: "เสร็จสิ้นวันนี้",
    valueClassName: "text-emerald-500",
    cardClassName: "bg-emerald-50/50 border-emerald-100",
  },
  {
    key: "total",
    label: "รวมทั้งหมด",
    valueClassName: "text-slate-700",
    cardClassName: "bg-slate-50 border-slate-200",
  },
];

// อ่านค่า stat แบบปลอดภัย ถ้าไม่มีข้อมูลจะ fallback เป็น 0
function getStatValue(stats, key) {
  return stats?.[key] ?? 0;
}

// card แสดงตัวเลขหนึ่งรายการ แยกออกมาเพื่อลด JSX ซ้ำใน StatsBar
function StatCard({ label, value, valueClassName, cardClassName }) {
  return (
    <div
      className={`flex flex-col justify-center rounded-xl px-4 py-3 border ${cardClassName} shadow-sm`}
    >
      <p className="text-xs font-semibold text-slate-500 mb-0.5">
        {label}
      </p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

// แถบสรุปสถานะเหตุการณ์ด้านบนของ dashboard
export default function StatsBar({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 pt-4">
      {STAT_ITEMS.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={getStatValue(stats, item.key)}
          valueClassName={item.valueClassName}
          cardClassName={item.cardClassName}
        />
      ))}
    </div>
  );
}
