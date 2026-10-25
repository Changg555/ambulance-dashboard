import React, { useEffect, useRef, useState } from "react";
import { toMillis } from "../hooks/useIncidents";

const TYPE_CONFIG = {
  sos: {
    label: "แจ้งเหตุด่วน (SOS)",
    subLabel: "ผู้ใช้กดปุ่ม SOS ฉุกเฉิน",
    lightBg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    badge: "bg-red-600 text-white",
  },
  car_accident: {
    label: "อุบัติเหตุทางถนน / รถชน",
    subLabel: "อุบัติเหตุยานพาหนะ",
    lightBg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    badge: "bg-blue-600 text-white",
  },
  cardiac: {
    label: "หัวใจวาย / หมดสติ",
    subLabel: "ระบบไหลเวียนโลหิต / ไม่ตอบสนอง",
    lightBg: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-700",
    badge: "bg-rose-600 text-white",
  },
  injury: {
    label: "บาดเจ็บจากอุบัติเหตุ",
    subLabel: "แผลภายนอก / กระดูกหัก",
    lightBg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    badge: "bg-amber-600 text-white",
  },
  fire: {
    label: "อัคคีภัย / ไฟไหม้",
    subLabel: "เหตุไฟไหม้ / ควันพิษ",
    lightBg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-700",
    badge: "bg-orange-600 text-white",
  },
  drowning: {
    label: "จมน้ำ / สำลักน้ำ",
    subLabel: "ภาวะขาดอากาศจากน้ำ",
    lightBg: "bg-cyan-50",
    border: "border-cyan-300",
    text: "text-cyan-700",
    badge: "bg-cyan-600 text-white",
  },
  other: {
    label: "เหตุฉุกเฉินอื่น ๆ",
    subLabel: "เหตุทั่วไปที่ต้องการความช่วยเหลือ",
    lightBg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700",
    badge: "bg-slate-600 text-white",
  },
};

const SEVERITY_CONFIG = {
  critical: {
    label: "วิกฤต (Critical)",
    levelText: "ระดับสีแดง — อันตรายถึงชีวิตทันที",
    icon: "🔴",
    badge: "bg-red-600 text-white shadow-red-500/50",
    cardBg: "bg-gradient-to-br from-red-50 via-rose-50 to-red-100/80",
    border: "border-red-400 ring-2 ring-red-400/30",
    textColor: "text-red-700",
    ping: true,
  },
  high: {
    label: "รุนแรง (High)",
    levelText: "ระดับสีส้ม — จำเป็นต้องช่วยเหลือเร่งด่วน",
    icon: "🟠",
    badge: "bg-orange-500 text-white shadow-orange-500/40",
    cardBg: "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100/70",
    border: "border-orange-400 ring-2 ring-orange-400/30",
    textColor: "text-orange-700",
    ping: false,
  },
  medium: {
    label: "ปานกลาง (Medium)",
    levelText: "ระดับสีเหลือง — ไม่คุกคามชีวิตทันที",
    icon: "🟡",
    badge: "bg-yellow-400 text-slate-900 font-extrabold shadow-yellow-400/40",
    cardBg: "bg-gradient-to-br from-yellow-50 to-amber-50",
    border: "border-yellow-400 ring-2 ring-yellow-400/30",
    textColor: "text-amber-800",
    ping: false,
  },
  low: {
    label: "ไม่รุนแรง (Low)",
    levelText: "ระดับสีเขียว — อาการคงที่ รู้สึกตัวดี",
    icon: "🟢",
    badge: "bg-emerald-600 text-white shadow-emerald-600/40",
    cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    border: "border-emerald-400 ring-2 ring-emerald-400/30",
    textColor: "text-emerald-700",
    ping: false,
  },
};

