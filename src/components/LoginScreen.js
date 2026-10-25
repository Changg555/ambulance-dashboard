import React, { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, setRegisteringStaff } from "../config/firebase";

const OTP_DURATION_SECONDS = 5 * 60; // 5 นาที (300 วินาที)

const LOGIN_TEXT = {
  appName: "KPS Emergency",
  subtitle: "ระบบจัดการเหตุฉุกเฉินสำหรับเจ้าหน้าที่",
  emailLabel: "อีเมลเจ้าหน้าที่",
  emailPlaceholder: "staff@kps.ac.th",
  passwordLabel: "รหัสผ่าน",
  passwordPlaceholder: "กรอกรหัสผ่าน",
  submit: "เข้าสู่ระบบ",
  loading: "กำลังเข้าสู่ระบบ...",
  requiredError: "กรุณากรอกอีเมลและรหัสผ่าน",
  invalidCredentialError: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  unauthorizedRoleError: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบสำหรับเจ้าหน้าที่",
  pendingApprovalMessage: "บัญชีอยู่ระหว่างรอ Admin อนุมัติ",
};

const INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm";

const SUBMIT_BUTTON_CLASS =
  "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 mt-2";

// ฟังก์ชันส่งและยืนยัน OTP ผ่านคิว Firestore (เชื่อมต่อกับ ambulance_backend)
const requestOtpViaFirestore = (action, payload, defaultErrorMessage) => {
  return new Promise(async (resolve, reject) => {
    let unsub = null;
    let settled = false;
    let docRef = null;

    const cleanup = () => {
      if (unsub) {
        try {
          unsub();
        } catch (_) {}
        unsub = null;
      }
      if (docRef) {
        deleteDoc(docRef).catch(() => {});
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          "หมดเวลาในการเชื่อมต่อเซิร์ฟเวอร์ OTP กรุณาตรวจสอบว่าเปิดเซิร์ฟเวอร์ ambulance_backend แล้ว"
        )
      );
    }, 20000);

    try {
      docRef = await addDoc(collection(db, "otp_requests"), {
        action,
        ...payload,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      unsub = onSnapshot(
        docRef,
        (snap) => {
          if (settled || !snap.exists()) return;
          const data = snap.data();

          if (data.status === "completed") {
            settled = true;
            clearTimeout(timer);
            cleanup();
            resolve({ success: true, message: data.message || "" });
          } else if (data.status === "failed") {
            settled = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error(data.message || defaultErrorMessage));
          }
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          reject(new Error(error?.message || defaultErrorMessage));
        }
      );
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(error?.message || defaultErrorMessage));
    }
  });
};

function validateLoginForm(email, password) {
  if (!email || !password) return LOGIN_TEXT.requiredError;
  return "";
}

function LoginHeader({ subtitle }) {
  return (
    <div className="text-center mb-6">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <span className="text-4xl">🚑</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">{LOGIN_TEXT.appName}</h1>
      <p className="text-sm text-slate-500 mt-1 font-medium">
        {subtitle || LOGIN_TEXT.subtitle}
      </p>
    </div>
  );
}

function ErrorAlert({ message }) {
  if (!message) return null;

  return (
    <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl mb-5 flex items-center gap-2 border border-red-200">
      <span className="text-lg">⚠️</span> <span>{message}</span>
    </div>
  );
}

function SuccessAlert({ message }) {
  if (!message) return null;

  return (
    <div className="bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl mb-5 flex items-center gap-2 border border-emerald-200">
      <span className="text-lg">✅</span> <span>{message}</span>
    </div>
  );
}

