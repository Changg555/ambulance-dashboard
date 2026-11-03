import React, { useMemo, useState } from "react";
import { toMillis } from "../hooks/useIncidents";
import { DATE_PRESETS, isWithinDateRange } from "../utils/dateFilter";

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

const COUNT_STATUSES = [
  "pending",
  "on_the_way",
  "arrived",
  "completed",
];

function countStats(list) {
  const result = {
    total: list.length,
    pending: 0,
    on_the_way: 0,
    arrived: 0,
    completed: 0,
  };

  list.forEach((item) => {
    if (COUNT_STATUSES.includes(item.status)) {
      result[item.status] += 1;
    }
  });

  return result;
}

export default function StatsBar({ incidents = [] }) {
  const [datePreset, setDatePreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const stats = useMemo(() => {
    const filtered = incidents.filter((item) =>
      isWithinDateRange(
        toMillis(item.createdAt),
        datePreset,
        customStart,
        customEnd
      )
    );

    return countStats(filtered);
  }, [incidents, datePreset, customStart, customEnd]);

  return (
    <div className="px-4 pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">

        {/* กล่องสถิติ */}
        {STAT_ITEMS.map((item) => (
          <div
            key={item.key}
            className={` rounded-2xl border shadow-sm px-4 py-3 min-w-0 ${item.cardClassName}`}
          >
            <p className="text-sm font-medium text-slate-500 truncate">
              {item.label}
            </p>

            <p
              className={` text-3xl font-bold mt-1 leading-tight ${item.valueClassName} `}
            >
              {stats[item.key]}
            </p>
          </div>
        ))}


        {/* กล่องเลือกช่วงเวลา */}
        <div
          className=" rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 min-w-0 "
        >
          {/* บรรทัดแรก: ข้อความ + Dropdown */}
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium text-slate-500 whitespace-nowrap">
              สรุปจำนวนเหตุฉุกเฉิน
            </p>

            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className=" flex-1 min-w-0 bg-red-50 border border-red-200 text-red-600 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 "
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* บรรทัดที่สอง: แสดงเฉพาะเมื่อเลือกกำหนดเอง */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5 mt-2 min-w-0">
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                ตั้งแต่วันที่
              </span>

              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className=" flex-1 min-w-0 w-0 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] text-slate-700 "
              />

              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                ถึง
              </span>

              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className=" flex-1 min-w-0 w-0 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] text-slate-700 "
              />
            </div>
          )}
        </div>


      </div>
    </div>
  );
}