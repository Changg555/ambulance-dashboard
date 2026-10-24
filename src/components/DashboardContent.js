import React, { useEffect, useMemo, useState } from "react";
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
import UserManagement from "./UserManagement";
import EmergencyAlertModal from "./EmergencyAlertModal";

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
const DashboardHeader = ({ user, profile, role, tab, setTab }) => {
  const displayName =
    [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") ||
    profile?.name ||
    user.email;

  return (
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
            <TabButton active={tab === "users"} onClick={() => setTab("users")}>จัดการเจ้าหน้าที่</TabButton>
          </>
        )}
      </div>

      {/* User Info & Actions */}
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-xl">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-semibold uppercase tracking-wider text-red-50">{role}</span>
        </div>

        <span className="text-sm font-medium text-red-50 hidden lg:block">{displayName}</span>

        <button
          onClick={() => signOut(auth)}
          className="text-sm font-semibold bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
        >
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
};

const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// --- Main Component ---

export default function DashboardContent({ user, profile, role }) {
  // ดึงข้อมูลและฟังก์ชันการจัดการจาก Custom Hook
  const {
    incidents,
    activeIncidents,
    historyIncidents,
    loading,
    permissionError,
    updateStatus,
    cancelIncident,
    archiveIncident,
    restoreIncident,
    deleteIncident,
    stats,
  } = useIncidents({ user, profile });

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("incidents");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("severity_desc");

  const displayedActiveIncidents = useMemo(() => {
    const filtered = activeIncidents.filter((item) => {
      const matchSeverity =
        severityFilter === "all" || item.severity === severityFilter;

      const matchType =
        typeFilter === "all" || item.type === typeFilter;

      return matchSeverity && matchType;
    });

    return [...filtered].sort((a, b) => {
      const rankA = SEVERITY_RANK[a.severity] || 0;
      const rankB = SEVERITY_RANK[b.severity] || 0;
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;

      if (sortBy === "severity_desc") {
        if (rankB !== rankA) return rankB - rankA;
        return timeB - timeA;
      }
      if (sortBy === "severity_asc") {
        if (rankA !== rankB) return rankA - rankB;
        return timeB - timeA;
      }
      if (sortBy === "oldest") {
        return timeA - timeB;
      }
      return timeB - timeA;
    });
  }, [activeIncidents, severityFilter, typeFilter, sortBy]);

  // เก็บ ID เคสที่เจ้าหน้าที่กด "รับทราบเคส" แล้ว เพื่อปิดป๊อปอัปและหยุดเสียงเตือน
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => new Set());

  // รายการเคส pending ที่ยังไม่ได้รับทราบ เพื่อแสดงป๊อปอัปแจ้งเตือนพร้อมเสียงเตือน
  const unacknowledgedPendingIncidents = useMemo(
    () =>
      activeIncidents.filter(
        (i) => i.status === "pending" && !acknowledgedIds.has(i.id)
      ),
    [activeIncidents, acknowledgedIds]
  );

  const handleAcknowledgePendingIncident = (incidentId) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      next.add(incidentId);
      return next;
    });
    setSelectedId(incidentId);
    setTab("incidents");
  };

  // ป้องกัน User ทั่วไปเข้าถึง Tab ของ Admin
  useEffect(() => {
    if (role !== "admin" && (tab === "aed" || tab === "service_area" || tab === "users")) {
      setTab("incidents");
    }
  }, [role, tab]);

  // Render เนื้อหาตาม Tab ที่เลือก
  const renderContent = () => {
    switch (tab) {
      case "incidents":
        return (
          <div className="flex flex-col flex-1 overflow-hidden">
            {permissionError && (
              <div className="mx-4 mt-4 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-xs font-medium">
                ⚠️ <strong>Firestore Security Rules บล็อกการดึงเคสทั้งหมด ({permissionError})</strong>:{" "}
                กรุณาอัปเดต Rules ใน Firebase Console (โปรเจกต์ <code>kps-ambulance-5308f</code> &gt; Firestore Database &gt; Rules) ให้เจ้าหน้าที่ (<code>staff</code> / <code>admin</code>) มีสิทธิ์อ่านและแก้ไขคอลเลกชัน <code>incidents</code> ทั้งหมด
              </div>
            )}

            <StatsBar stats={stats} />
            <div className="flex flex-1 overflow-hidden gap-4 p-4">
              {/* รายการเหตุการณ์ด้านซ้าย */}
              <div className="w-[440px] flex flex-col gap-3 overflow-hidden">
                {/* แถบตัวกรองและเรียงลำดับเคสตามความรุนแรงและประเภทเหตุสำหรับเจ้าหน้าที่ */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      🚨 รายการเคสที่กำลังดำเนินการ ({displayedActiveIncidents.length})
                    </span>
                    {(severityFilter !== "all" || typeFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSeverityFilter("all");
                          setTypeFilter("all");
                        }}
                        className="text-[11px] font-bold text-red-500 hover:underline"
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        เรียงลำดับเคส
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      >
                        <option value="severity_desc">🔥 ความรุนแรง: วิกฤต → ไม่รุนแรง</option>
                        <option value="severity_asc">🟢 ความรุนแรง: ไม่รุนแรง → วิกฤต</option>
                        <option value="newest">🕒 เวลาแจ้ง: ล่าสุดก่อน</option>
                        <option value="oldest">⏳ เวลาแจ้ง: รอนานสุดก่อน</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          กรองประเภทของเหตุ
                        </label>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        >
                          <option value="all">ทุกประเภทเหตุ</option>
                          <option value="sos">🚨 แจ้งเหตุด่วน (SOS)</option>
                          <option value="car_accident">🚗 อุบัติเหตุรถ</option>
                          <option value="cardiac">❤️ หัวใจ/หมดสติ</option>
                          <option value="injury">🩹 บาดเจ็บ</option>
                          <option value="fire">🔥 ไฟไหม้</option>
                          <option value="drowning">🌊 จมน้ำ</option>
                          <option value="other">⚠️ เหตุอื่น ๆ</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          กรองระดับความรุนแรง
                        </label>
                        <select
                          value={severityFilter}
                          onChange={(e) => setSeverityFilter(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        >
                          <option value="all">ทุกระดับความรุนแรง</option>
                          <option value="critical">🔴 วิกฤต (Critical)</option>
                          <option value="high">🟠 รุนแรง (High)</option>
                          <option value="medium">🟡 ปานกลาง (Medium)</option>
                          <option value="low">🟢 ไม่รุนแรง (Low)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                  {loading && (
                    <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                      <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-3"></div>
                      <p className="font-medium">กำลังโหลดข้อมูล...</p>
                    </div>
                  )}

                  {!loading && displayedActiveIncidents.length === 0 && (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center">
                      <span className="text-4xl mb-3 opacity-50">🎉</span>
                      <h3 className="text-slate-700 font-bold mb-1">สถานการณ์ปกติ</h3>
                      <p className="text-sm text-slate-500">
                        {severityFilter === "all" && typeFilter === "all"
                          ? "ไม่มีเหตุฉุกเฉินในขณะนี้"
                          : "ไม่พบเคสที่ตรงกับตัวกรองที่เลือก"}
                      </p>
                    </div>
                  )}

                  {displayedActiveIncidents.map((inc) => (
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
              </div>

              {/* แผนที่ด้านขวา */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <IncidentMap
                  incidents={displayedActiveIncidents}
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

      case "users":
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <UserManagement currentUser={user} />
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
        profile={profile}
        role={role}
        tab={tab}
        setTab={setTab}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </main>

      {/* ป๊อปอัปแจ้งเตือนเหตุฉุกเฉินใหม่ พร้อมเสียงเตือนวนซ้ำจนกว่าจะกดรับทราบเคส */}
      <EmergencyAlertModal
        pendingIncidents={unacknowledgedPendingIncidents}
        onAcknowledge={handleAcknowledgePendingIncident}
      />
    </div>
  );
}
