import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import {
  decryptIdCard,
  formatIdCardNumber,
  unlockKey,
} from "../utils/idcardAdmin";

// เก็บ secretKey ไว้เฉพาะในตัวแปรหน่วยความจำของแท็บปัจจุบัน (ไม่ลง localStorage/sessionStorage เด็ดขาด)
// เมื่อรีเฟรชหน้าเว็บหรือกดปุ่มล็อกคีย์ ค่าจะถูกล้างเป็น null ทันที
let inMemorySecretKey = null;

export function clearAdminSecretKeyFromMemory() {
  if (inMemorySecretKey) {
    try {
      inMemorySecretKey.fill(0);
    } catch {}
    inMemorySecretKey = null;
  }
}

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

  // สถานะสำหรับ Admin ถอดรหัสเลขบัตรประชาชน
  const [hasUnlockedKey, setHasUnlockedKey] = useState(() => Boolean(inMemorySecretKey));
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [keyFile, setKeyFile] = useState(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [revealedIdCard, setRevealedIdCard] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // โหลดข้อมูลทั่วไปของผู้แจ้งเหตุจาก users/{uid}
  useEffect(() => {
    if (!isOpen) return;

    setRevealedIdCard(null);
    setSecondsLeft(0);
    setDecryptError("");
    setShowUnlockForm(false);
    setPassword("");
    setHasUnlockedKey(Boolean(inMemorySecretKey));

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

  if (!isOpen) return null;

  // ดึง users_private/{uid} มาถอดรหัสด้วย secretKey และบันทึก idcard_audit
  const decryptAndReveal = async (secretKeyToUse) => {
    if (!reporterUid) {
      setDecryptError("ไม่พบรหัสผู้ใช้ (UID) ของผู้แจ้งเหตุรายนี้");
      return;
    }

    const privateSnap = await getDoc(doc(db, "users_private", reporterUid));
    if (!privateSnap.exists() || !privateSnap.data()?.idcardSealed) {
      throw new Error("ไม่พบข้อมูลเลขบัตรที่เข้ารหัสไว้ใน users_private");
    }

    const plainIdCard = decryptIdCard(
      privateSnap.data().idcardSealed,
      secretKeyToUse
    );

    // บันทึก Audit Log ลงคอลเลกชัน idcard_audit
    try {
      await addDoc(collection(db, "idcard_audit"), {
        adminUid: auth.currentUser?.uid || null,
        adminEmail: auth.currentUser?.email || null,
        targetUid: reporterUid,
        incidentId: incidentId || null,
        at: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn("Could not write idcard_audit log:", auditErr);
    }

    setRevealedIdCard(formatIdCardNumber(plainIdCard));
    setSecondsLeft(30);
    setShowUnlockForm(false);
  };

  // เมื่อกดปุ่ม "ดูเลขเต็ม"
  const handleClickReveal = async () => {
    setDecryptError("");

    // ถ้ามี key ปลดล็อกอยู่ในหน่วยความจำแล้ว ให้ถอดรหัสทันที
    if (inMemorySecretKey) {
      setUnlocking(true);
      try {
        await decryptAndReveal(inMemorySecretKey);
      } catch (err) {
        setDecryptError(err.message || "ถอดรหัสเลขบัตรไม่สำเร็จ");
      } finally {
        setUnlocking(false);
      }
      return;
    }

    // ถ้ายังไม่มี key ในหน่วยความจำ ให้เปิดฟอร์มเลือกไฟล์ idcard-key.enc.json + รหัสผ่าน
    setShowUnlockForm(true);
  };

  // เมื่อกดปลดล็อกไฟล์ idcard-key.enc.json ด้วยรหัสผ่าน
  const handleUnlockAndDecrypt = async (e) => {
    e.preventDefault();
    setDecryptError("");

    if (!keyFile) {
      setDecryptError("กรุณาเลือกไฟล์ idcard-key.enc.json");
      return;
    }
    if (!password) {
      setDecryptError("กรุณากรอกรหัสผ่านสำหรับปลดล็อกคีย์");
      return;
    }

    setUnlocking(true);
    try {
      const fileText = await keyFile.text();
      const sk = await unlockKey(fileText, password);
      inMemorySecretKey = sk;
      setHasUnlockedKey(true);
      setPassword("");

      await decryptAndReveal(sk);
    } catch (err) {
      setDecryptError(err.message || "รหัสผ่านไม่ถูกต้อง หรือไฟล์คีย์เสียหาย");
    } finally {
      setUnlocking(false);
    }
  };

  // ล้างคีย์และซ่อนเลขบัตรออกจากหน่วยความจำทันที
  const handleLockKey = () => {
    clearAdminSecretKeyFromMemory();
    setHasUnlockedKey(false);
    setRevealedIdCard(null);
    setSecondsLeft(0);
    setShowUnlockForm(false);
    setPassword("");
    setKeyFile(null);
  };

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
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🪪</span>
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
                      📞 {phone}
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
                          ⏱ ซ่อนอัตโนมัติใน {secondsLeft} วินาที
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
                          disabled={unlocking}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition"
                        >
                          {unlocking ? "กำลังถอดรหัส..." : "🔓 ดูเลขเต็ม (Admin)"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRevealedIdCard(null);
                            setSecondsLeft(0);
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition"
                        >
                          🙈 ซ่อนเลขบัตร
                        </button>
                      )}

                      {hasUnlockedKey && (
                        <button
                          type="button"
                          onClick={handleLockKey}
                          title="ล้าง Private Key ออกจากหน่วยความจำ"
                          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                        >
                          🔒 ล็อกคีย์
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

                {decryptError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-2 rounded-lg">
                    ❌ {decryptError}
                  </div>
                )}

                {/* ฟอร์มเลือกไฟล์ idcard-key.enc.json และใส่รหัสผ่าน (แสดงเมื่อ Admin กดดูเลขเต็มครั้งแรกในเซสชัน) */}
                {role === "admin" && showUnlockForm && !revealedIdCard && (
                  <form
                    onSubmit={handleUnlockAndDecrypt}
                    className="mt-3 pt-3 border-t border-slate-200 space-y-3 bg-white p-4 rounded-xl border"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      🔑 ปลดล็อก Private Key ของแอดมิน (ทำครั้งแรกในเซสชัน)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      เลือกไฟล์ <code className="font-mono bg-slate-100 px-1 rounded">idcard-key.enc.json</code> และกรอกรหัสผ่านแอดมิน (คีย์จะถูกเก็บไว้ในหน่วยความจำชั่วคราวเท่านั้น ไม่บันทึกลงดิสก์)
                    </p>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        1. ไฟล์คีย์แอดมิน (idcard-key.enc.json)
                      </label>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => setKeyFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-600 hover:file:bg-red-100 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        2. รหัสผ่านปลดล็อกไฟล์คีย์ (Passphrase)
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านปลดล็อกคีย์ (เช่น Key-XXXX-XXXX-XXX)"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUnlockForm(false);
                          setDecryptError("");
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={unlocking}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition"
                      >
                        {unlocking
                          ? "กำลังปลดล็อกคีย์ (1-3 วินาที)..."
                          : "ปลดล็อกและดูเลขบัตร"}
                      </button>
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
