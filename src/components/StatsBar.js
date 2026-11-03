import React, { useMemo, useState } from "react";
import { toMillis } from "../hooks/useIncidents";
import { DATE_PRESETS, isWithinDateRange } from "../utils/dateFilter";

// รายการ stat ที่ต้องการแสดงบนแถบสรุป แก้ config นี้จุดเดียวเพื่อเพิ่ม/เปลี่ยน card
const STAT_ITEMS = [
  { key: "pending", label: "รอรับเรื่อง", valueClassName: "text-red-500", cardClassName: "bg-red-50/50 border-red-100" },
  { key: "on_the_way", label: "กำลังเดินทาง", valueClassName: "text-amber-500", cardClassName: "bg-amber-50/50 border-amber-100" },
  { key: "arrived", label: "ถึงจุดเกิดเหตุ", valueClassName: "text-teal-600", cardClassName: "bg-teal-50/50 border-teal-100" },
  { key: "completed", label: "เสร็จสิ้น", valueClassName: "text-emerald-500", cardClassName: "bg-emerald-50/50 border-emerald-100" },
  { key: "total", label: "รวมทั้งหมด", valueClassName: "text-slate-700", cardClassName: "bg-slate-50 border-slate-200" },
];

const COUNT_STATUSES = ["pending", "on_the_way", "arrived", "completed"];

// นับจำนวนเคสแต่ละสถานะจากรายการที่กรองแล้ว
function countStats(list) {
  const result = { total: list.length, pending: 0, on_the_way: 0, arrived: 0, completed: 0 };
  list.forEach((item) => {
    if (COUNT_STATUSES.includes(item.status)) result[item.status] += 1;
  });
  return result;
}

function StatCard({ label, value, valueClassName, cardClassName }) {
  return (
    <div className={`flex flex-col justify-center rounded-xl px-4 py-3 border ${cardClassName} shadow-sm`}>
      <p className="text-xs font-semibold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

// แถวเลือกช่วงเวลา (หน้าตาเหมือนหน้าประวัติ/สถิติ)
function DateFilterBar({ preset, start, end, onPreset, onStart, onEnd }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-500 mr-1">ช่วงเวลา:</span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPreset(p.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              preset === p.value
                ? "bg-red-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={start}
            onChange={(e) => onStart(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700"
          />
          <span className="text-xs font-bold text-slate-400">ถึง</span>
          <input
            type="date"
            value={end}
            onChange={(e) => onEnd(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700"
          />
        </div>
      )}
    </div>
  );
}

// แถบสรุปสถานะเหตุการณ์ด้านบนของ dashboard
export default function StatsBar({ incidents = [] }) {
  const [datePreset, setDatePreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // กรองตามวันที่แจ้งเหตุ แล้วนับใหม่ทุกครั้งที่ข้อมูลหรือฟิลเตอร์เปลี่ยน
  const stats = useMemo(() => {
    const filtered = incidents.filter((item) =>
      isWithinDateRange(toMillis(item.createdAt), datePreset, customStart, customEnd)
    );
    return countStats(filtered);
  }, [incidents, datePreset, customStart, customEnd]);

  return (
    <div className="px-4 pt-4 space-y-3">
      <DateFilterBar
        preset={datePreset}
        start={customStart}
        end={customEnd}
        onPreset={setDatePreset}
        onStart={setCustomStart}
        onEnd={setCustomEnd}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STAT_ITEMS.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={stats[item.key]}
            valueClassName={item.valueClassName}
            cardClassName={item.cardClassName}
          />
        ))}
      </div>
    </div>
  );
}