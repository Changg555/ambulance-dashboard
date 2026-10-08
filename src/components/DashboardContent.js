import React, { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";

import { auth } from "../config/firebase";
import { useIncidents } from "../hooks/useIncidents";

import IncidentMap from "./IncidentMap";
import IncidentCard from "./IncidentCard";
import StatsBar from "./StatsBar";
import AEDManager from "./AEDManager";
import HistoryPage from "./HistoryPage";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ServiceAreaManager from "./ServiceAreaManager";

// --- Sub-components สำหรับ UI ---

/**
 * ปุ่มสลับ Tab ใน Header
 */
const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
      active
        ? "bg-white text-red-600 shadow-sm scale-105"
        : "bg-transparent text-red-50 hover:bg-white/10"
    }`}
  >
    {children}
  </button>
);

/**
 * ส่วนหัวของ Dashboard (Header)
 */
const DashboardHeader = ({ user, role, tab, setTab }) => (
  <header className="bg-red-500 text-white px-6 py-4 flex items-center gap-4 shadow-md z-10 relative">
    {/* Logo & Title */}
    <div className="flex items-center gap-3 min-w-fit">
      <span className="text-2xl bg-white/20 p-1.5 rounded-lg">🚑</span>
      <div className="flex flex-col">
        <span className="text-lg font-bold leading-tight tracking-wide">KPS Emergency</span>
        <span className="text-xs font-medium text-red-100">ม.เกษตรฯ กำแพงแสน</span>
      </div>
    </div>

    {/* Navigation Tabs */}
    <div className="flex gap-2 ml-8 overflow-x-auto hide-scrollbar px-2 py-2">
      <TabButton active={tab === "incidents"} onClick={() => setTab("incidents")}>เหตุฉุกเฉิน</TabButton>
      <TabButton active={tab === "history"} onClick={() => setTab("history")}>ประวัติย้อนหลัง</TabButton>
      <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")}>สถิติ</TabButton>
      {role === "admin" && (
        <>
          <TabButton active={tab === "aed"} onClick={() => setTab("aed")}>จัดการ AED</TabButton>
          <TabButton active={tab === "service_area"} onClick={() => setTab("service_area")}>พื้นที่ให้บริการ</TabButton>
        </>
      )}
    </div>

    {/* User Info & Actions */}
    <div className="ml-auto flex items-center gap-4">
      <div className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-xl">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-xs font-semibold uppercase tracking-wider text-red-50">{role}</span>
      </div>

      <span className="text-sm font-medium text-red-50 hidden lg:block">{user.email}</span>

      <button
        onClick={() => signOut(auth)}
        className="text-sm font-semibold bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
      >
        ออกจากระบบ
      </button>
    </div>
  </header>
);

// --- Main Component ---

export default function DashboardContent({ user, role }) {
  // ดึงข้อมูลและฟังก์ชันการจัดการจาก Custom Hook
  const {
    incidents,
    activeIncidents,
    historyIncidents,
    loading,
    updateStatus,
    cancelIncident,
    archiveIncident,
    restoreIncident,
    deleteIncident,
    stats,
  } = useIncidents();

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("incidents");

  const lastPendingCount = useRef(0);

  // ระบบเสียงแจ้งเตือนเมื่อมีเหตุใหม่ (เฉพาะสถานะ pending)
  useEffect(() => {
    const pendingCount = activeIncidents.filter(i => i.status === "pending").length;

    // เล่นเสียงถ้าจำนวนเคส pending เพิ่มขึ้น
    if (lastPendingCount.current >= 0 && pendingCount > lastPendingCount.current) {
      new Audio("/alert.mp3").play().catch(() => {});
    }
    lastPendingCount.current = pendingCount;
  }, [activeIncidents]);

  // ป้องกัน User ทั่วไปเข้าถึง Tab ของ Admin
  useEffect(() => {
    if (role !== "admin" && (tab === "aed" || tab === "service_area")) {
      setTab("incidents");
    }
  }, [role, tab]);

  // Render เนื้อหาตาม Tab ที่เลือก
  const renderContent = () => {
    switch (tab) {
      case "incidents":
        return (
          <div className="flex flex-col flex-1 overflow-hidden">
            <StatsBar stats={stats} />
            <div className="flex flex-1 overflow-hidden gap-4 p-4">
              {/* รายการเหตุการณ์ด้านซ้าย */}
              <div className="w-[420px] flex flex-col gap-3 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                {loading && (
                  <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                    <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-3"></div>
                    <p className="font-medium">กำลังโหลดข้อมูล...</p>
                  </div>
                )}

                {!loading && activeIncidents.length === 0 && (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center">
                    <span className="text-4xl mb-3 opacity-50">🎉</span>
                    <h3 className="text-slate-700 font-bold mb-1">สถานการณ์ปกติ</h3>
                    <p className="text-sm text-slate-500">ไม่มีเหตุฉุกเฉินในขณะนี้</p>
                  </div>
                )}

                {activeIncidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    isSelected={selectedId === inc.id}
                    onClick={() => setSelectedId(inc.id)}
                    onUpdateStatus={updateStatus}
                    onArchive={archiveIncident}
                    onCancel={cancelIncident}
                    onDelete={deleteIncident}
                    role={role}
                  />
                ))}
              </div>

              {/* แผนที่ด้านขวา */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <IncidentMap
                  incidents={activeIncidents}
                  selectedId={selectedId}
                  onMarkerClick={setSelectedId}
                />
              </div>
            </div>
          </div>
        );

      case "history":
        return (
          <HistoryPage
            incidents={historyIncidents}
            onRestore={restoreIncident}
            onDelete={deleteIncident}
            role={role}
          />
        );

      case "analytics":
        return <AnalyticsDashboard incidents={incidents} stats={stats} />;

      case "aed":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <AEDManager />
          </div>
        );

      case "service_area":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <ServiceAreaManager />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      <DashboardHeader
        user={user}
        role={role}
        tab={tab}
        setTab={setTab}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