function FormInput({ label, type = "text", placeholder, value, onChange, maxLength }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        maxLength={maxLength}
        className={INPUT_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default function LoginScreen() {
  // 'login' | 'register'
  const [mode, setMode] = useState("login");

  // สถานะฟอร์มเข้าสู่ระบบ
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  // สถานะฟอร์มสมัครสมาชิกเจ้าหน้าที่ (Step 1: ข้อมูล, Step 2: ยืนยัน OTP)
  const [regStep, setRegStep] = useState(1);
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // สถานะ OTP 6 หลัก
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef([]);

  // นับถอยหลังเวลา OTP 5 นาที
  useEffect(() => {
    if (mode !== "register" || regStep !== 2 || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, regStep, countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const switchMode = (targetMode) => {
    setMode(targetMode);
    setRegStep(1);
    setErrorText("");
    setSuccessText("");
  };

  // ================= 1. เข้าสู่ระบบสำหรับเจ้าหน้าที่ =================
  const handleLogin = async (event) => {
    event.preventDefault();

    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    setLoading(true);
    setErrorText("");
    setSuccessText("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const loggedInUser = credential.user;

      const userSnap = await getDoc(doc(db, "users", loggedInUser.uid));
      const userData = userSnap.exists() ? userSnap.data() : null;
      const userRole = userData?.role;

      if (userRole !== "admin" && userRole !== "staff") {
        await signOut(auth);
        setErrorText(LOGIN_TEXT.unauthorizedRoleError);
        return;
      }

      const isApproved =
        userRole === "admin"
          ? userData?.active !== false
          : userData?.active === true;

      if (!isApproved) {
        await signOut(auth);
        setErrorText(LOGIN_TEXT.pendingApprovalMessage);
        return;
      }
    } catch (error) {
      console.error("Login Error:", error);
      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-email"
      ) {
        setErrorText(LOGIN_TEXT.invalidCredentialError);
      } else {
        setErrorText(error?.message || LOGIN_TEXT.invalidCredentialError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ================= 2. สมัครสมาชิกสำหรับเจ้าหน้าที่ =================
  const validateRegisterForm = () => {
    const cleanFirst = firstname.trim();
    const cleanLast = lastname.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanFirst) return "กรุณากรอกชื่อ";
    if (!cleanLast) return "กรุณากรอกนามสกุล";
    if (!/^0[689]\d{8}$/.test(cleanPhone)) {
      return "กรุณากรอกเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง (0xxxxxxxxx)";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return "รูปแบบอีเมลไม่ถูกต้อง";
    }
    if (
      regPassword.length < 8 ||
      !/[A-Za-z]/.test(regPassword) ||
      !/\d/.test(regPassword)
    ) {
      return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลข";
    }
    if (regPassword !== regConfirmPassword) {
      return "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน";
    }
    return "";
  };

  // ขั้นตอนที่ 1: ขอรับรหัส OTP ทางอีเมล
  const handleRequestStaffOtp = async (event) => {
    event.preventDefault();
    if (loading) return;

    const validationError = validateRegisterForm();
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    try {
      await requestOtpViaFirestore(
        "send-otp",
        { email: cleanEmail },
        "ไม่สามารถส่งรหัส OTP ได้ในขณะนี้"
      );
      setOtpDigits(["", "", "", "", "", ""]);
      setCountdown(OTP_DURATION_SECONDS);
      setRegStep(2);
    } catch (error) {
      setErrorText(error.message || "ไม่สามารถส่งรหัส OTP ได้");
    } finally {
      setLoading(false);
    }
  };

  // ขอรับรหัส OTP ใหม่
  const handleResendStaffOtp = async () => {
    if (loading || countdown > 0) return;

    const cleanEmail = regEmail.trim().toLowerCase();
    setLoading(true);
    setErrorText("");

    try {
      await requestOtpViaFirestore(
        "send-otp",
        { email: cleanEmail },
        "ไม่สามารถส่งรหัส OTP ใหม่ได้"
      );
      setOtpDigits(["", "", "", "", "", ""]);
      setCountdown(OTP_DURATION_SECONDS);
      setSuccessText(`ส่งรหัส OTP ใหม่ไปยัง ${cleanEmail} เรียบร้อยแล้ว`);
    } catch (error) {
      setErrorText(error.message || "ไม่สามารถส่งรหัส OTP ใหม่ได้");
    } finally {
      setLoading(false);
    }
  };

  // จัดการการพิมพ์ตัวเลข OTP 6 ช่อง
  const handleOtpDigitChange = (value, index) => {
    const numeric = value.replace(/[^0-9]/g, "");
    setErrorText("");

    if (numeric.length > 1) {
      const chars = numeric.slice(0, 6).split("");
      const next = [...otpDigits];
      chars.forEach((c, i) => {
        if (index + i < 6) next[index + i] = c;
      });
      setOtpDigits(next);
      const nextFocus = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = numeric;
    setOtpDigits(next);

    if (numeric && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData("text") || "")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, idx) => {
      next[idx] = c;
    });
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // ขั้นตอนที่ 2: ยืนยัน OTP -> สร้างบัญชี Firebase Auth -> บันทึกลง Firestore (role: 'staff', active: false, status: 'pending')
  const handleVerifyAndRegisterStaff = async (event) => {
    event.preventDefault();
    if (loading) return;

    const otpCode = otpDigits.join("");
    if (otpCode.length !== 6) {
      setErrorText("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    const cleanFirst = firstname.trim();
    const cleanLast = lastname.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    setLoading(true);
    setErrorText("");
    setSuccessText("");
    setRegisteringStaff(true);

    let createdUser = null;

    try {
      // 1. ตรวจสอบรหัส OTP
      await requestOtpViaFirestore(
        "verify-otp",
        { email: cleanEmail, otp: otpCode },
        "รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว"
      );

      // 2. สร้างบัญชีใน Firebase Auth
      const userCred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        regPassword
      );
      createdUser = userCred.user;

      // 3. บันทึกข้อมูลเจ้าหน้าที่ลง Firestore collection 'users' โดยตั้งค่า active: false, status: 'pending'
      await setDoc(doc(db, "users", createdUser.uid), {
        firstname: cleanFirst,
        lastname: cleanLast,
        phone: cleanPhone,
        email: cleanEmail,
        role: "staff",
        active: false,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. ออกจากระบบทันทีเพื่อรอให้ Admin อนุมัติสิทธิ์ก่อน
      await signOut(auth);

      // รีเซ็ตฟอร์มและกลับไปหน้า Login พร้อมข้อความแจ้งเตือนสำเร็จ
      setFirstname("");
      setLastname("");
      setPhone("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirmPassword("");
      setOtpDigits(["", "", "", "", "", ""]);
      setRegStep(1);
      setMode("login");
      setEmail(cleanEmail);
      setPassword("");
      setSuccessText(
        "สมัครสมาชิกเจ้าหน้าที่สำเร็จ! บัญชีของคุณอยู่ระหว่างรอ Admin อนุมัติสิทธิ์การเข้าใช้งาน"
      );
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (_) {}
      }
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } catch (_) {}

      if (error?.code === "auth/email-already-in-use") {
        setRegStep(1);
        setErrorText("อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ");
      } else if (error?.code === "auth/invalid-email") {
        setRegStep(1);
        setErrorText("รูปแบบอีเมลไม่ถูกต้อง");
      } else if (error?.code === "auth/weak-password") {
        setRegStep(1);
        setErrorText("รหัสผ่านคาดเดาง่ายเกินไป กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร");
      } else {
        setErrorText(error?.message || "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setRegisteringStaff(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8 font-sans">
      <div className="bg-white w-full max-w-md rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
        <LoginHeader
          subtitle={
            mode === "login"
              ? LOGIN_TEXT.subtitle
              : "ลงทะเบียนขอสิทธิ์เข้าใช้งานสำหรับเจ้าหน้าที่ (Staff)"
          }
        />

        {/* ปุ่มสลับโหมด เข้าสู่ระบบ / สมัครสมาชิกเจ้าหน้าที่ */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "login"
                ? "bg-white text-red-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === "register"
                ? "bg-white text-red-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            สมัครสมาชิกเจ้าหน้าที่
          </button>
        </div>

        <SuccessAlert message={successText} />
        <ErrorAlert message={errorText} />

        {mode === "login" ? (
          /* ================= ฟอร์มเข้าสู่ระบบ ================= */
          <form onSubmit={handleLogin} className="space-y-4">
            <FormInput
              label={LOGIN_TEXT.emailLabel}
              type="email"
              placeholder={LOGIN_TEXT.emailPlaceholder}
              value={email}
              onChange={setEmail}
            />

            <FormInput
              label={LOGIN_TEXT.passwordLabel}
              type="password"
              placeholder={LOGIN_TEXT.passwordPlaceholder}
              value={password}
              onChange={setPassword}
            />

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASS}
            >
              {loading ? LOGIN_TEXT.loading : LOGIN_TEXT.submit}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">
                ยังไม่มีบัญชีสำหรับเจ้าหน้าที่?{" "}
              </span>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                สมัครสมาชิกเจ้าหน้าที่
              </button>
            </div>
          </form>
        ) : regStep === 1 ? (
          /* ================= ฟอร์มสมัครสมาชิกเจ้าหน้าที่ (ขั้นที่ 1: กรอกข้อมูล) ================= */
          <form onSubmit={handleRequestStaffOtp} className="space-y-3.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mb-1">
              ขั้นตอนที่ 1/2: กรอกข้อมูลเจ้าหน้าที่
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormInput
                label="ชื่อ"
                placeholder="ชื่อจริง"
                value={firstname}
                onChange={setFirstname}
              />
              <FormInput
                label="นามสกุล"
                placeholder="นามสกุล"
                value={lastname}
                onChange={setLastname}
              />
            </div>

            <FormInput
              label="เบอร์โทรศัพท์"
              type="tel"
              maxLength={10}
              placeholder="08xxxxxxxx"
              value={phone}
              onChange={(val) => setPhone(val.replace(/[^0-9]/g, ""))}
            />

            <FormInput
              label="อีเมลเจ้าหน้าที่"
              type="email"
              placeholder="staff@kps.ac.th"
              value={regEmail}
              onChange={setRegEmail}
            />

            <FormInput
              label="รหัสผ่าน"
              type="password"
              placeholder="ตั้งรหัสผ่าน"
              value={regPassword}
              onChange={setRegPassword}
            />

            <FormInput
              label="ยืนยันรหัสผ่าน"
              type="password"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={regConfirmPassword}
              onChange={setRegConfirmPassword}
            />

            <div className="text-xs text-slate-600">
              หลังยืนยันรหัส OTP และสมัครสมาชิกแล้ว บัญชีจะมีสถานะ{" "}
              <strong>รออนุมัติ </strong> จนกว่า Admin จะอนุมัติสิทธิ์
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASS}
            >
              {loading ? "กำลังส่งรหัส OTP..." : "ขอรับรหัส OTP ทางอีเมล"}
            </button>
          </form>
        ) : (
          /* ================= ฟอร์มสมัครสมาชิกเจ้าหน้าที่ (ขั้นที่ 2: ยืนยันรหัส OTP 6 หลัก) ================= */
          <form onSubmit={handleVerifyAndRegisterStaff} className="space-y-4">
            <div className="text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                ขั้นตอนที่ 2/2: ยืนยันรหัส OTP
              </div>
              <p className="text-sm text-slate-600">
                ระบบได้ส่งรหัสยืนยันตัวตน 6 หลักไปที่อีเมล
              </p>
              <p className="text-sm font-bold text-red-600 mt-0.5">
                {regEmail.trim().toLowerCase()}
              </p>
            </div>

            {/* ช่องกรอกรหัส OTP 6 ช่อง */}
            <div
              className="flex justify-between gap-2 my-4"
              onPaste={handleOtpPaste}
            >
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={idx === 0 ? 6 : 1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 focus:outline-none transition-all ${
                    digit
                      ? "border-red-500 bg-red-50/40 text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-red-500"
                  }`}
                />
              ))}
            </div>

            {/* ปุ่มขอรหัส OTP ใหม่พร้อมตัวนับเวลาถอยหลัง 5 นาที */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendStaffOtp}
                disabled={countdown > 0 || loading}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  countdown > 0
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                }`}
              >
                {countdown > 0
                  ? `ขอรหัส OTP ใหม่ได้ใน (${formatTime(countdown)})`
                  : "ส่งรหัส OTP อีกครั้ง (Resend OTP)"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={SUBMIT_BUTTON_CLASS}
            >
              {loading
                ? "กำลังตรวจสอบและสร้างบัญชี..."
                : "ยืนยันรหัส OTP และสมัครสมาชิก"}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorText("");
                setRegStep(1);
              }}
              disabled={loading}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              ← ย้อนกลับไปแก้ไขข้อมูล
            </button>
          </form>
        )}
      </div>
    </div>
  );
}