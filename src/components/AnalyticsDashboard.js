import React, { useMemo } from "react";

/**
 * ป้ายกำกับสำหรับประเภทเหตุฉุกเฉินต่างๆ
 */
const TYPE_LABELS = {
  vehicle_accident: "🚗 อุบัติเหตุรถ",
  cardiac: "💛 หัวใจ/หมดสติ",
  injury: "🤕 บาดเจ็บ/ล้มหกล้ม",
  fire: "🔥 ไฟไหม้",
  other: "⚠️ อื่น ๆ",
};

/**
 * ฟังก์ชันช่วยแปลงสถานะให้เป็นมาตรฐานเดียวกัน
 */
function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "unknown";
}

/**
 * ฟังก์ชันนับจำนวนเหตุการณ์แยกตามประเภท
 */
function countByType(incidents) {
  const result = {};
  incidents.forEach((item) => {
    const type = item.type || "other";
    result[type] = (result[type] || 0) + 1;
  });
  return Object.entries(result)
    .map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      count
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * ฟังก์ชันนับจำนวนเหตุการณ์แยกตามสถานะ
 */
function countByStatus(incidents) {
  const result = {};
  incidents.forEach((item) => {
    const status = normalizeStatus(item.status);
    result[status] = (result[status] || 0) + 1;
  });
  return result;
}

// --- Sub-components สำหรับ UI ---

/**
 * กล่องแสดงตัวเลขสถิติหลัก (Card)
 */
const StatCard = ({ title, value }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
    <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
  </div>
);

/**
 * กล่องแสดงสถานะพร้อมจำนวน (Small Box)
 */
const StatusBox = ({ label, value, color }) => (
  <div className={`rounded-xl p-3 border border-slate-100 ${color} transition-transform hover:scale-[1.02]`}>
    <p className="text-[11px] font-bold opacity-80">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

/**
 * แถบแสดงความก้าวหน้า (Progress Bar) สำหรับสถิติประเภทเหตุ
 */
const TypeProgressBar = ({ label, count, percentage }) => (
  <div>
    <div className="flex justify-between text-sm font-bold mb-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-800">{count}</span>
    </div>
    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full bg-red-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

// --- Main Component ---

export default function AnalyticsDashboard({ incidents = [], stats = {} }) {
  // ประมวลผลข้อมูลสถิติโดยใช้ useMemo เพื่อลดการคำนวณซ้ำ
  const typeStats = useMemo(() => countByType(incidents), [incidents]);
  const statusStats = useMemo(() => countByStatus(incidents), [incidents]);

  const maxTypeCount = useMemo(() =>
    typeStats.length > 0 ? Math.max(...typeStats.map((item) => item.count)) : 1
  , [typeStats]);

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar bg-slate-50">
      {/* 4 กล่องสถิติหลักด้านบน */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="เคสทั้งหมดในระบบ" value={stats.total || 0} />
        <StatCard title="เคสแจ้งวันนี้" value={stats.today || 0} />
        <StatCard title="กำลังดำเนินการ" value={stats.active || 0} />
        <StatCard title="เวลาตอบสนองเฉลี่ย" value={`${stats.avgResponseTime || 0} นาที`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ส่วนแสดงสถิติตามประเภท (Bar Chart Style) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            📊 สถิติตามประเภทเหตุ
          </h2>
          {typeStats.length === 0 ? (
            <p className="text-slate-400 text-center py-10 font-medium">ยังไม่มีข้อมูลเหตุฉุกเฉิน</p>
          ) : (
            <div className="space-y-5">
              {typeStats.map((item) => (
                <TypeProgressBar
                  key={item.type}
                  label={item.label}
                  count={item.count}
                  percentage={(item.count / maxTypeCount) * 100}
                />
              ))}
            </div>
          )}
        </div>

        {/* ส่วนแสดงสถิติตามสถานะการดำเนินงาน */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            📈 สถิติตามสถานะ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatusBox label="รอดำเนินการ" value={statusStats.pending || 0} color="bg-red-50 text-red-600" />
            <StatusBox label="รับเคสแล้ว" value={statusStats.accepted || 0} color="bg-amber-50 text-amber-600" />
            <StatusBox label="กำลังเดินทาง" value={statusStats.en_route || 0} color="bg-blue-50 text-blue-600" />
            <StatusBox label="ถึงจุดเกิดเหตุ" value={statusStats.arrived || 0} color="bg-purple-50 text-purple-600" />
            <StatusBox label="เสร็จสิ้น" value={statusStats.completed || 0} color="bg-emerald-50 text-emerald-600" />
            <StatusBox label="ยกเลิกเคส" value={statusStats.cancelled || 0} color="bg-zinc-100 text-zinc-600" />
          </div>
        </div>
      </div>
    </div>
  );
}