import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";

// ข้อความหลักที่ใช้ในหน้า login แยกไว้ให้แก้ง่ายและไม่กระจายใน JSX
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
};

// class กลางของ input เพื่อไม่ต้องเขียนซ้ำทั้งช่อง email และ password
const INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all";

// class ของปุ่ม submit แยกไว้ให้ JSX อ่านง่ายขึ้น
const SUBMIT_BUTTON_CLASS =
  "w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 mt-2";

// ตรวจ input ก่อนยิง request ไป Firebase
function validateLoginForm(email, password) {
  if (!email || !password) return LOGIN_TEXT.requiredError;
  return "";
}

// ส่วนหัวของหน้า login แสดงโลโก้ ชื่อระบบ และคำอธิบายสั้น ๆ
function LoginHeader() {
  return (
    <div className="text-center mb-8">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">🚑</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">{LOGIN_TEXT.appName}</h1>
      <p className="text-sm text-slate-500 mt-1 font-medium">{LOGIN_TEXT.subtitle}</p>
    </div>
  );
}

// กล่องแจ้ง error จะแสดงเฉพาะตอนมีข้อความ error เท่านั้น
function ErrorAlert({ message }) {
  if (!message) return null;

  return (
    <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
      <span className="text-lg">⚠️</span> {message}
    </div>
  );
}

// field มาตรฐานของฟอร์ม login ใช้ซ้ำได้ทั้ง email/password
function LoginInput({ label, type, placeholder, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        className={INPUT_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

// ฟอร์ม login รับ state/handler จาก component หลัก แล้วดูแลเฉพาะ layout ของฟอร์ม
function LoginForm({ email, password, loading, onEmailChange, onPasswordChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <LoginInput
        label={LOGIN_TEXT.emailLabel}
        type="email"
        placeholder={LOGIN_TEXT.emailPlaceholder}
        value={email}
        onChange={onEmailChange}
      />

      <LoginInput
        label={LOGIN_TEXT.passwordLabel}
        type="password"
        placeholder={LOGIN_TEXT.passwordPlaceholder}
        value={password}
        onChange={onPasswordChange}
      />

      <button type="submit" disabled={loading} className={SUBMIT_BUTTON_CLASS}>
        {loading ? LOGIN_TEXT.loading : LOGIN_TEXT.submit}
      </button>
    </form>
  );
}

// component หลัก: เก็บ state ของฟอร์ม และเรียก Firebase Auth เมื่อ submit
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.log(error);
      setErrorText(LOGIN_TEXT.invalidCredentialError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
        <LoginHeader />
        <ErrorAlert message={errorText} />
        <LoginForm
          email={email}
          password={password}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
        />
      </div>
    </div>
  );
}
