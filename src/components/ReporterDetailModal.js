import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { formatIdCardNumber } from "../utils/idcardAdmin";
import { requestIdCardOtp, decryptIdCardWithOtp } from "../utils/idcardApi";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300; // OTP หมดอายุใน 5 นาที
const RESEND_COOLDOWN_SECONDS = 60; // ขอ OTP ใหม่ได้ทุก 60 วินาที

function formatBirthDateAndAge(isoOrDate) {
  if (!isoOrDate) return "-";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);

  const dateText = d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mDiff = now.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${dateText} (อายุ ${age} ปี)` : dateText;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReporterDetailModal({
  isOpen,
  onClose,
  reporterUid,
  fallbackReporter,
  incidentId,
  role,
}) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // สถานะสำหรับ Admin ถอดรหัสเลขบัตรประชาชนด้วย OTP
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [revealedIdCard, setRevealedIdCard] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // นับเวลา OTP: อายุของรหัส และเวลารอก่อนขอรหัสใหม่
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRefs = useRef([]);

  // โหลดข้อมูลทั่วไปของผู้แจ้งเหตุจาก users/{uid}
  useEffect(() => {
    if (!isOpen) return;

    setRevealedIdCard(null);
    setSecondsLeft(0);
    setDecryptError("");
    setShowOtpForm(false);
    setOtp("");
    setOtpSentTo("");
    setOtpExpiresIn(0);
    setResendIn(0);

    if (!reporterUid) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);
    setProfileError("");

    getDoc(doc(db, "users", reporterUid))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        } else {
          setProfile(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Load reporter profile error:", err);
        setProfileError("ไม่สามารถดึงข้อมูลโปรไฟล์เพิ่มเติมจากฐานข้อมูลได้");
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reporterUid]);

  // นับถอยหลัง 30 วินาทีเพื่อซ่อนเลขบัตรประชาชนที่ถอดรหัสแล้วอัตโนมัติ
  useEffect(() => {
    if (!revealedIdCard || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRevealedIdCard(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [revealedIdCard, secondsLeft]);

  // นับถอยหลังอายุ OTP และเวลารอขอรหัสใหม่ (ทำงานตอนฟอร์ม OTP เปิดอยู่)
  useEffect(() => {
    if (!showOtpForm) return;

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [showOtpForm]);

  // โฟกัสช่องแรกเมื่อฟอร์ม OTP เปิดขึ้น
  useEffect(() => {
    if (showOtpForm) {
      inputRefs.current[0]?.focus();
    }
  }, [showOtpForm]);

  if (!isOpen) return null;

  // กด "ดูเลขเต็ม" หรือ "ขอรหัสใหม่" -> ขอ OTP จาก backend (ส่งไปอีเมล Admin)
  const handleClickReveal = async () => {
    setDecryptError("");
    setBusy(true);
    try {
      const result = await requestIdCardOtp(reporterUid);
      setOtpSentTo(result.sentTo || "");
      setOtp("");
      setOtpExpiresIn(OTP_TTL_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setShowOtpForm(true);
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } catch (err) {
      setDecryptError(err.message || "ส่ง OTP ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // กรอก OTP แล้วกดยืนยัน -> backend ถอดรหัสให้ แล้วเราแสดงผล 30 วินาที
  const handleConfirmOtp = async (e) => {
    e.preventDefault();
    setDecryptError("");

    if (otpExpiresIn <= 0) {
      setDecryptError("รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่");
      return;
    }

    if (otp.length !== OTP_LENGTH) {
      setDecryptError(`กรุณากรอกรหัส OTP ให้ครบ ${OTP_LENGTH} หลัก`);
      setShakeKey((k) => k + 1);
      return;
    }

    setBusy(true);
    try {
      const result = await decryptIdCardWithOtp(reporterUid, incidentId, otp);
      setRevealedIdCard(formatIdCardNumber(result.idcard));
      setSecondsLeft(30);
      setShowOtpForm(false);
      setOtp("");
    } catch (err) {
      setDecryptError(err.message || "ถอดรหัสไม่สำเร็จ");
      setShakeKey((k) => k + 1);
      setOtp("");
      setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  // ---- ตัวช่วยสำหรับช่องกรอก OTP แบบแยกหลัก ----
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    const chars = otp.padEnd(OTP_LENGTH, " ").split("");
    chars[index] = digit;
    setOtp(chars.join("").replace(/ /g, ""));
    if (decryptError) setDecryptError("");
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (otp[index]) {
        setOtp(otp.slice(0, index) + otp.slice(index + 1));
      } else if (index > 0) {
        setOtp(otp.slice(0, index - 1) + otp.slice(index));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    setOtp(pasted);
    if (decryptError) setDecryptError("");
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const otpExpired = otpExpiresIn <= 0;
  const otpProgress = Math.max(0, (otpExpiresIn / OTP_TTL_SECONDS) * 100);
  const otpUrgent = !otpExpired && otpExpiresIn <= 60;

  const fullName =
    [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") ||
    fallbackReporter?.name ||
    "ไม่ระบุชื่อ";
  const phone = profile?.phone || fallbackReporter?.phone || "-";
  const email = profile?.email || "-";
  const gender = profile?.gender || "-";
  const birthDateDisplay = formatBirthDateAndAge(profile?.birthDate);
  const maskedIdCard = profile?.idcardMasked || "ไม่พบข้อมูลเลขบัตร";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes otp-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .otp-shake { animation: otp-shake 0.35s ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .otp-shake { animation: none; }
        }
      `}</style>

      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="font-bold text-base">ข้อมูลผู้แจ้งเหตุฉุกเฉิน</h3>
              <p className="text-[11px] text-slate-400">
                ข้อมูลเวชระเบียนเบื้องต้นและการยืนยันตัวตน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold px-2.5 py-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕ ปิด
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {loadingProfile ? (
            <div className="py-8 text-center text-slate-500 font-medium text-sm">
              กำลังดึงข้อมูลผู้แจ้งเหตุ...
            </div>
          ) : (
            <>
              {profileError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3.5 py-2.5 rounded-xl">
                  ⚠️ {profileError}
                </div>
              )}

              {/* ข้อมูลทั่วไป (Staff และ Admin เห็นได้ทั้งหมด) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    ชื่อ - นามสกุล
                  </p>
                  <p className="font-bold text-slate-800 mt-0.5">{fullName}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    เบอร์โทรศัพท์ติดต่อ
                  </p>
                  {phone !== "-" ? (
                    <a
                      href={`tel:${phone}`}
                      className="font-bold text-emerald-600 hover:underline mt-0.5 inline-block"
                    >
                      {phone}
                    </a>
                  ) : (
                    <p className="font-semibold text-slate-700 mt-0.5">-</p>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    เพศ
                  </p>
                  <p className="font-semibold text-slate-700 mt-0.5">{gender}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    วันเกิด / อายุ
                  </p>
                  <p className="font-semibold text-slate-700 mt-0.5">
                    {birthDateDisplay}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    อีเมล
                  </p>
                  <p className="font-semibold text-slate-700 mt-0.5">{email}</p>
                </div>
              </div>

              {/* ส่วนเลขบัตรประชาชน (แสดงแบบ Mask เป็นค่าเริ่มต้น) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">
                      เลขประจำตัวประชาชน (PDPA Protected)
                    </p>
                    {revealedIdCard ? (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-lg font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg tracking-wider">
                          {revealedIdCard}
                        </span>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                          ซ่อนอัตโนมัติใน {secondsLeft} วินาที
                        </span>
                      </div>
                    ) : (
                      <p className="font-mono text-base font-bold text-slate-800 mt-1 tracking-wider">
                        {maskedIdCard}
                      </p>
                    )}
                  </div>

                  {/* ปุ่มสำหรับ Admin เท่านั้นในการถอดรหัสดูเลขบัตรเต็ม */}
                  {role === "admin" && reporterUid && (
                    <div className="flex items-center gap-2">
                      {!revealedIdCard ? (
                        <button
                          type="button"
                          onClick={handleClickReveal}
                          disabled={busy || showOtpForm}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition"
                        >
                          {busy && !showOtpForm ? "กำลังส่ง OTP..." : "ดูเลขเต็ม (Admin)"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setRevealedIdCard(null); setSecondsLeft(0); }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition"
                        >
                          ซ่อนเลขบัตร
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {role !== "admin" && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    * เจ้าหน้าที่ (Staff) สามารถดูข้อมูลทั่วไปและเลขบัตรแบบย่อได้ หากต้องการดูเลขบัตรเต็มต้องใช้สิทธิ์ Admin พร้อมไฟล์คีย์ถอดรหัส
                  </p>
                )}

                {/* ข้อผิดพลาดตอนขอ OTP (ก่อนเปิดฟอร์ม) */}
                {decryptError && !showOtpForm && (
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-2 rounded-lg"
                  >
                    ❌ {decryptError}
                  </div>
                )}

                {/* ===== ฟอร์มยืนยัน OTP (ดีไซน์ใหม่) ===== */}
                {role === "admin" && showOtpForm && !revealedIdCard && (
                  <form
                    onSubmit={handleConfirmOtp}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* แถบเวลาที่เหลือของ OTP */}
                    <div className="h-1 bg-slate-100">
                      <div
                        className={`h-full transition-all duration-1000 ease-linear ${
                          otpExpired
                            ? "bg-slate-300"
                            : otpUrgent
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${otpProgress}%` }}
                      />
                    </div>

                    <div className="p-5 space-y-5">
                      {/* หัวข้อ */}
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5"
                            aria-hidden="true"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800">
                            ยืนยันตัวตนก่อนดูเลขบัตรประชาชนแบบเต็ม
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            เราส่งรหัส {OTP_LENGTH} หลักไปที่{" "}
                            <span className="font-bold text-slate-700 break-all">
                              {otpSentTo || "อีเมลของคุณ"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* ช่องกรอก OTP แยกหลัก */}
                      <div>
                        <div
                          key={shakeKey}
                          className={`flex justify-center gap-2 sm:gap-2.5 ${
                            shakeKey > 0 && decryptError ? "otp-shake" : ""
                          }`}
                          onPaste={handleOtpPaste}
                        >
                          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                            <input
                              key={i}
                              ref={(el) => (inputRefs.current[i] = el)}
                              type="text"
                              inputMode="numeric"
                              autoComplete={i === 0 ? "one-time-code" : "off"}
                              maxLength={1}
                              value={otp[i] || ""}
                              disabled={busy || otpExpired}
                              onChange={(e) => handleOtpChange(i, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(i, e)}
                              onFocus={(e) => e.target.select()}
                              aria-label={`หลักที่ ${i + 1} ของรหัส OTP`}
                              className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 bg-slate-50 text-slate-800 transition focus:outline-none focus:bg-white disabled:opacity-40 disabled:cursor-not-allowed ${
                                decryptError
                                  ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                                  : otp[i]
                                  ? "border-emerald-400 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
                                  : "border-slate-200 focus:border-slate-800 focus:ring-4 focus:ring-slate-800/10"
                              }`}
                            />
                          ))}
                        </div>

                        {/* สถานะใต้ช่องกรอก */}
                        <div className="mt-3 min-h-[1.25rem] text-center text-xs font-semibold">
                          {decryptError ? (
                            <p role="alert" className="text-red-600">
                              {decryptError}
                            </p>
                          ) : otpExpired ? (
                            <p className="text-slate-500">
                              รหัสหมดอายุแล้ว กดขอรหัสใหม่เพื่อดำเนินการต่อ
                            </p>
                          ) : (
                            <p
                              className={
                                otpUrgent ? "text-amber-600" : "text-slate-500"
                              }
                            >
                              รหัสหมดอายุใน{" "}
                              <span className="font-mono font-bold">
                                {formatClock(otpExpiresIn)}
                              </span>{" "}
                              นาที
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ปุ่มยืนยัน */}
                      <button
                        type="submit"
                        disabled={busy || otpExpired || otp.length !== OTP_LENGTH}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold shadow-sm transition"
                      >
                        {busy ? "กำลังตรวจสอบ..." : "ยืนยันและดูเลขบัตร"}
                      </button>

                      {/* ลิงก์รอง: ยกเลิก / ขอรหัสใหม่ */}
                      <div className="flex items-center justify-between text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setShowOtpForm(false);
                            setDecryptError("");
                            setOtp("");
                          }}
                          className="text-slate-500 hover:text-slate-800 px-1 py-1 rounded transition"
                        >
                          ยกเลิก
                        </button>

                        <button
                          type="button"
                          onClick={handleClickReveal}
                          disabled={busy || resendIn > 0}
                          className="text-red-600 hover:text-red-700 disabled:text-slate-400 disabled:cursor-not-allowed px-1 py-1 rounded transition"
                        >
                          {resendIn > 0
                            ? `ขอรหัสใหม่ได้ใน ${resendIn} วินาที`
                            : "ขอรหัสใหม่"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 