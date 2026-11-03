import { auth } from "../config/firebase";

const BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

// เรียก backend พร้อมแนบ Firebase token เพื่อพิสูจน์ว่าเป็น Admin
async function callApi(path, body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("ไม่พบการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");

  const res = await fetch(`${BASE_URL}/api/idcard/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
  }
  return data;
}

export const requestIdCardOtp = (targetUid) => callApi("request-otp", { targetUid });

export const decryptIdCardWithOtp = (targetUid, incidentId, otp) =>
  callApi("decrypt", { targetUid, incidentId, otp });