export default function EmergencyAlertModal({
  pendingIncidents = [],
  onAcknowledge,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef(null);

  // ควบคุมเสียงแจ้งเตือนแบบ Loop จนกว่าจะกดรับทราบเคส
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio("/alert.mp3");
      audio.loop = true;
      audioRef.current = audio;
    }

    const audio = audioRef.current;

    if (pendingIncidents.length > 0 && !isMuted) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAudioBlocked(false);
          })
          .catch(() => {
            // Browser Autoplay Policy อาจบล็อกเสียงหากผู้ใช้ยังไม่ได้คลิกบนหน้าเว็บ
            setAudioBlocked(true);
          });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [pendingIncidents.length, isMuted]);

  // ปรับ index กรณีเคสปัจจุบันถูกรับทราบไปแล้ว
  useEffect(() => {
    if (currentIndex >= pendingIncidents.length) {
      setCurrentIndex(Math.max(0, pendingIncidents.length - 1));
    }
  }, [pendingIncidents.length, currentIndex]);

  if (pendingIncidents.length === 0) {
    return null;
  }

  const currentIncident = pendingIncidents[currentIndex] || pendingIncidents[0];
  if (!currentIncident) return null;

  const typeCfg =
    TYPE_CONFIG[currentIncident.type] || TYPE_CONFIG.other;
  const sevCfg =
    SEVERITY_CONFIG[currentIncident.severity] || {
      label: currentIncident.severity || "ไม่ระบุ",
      levelText: "ไม่ได้ระบุระดับความรุนแรง",
      badge: "bg-slate-600 text-white",
      cardBg: "bg-slate-50",
      border: "border-slate-300",
      textColor: "text-slate-700",
      ping: false,
    };

  const isCritical = currentIncident.severity === "critical";

  const handleManualPlay = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setAudioBlocked(false);
          setIsMuted(false);
        })
        .catch(() => {});
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleAcknowledge = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (onAcknowledge) {
      onAcknowledge(currentIncident.id);
    }
  };

  const createdMs = toMillis(currentIncident.createdAt);
  const timeFormatted = createdMs
    ? new Date(createdMs).toLocaleTimeString("th-TH")
    : "-";

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border-4 ${
          isCritical
            ? "border-red-600 shadow-red-500/30"
            : "border-red-500 shadow-slate-900/30"
        } overflow-hidden my-auto transform transition-all`}
      >
        {/* แถบด้านบน: ไฟไซเรน & หัวข้อแจ้งเตือน */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white p-5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">🚨</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-wide uppercase">
                  มีเคสฉุกเฉินใหม่!
                </h2>
                <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-white/30 animate-pulse">
                  NEW ALERT
                </span>
              </div>
              <p className="text-xs text-red-100 font-medium">
                ตรวจพบการแจ้งเหตุใหม่ในระบบ
              </p>
            </div>
          </div>

          {/* ปุ่มควบคุมเสียง */}
          <div className="flex items-center gap-2">
            {audioBlocked ? (
              <button
                type="button"
                onClick={handleManualPlay}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 animate-pulse"
                title="คลิกเพื่อเปิดเสียงแจ้งเตือน"
              >
                <span>🔔</span> เปิดเสียง
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleMute}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                  isMuted
                    ? "bg-white/20 hover:bg-white/30 text-white border-white/40"
                    : "bg-black/20 hover:bg-black/30 text-white border-black/20"
                }`}
                title={isMuted ? "เปิดเสียงเตือน" : "ปิดเสียงเตือนชั่วคราว"}
              >
                <span>{isMuted ? "🔇" : "🔊"}</span>
                <span>{isMuted ? "เปิดเสียง" : "ปิดเสียง"}</span>
              </button>
            )}
          </div>
        </div>

        {/* กรณีมีหลายเคสที่รอรับเรื่อง */}
        {pendingIncidents.length > 1 && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <span>⚠️</span> มีเคสรอรับเรื่องทั้งหมด {pendingIncidents.length} เคส (กำลังแสดงเคสที่ {currentIndex + 1})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-2.5 py-1 bg-white rounded-lg border border-amber-300 disabled:opacity-40 hover:bg-amber-100 transition"
              >
                ◀ ก่อนหน้า
              </button>
              <button
                type="button"
                disabled={currentIndex === pendingIncidents.length - 1}
                onClick={() =>
                  setCurrentIndex((prev) =>
                    Math.min(pendingIncidents.length - 1, prev + 1)
                  )
                }
                className="px-2.5 py-1 bg-white rounded-lg border border-amber-300 disabled:opacity-40 hover:bg-amber-100 transition"
              >
                ถัดไป ▶
              </button>
            </div>
          </div>
        )}

        {/* รายละเอียดเคส */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* แถบเลขเคสและเวลาแจ้งเหตุ */}
          <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2 rounded-xl text-xs font-bold text-slate-600">
            <span className="font-mono text-slate-800">
              เลขเคส: {currentIncident.caseNumber}
            </span>
            <span>
              เวลาแจ้ง: <strong className="text-slate-800">{timeFormatted} น.</strong>
            </span>
          </div>

          {/* ========================================================= */}
          {/* ส่วนเน้นพิเศษ (Hero Cards): ประเภทเหตุฉุกเฉิน & ระดับความรุนแรง */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* การ์ดที่ 1: ประเภทเหตุฉุกเฉิน (เด่นชัด ขนาดใหญ่) */}
            <div
              className={`${typeCfg.lightBg} ${typeCfg.border} border-2 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-extrabold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                  ประเภทเหตุฉุกเฉิน
                </span>
              </div>
              <div>
                <h3 className={`text-xl font-black ${typeCfg.text} leading-tight`}>
                  {typeCfg.label}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {typeCfg.subLabel}
                </p>
              </div>
            </div>

            {/* การ์ดที่ 2: ระดับความรุนแรง (เด่นชัด มีไฟกระพริบเมื่อวิกฤต) */}
            <div
              className={`${sevCfg.cardBg} ${sevCfg.border} border-2 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-extrabold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                  ระดับความรุนแรง
                </span>
                <div className="flex items-center gap-1.5">
                  {sevCfg.ping && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm sm:text-base font-black px-3 py-1 rounded-xl shadow-md ${sevCfg.badge}`}
                  >
                    {sevCfg.label}
                  </span>
                </div>
                <p className={`text-xs font-bold ${sevCfg.textColor} mt-2`}>
                  {sevCfg.levelText}
                </p>
              </div>
            </div>
          </div>

          {/* รายละเอียดอาการ / เหตุการณ์ */}
          <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-4">
            <span className="text-xs font-bold text-red-800 block mb-1">
              📋 รายละเอียดอาการ / สิ่งที่เกิดขึ้น:
            </span>
            <p className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
              {currentIncident.description || "ไม่ได้ระบุรายละเอียดอาการ"}
            </p>
          </div>

          {/* ข้อมูลผู้แจ้งเหตุ */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">
                👤
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 block">
                  ผู้แจ้งเหตุ
                </span>
                <p className="text-sm font-bold text-slate-800">
                  {currentIncident.reporter?.name || "ไม่ระบุชื่อ"}
                </p>
              </div>
            </div>

            {currentIncident.reporter?.phone && (
              <a
                href={`tel:${currentIncident.reporter.phone}`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <span>📞</span> โทร: {currentIncident.reporter.phone}
              </a>
            )}
          </div>
        </div>

        {/* ปุ่มรับทราบเคส (ปุ่มหลักเด่นชัด) */}
        <div className="p-5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-700 hover:to-red-700 text-white font-black text-base shadow-lg shadow-red-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 animate-pulse"
          >
            <span className="text-xl">✅</span>
            <span>รับทราบเคส</span>
          </button>
        </div>
      </div>
    </div>
  );
}
