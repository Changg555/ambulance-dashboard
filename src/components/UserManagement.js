import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export default function UserManagement({ currentUser }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filterMode, setFilterMode] = useState("pending"); // 'pending' | 'all'
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const allUsers = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // คัดกรองเฉพาะเจ้าหน้าที่ (staff / admin) หรือบัญชีที่ status == 'pending'
        const staffUsers = allUsers.filter(
          (u) =>
            u.role === "staff" ||
            u.role === "admin" ||
            u.status === "pending"
        );

        setStaffList(staffUsers);
        setErrorMsg("");
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setErrorMsg("ไม่สามารถดึงข้อมูลรายชื่อเจ้าหน้าที่ได้ กรุณาตรวจสอบสิทธิ์ Firestore Rules");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // ปุ่ม "อนุมัติ (Approve)" -> อัปเดต { active: true, status: 'approved' }
  const handleApprove = async (targetUser) => {
    if (updatingId) return;
    setUpdatingId(targetUser.id);
    try {
      const userRef = doc(db, "users", targetUser.id);
      await updateDoc(userRef, {
        active: true,
        status: "approved",
        role: targetUser.role === "admin" ? "admin" : "staff",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Approve Error:", error);
      alert("ไม่สามารถอนุมัติสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUpdatingId(null);
    }
  };

  // ปุ่ม "ระงับสิทธิ์ (Deactivate)" -> เปลี่ยน active เป็น false
  const handleDeactivate = async (targetUser) => {
    if (updatingId) return;
    if (targetUser.id === currentUser?.uid) {
      alert("ไม่สามารถระงับสิทธิ์บัญชีของตัวเองได้");
      return;
    }

    const confirmDeactivate = window.confirm(
      `ยืนยันการระงับสิทธิ์ของ ${targetUser.email || targetUser.firstname || "เจ้าหน้าที่"} หรือไม่?`
    );
    if (!confirmDeactivate) return;

    setUpdatingId(targetUser.id);
    try {
      const userRef = doc(db, "users", targetUser.id);
      await updateDoc(userRef, {
        active: false,
        status: "suspended",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Deactivate Error:", error);
      alert("ไม่สามารถระงับสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUpdatingId(null);
    }
  };

  // รายชื่อที่ status == 'pending' หรือ active == false
  const pendingOrInactiveUsers = staffList.filter(
    (u) =>
      u.status === "pending" ||
      u.active === false ||
      (u.role !== "admin" && u.active === undefined)
  );

  const displayedUsers =
    filterMode === "pending" ? pendingOrInactiveUsers : staffList;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            จัดการสิทธิ์เจ้าหน้าที่ (Admin User Management)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            อนุมัติหรือระงับสิทธิ์การเข้าใช้งานระบบ Dashboard สำหรับเจ้าหน้าที่ (Staff / Admin)
          </p>
        </div>

        <div className="flex bg-slate-200/70 p-1 rounded-xl self-start">
          <button
            onClick={() => setFilterMode("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterMode === "pending"
                ? "bg-white text-red-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            รออนุมัติ / ระงับสิทธิ์ ({pendingOrInactiveUsers.length})
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filterMode === "all"
                ? "bg-white text-red-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            เจ้าหน้าที่ทั้งหมด ({staffList.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            กำลังโหลดรายชื่อเจ้าหน้าที่...
          </div>
        ) : displayedUsers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-600 font-semibold">
              {filterMode === "pending"
                ? "ไม่มีรายการเจ้าหน้าที่ที่รออนุมัติหรือถูกระงับสิทธิ์"
                : "ไม่พบข้อมูลเจ้าหน้าที่ในระบบ"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="py-3.5 px-4 font-semibold">อีเมล / เบอร์โทร</th>
                  <th className="py-3.5 px-4 font-semibold">บทบาท (Role)</th>
                  <th className="py-3.5 px-4 font-semibold">สถานะ (Status)</th>
                  <th className="py-3.5 px-4 font-semibold text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedUsers.map((item) => {
                  const fullName =
                    [item.firstname, item.lastname].filter(Boolean).join(" ") ||
                    item.name ||
                    "ไม่ระบุชื่อ";
                  const isActive =
                    item.role === "admin"
                      ? item.active !== false
                      : item.active === true;
                  const isUpdating = updatingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        {fullName}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">
                          {item.email || "-"}
                        </div>
                        {item.phone && (
                          <div className="text-xs text-slate-500">{item.phone}</div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                            item.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.role || "staff"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            อนุมัติแล้ว ({item.status || "approved"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            {item.status === "pending"
                              ? "รออนุมัติ (pending)"
                              : "ระงับสิทธิ์ / ยังไม่อนุมัติ"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                        {/* ปุ่มอนุมัติ (Approve) */}
                        <button
                          onClick={() => handleApprove(item)}
                          disabled={isUpdating || isActive}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          อนุมัติ (Approve)
                        </button>

                        {/* ปุ่มระงับสิทธิ์ (Deactivate) */}
                        <button
                          onClick={() => handleDeactivate(item)}
                          disabled={
                            isUpdating ||
                            !isActive ||
                            item.id === currentUser?.uid
                          }
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ระงับสิทธิ์ (Deactivate)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
