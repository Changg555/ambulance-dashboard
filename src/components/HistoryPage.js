import React, { useState } from "react";

const TYPE_LABELS = {
  vehicle_accident: "อุบัติเหตุรถ",
  cardiac: "หัวใจ/หมดสติ",
  injury: "บาดเจ็บ/ล้มหกล้ม",
  fire: "ไฟไหม้",
  other: "อื่น ๆ",
};

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  accepted: "รับเคสแล้ว",
  en_route: "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกเคส",
};

function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "pending";
}

function formatDate(time) {
  if (!time) return "-";

  return new Date(time).toLocaleString("th-TH");
}

function getDuration(start, end) {
  if (!start || !end) return "-";

  const minutes = Math.round((end - start) / 60000);

  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;

  return `${hours} ชม. ${remainMinutes} นาที`;
}

function HistoryImages({ item, onPreview }) {
  const imageList =
    item.images || (item.image ? [item.image] : []);

  if (!imageList || imageList.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex gap-2 flex-wrap">
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
  );
}

export default function HistoryPage({
  incidents = [],
  onRestore,
  onDelete,
  role,
}) {
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [previewImage, setPreviewImage] =
    useState(null);

  const filtered = incidents.filter((item) => {
    const status = normalizeStatus(item.status);

    const text = `
      ${item.caseNumber || ""}
      ${item.id || ""}
      ${item.type || ""}
      ${item.description || ""}
      ${item.location?.address || ""}
    `.toLowerCase();

    const matchSearch = text.includes(
      search.toLowerCase()
    );

    const matchStatus =
      statusFilter === "all" ||
      status === statusFilter;

    return matchSearch && matchStatus;
  });

  const canDelete = role === "admin";

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              ประวัติย้อนหลัง
            </h2>

            <p className="text-sm text-gray-500">
              เคสที่เสร็จสิ้น ยกเลิก หรือถูกเก็บเข้าประวัติ
            </p>
          </div>

          <div className="flex gap-2">
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="ค้นหาเลขเคส / เหตุ / สถานที่"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >
              <option value="all">ทุกสถานะ</option>

              <option value="completed">
                เสร็จสิ้น
              </option>

              <option value="cancelled">
                ยกเลิกเคส
              </option>

              <option value="accepted">
                รับเคสแล้ว
              </option>

              <option value="en_route">
                กำลังเดินทาง
              </option>

              <option value="arrived">
                ถึงจุดเกิดเหตุ
              </option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            ยังไม่มีประวัติเคส
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const status = normalizeStatus(
                item.status
              );

              const isCancelled =
                status === "cancelled";

              const caseNumber =
                item.caseNumber || item.id;

              return (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800">
                          {TYPE_LABELS[item.type] ||
                            item.type ||
                            "ไม่ระบุประเภท"}
                        </h3>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isCancelled
                              ? "bg-gray-200 text-gray-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {STATUS_LABELS[status] ||
                            status}
                        </span>

                        {item.archived && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                            เก็บประวัติแล้ว
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        หมายเลขเหตุการณ์:{" "}
                        {caseNumber}
                      </p>

                      <p className="text-sm text-gray-600 mt-1">
                        {item.description ||
                          "ไม่มีรายละเอียด"}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        📍{" "}
                        {item.location?.address ||
                          "ไม่ทราบตำแหน่ง"}
                      </p>

                      <HistoryImages
                        item={item}
                        onPreview={setPreviewImage}
                      />
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      <p>
                        แจ้งเหตุ:{" "}
                        {formatDate(item.createdAt)}
                      </p>

                      <p>
                        เสร็จสิ้น:{" "}
                        {formatDate(
                          item.completedAt
                        )}
                      </p>

                      <p>
                        ยกเลิก:{" "}
                        {formatDate(
                          item.cancelledAt
                        )}
                      </p>

                      <p className="font-semibold text-red-700">
                        ใช้เวลา:{" "}
                        {getDuration(
                          item.createdAt,
                          item.completedAt ||
                            item.cancelledAt
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Timeline สถานะ
                    </p>

                    <div className="space-y-2">
                      {(item.timeline || []).map(
                        (log, index) => {
                          const logStatus =
                            normalizeStatus(
                              log.status
                            );

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-3 text-sm"
                            >
                              <div className="w-2 h-2 rounded-full bg-red-600" />

                              <span className="text-gray-700">
                                {STATUS_LABELS[
                                  logStatus
                                ] ||
                                  log.label ||
                                  logStatus}
                              </span>

                              <span className="text-xs text-gray-400">
                                {formatDate(
                                  log.time
                                )}
                              </span>
                            </div>
                          );
                        }
                      )}

                      {(!item.timeline ||
                        item.timeline.length ===
                          0) && (
                        <p className="text-xs text-gray-400">
                          ยังไม่มี timeline
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    {item.archived && (
                      <button
                        onClick={() =>
                          onRestore(item.id)
                        }
                        className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        นำกลับ
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => {
                          const ok =
                            window.confirm(
                              "ต้องการลบประวัติเคสนี้ถาวรใช่หรือไม่? ข้อมูลจะหายจาก Firebase"
                            );

                          if (ok)
                            onDelete(item.id);
                        }}
                        className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        ลบประวัติถาวร
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setPreviewImage(null)
              }
              className="absolute -top-10 right-0 text-white text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg"
            >
              ปิด
            </button>

            <img
              src={previewImage}
              alt="preview"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}