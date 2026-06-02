import React from "react";

const TYPE_LABELS = {
  vehicle_accident: "อุบัติเหตุรถ",
  cardiac: "หัวใจ/หมดสติ",
  injury: "บาดเจ็บ",
  fire: "ไฟไหม้",
  other: "อื่น ๆ",
};

function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "unknown";
}

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
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function countByStatus(incidents) {
  const result = {};

  incidents.forEach((item) => {
    const status = normalizeStatus(item.status);
    result[status] = (result[status] || 0) + 1;
  });

  return result;
}

export default function AnalyticsDashboard({ incidents = [], stats = {} }) {
  const typeStats = countByType(incidents);
  const statusStats = countByStatus(incidents);

  const maxTypeCount =
    typeStats.length > 0
      ? Math.max(...typeStats.map((item) => item.count))
      : 1;

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <StatCard title="เคสทั้งหมด" value={stats.total || 0} />
        <StatCard title="เคสวันนี้" value={stats.today || 0} />
        <StatCard title="กำลังดำเนินการ" value={stats.active || 0} />
        <StatCard
          title="เวลาเฉลี่ย"
          value={`${stats.avgResponseTime || 0} นาที`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            สถิติตามประเภทเหตุ
          </h2>

          {typeStats.length === 0 ? (
            <p className="text-gray-400 text-sm">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-3">
              {typeStats.map((item) => (
                <div key={item.type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="font-semibold">{item.count} เคส</span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-red-600"
                      style={{
                        width: `${(item.count / maxTypeCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            สถิติตามสถานะ
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <StatusBox
              label="รอดำเนินการ"
              value={statusStats.pending || 0}
              color="bg-yellow-100 text-yellow-700"
            />

            <StatusBox
              label="รับเคสแล้ว"
              value={statusStats.accepted || 0}
              color="bg-blue-100 text-blue-700"
            />

            <StatusBox
              label="กำลังเดินทาง"
              value={statusStats.en_route || 0}
              color="bg-purple-100 text-purple-700"
            />

            <StatusBox
              label="ถึงจุดเกิดเหตุ"
              value={statusStats.arrived || 0}
              color="bg-orange-100 text-orange-700"
            />

            <StatusBox
              label="เสร็จสิ้น"
              value={statusStats.completed || 0}
              color="bg-green-100 text-green-700"
            />

            <StatusBox
              label="เก็บประวัติ"
              value={stats.archived || 0}
              color="bg-gray-100 text-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

function StatusBox({ label, value, color }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}