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

export default function DashboardContent({ user, role }) {
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

  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("incidents");

  const lastPendingCount = useRef(0);

  useEffect(() => {
    const pendingCount = activeIncidents.filter(
      (i) => i.status === "pending"
    ).length;

    if (
      lastPendingCount.current > 0 &&
      pendingCount > lastPendingCount.current
    ) {
      const audio = new Audio("/alert.mp3");
      audio.play().catch(() => {});
    }

    lastPendingCount.current = pendingCount;
  }, [activeIncidents]);

  useEffect(() => {
    if (
      role !== "admin" &&
      (tab === "aed" || tab === "service_area")
    ) {
      setTab("incidents");
    }
  }, [role, tab]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-red-700 text-white px-6 py-3 flex items-center gap-4">
        <span className="text-xl font-bold">
          KPS Emergency Dashboard
        </span>

        <span className="text-sm opacity-75">
          ม.เกษตรฯ วิทยาเขตกำแพงแสน
        </span>

        <div className="flex gap-2 ml-4">
          <TabButton
            active={tab === "incidents"}
            onClick={() => setTab("incidents")}
          >
            เหตุฉุกเฉิน
          </TabButton>

          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
          >
            ประวัติย้อนหลัง
          </TabButton>

          <TabButton
            active={tab === "analytics"}
            onClick={() => setTab("analytics")}
          >
            สถิติ
          </TabButton>

          {role === "admin" && (
            <>
              <TabButton
                active={tab === "aed"}
                onClick={() => setTab("aed")}
              >
                จัดการ AED
              </TabButton>

              <TabButton
                active={tab === "service_area"}
                onClick={() => setTab("service_area")}
              >
                พื้นที่ให้บริการ
              </TabButton>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs bg-white/20 px-2 py-1 rounded">
            {role}
          </span>

          <span className="text-xs opacity-80">
            {user.email}
          </span>

          <button
            onClick={() => signOut(auth)}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {tab === "incidents" && (
        <>
          <StatsBar stats={stats} />

          <div className="flex flex-1 overflow-hidden gap-4 p-4">
            <div className="w-96 flex flex-col gap-3 overflow-y-auto">
              {loading && (
                <p className="text-gray-500 text-center p-4">
                  กำลังโหลด...
                </p>
              )}

              {activeIncidents.length === 0 && !loading && (
                <div className="bg-white rounded-xl p-6 text-center text-gray-400">
                  ยังไม่มีเหตุฉุกเฉินปัจจุบัน
                </div>
              )}

              {activeIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  isSelected={selected === inc.id}
                  onClick={() => setSelected(inc.id)}
                  onUpdateStatus={updateStatus}
                  onArchive={archiveIncident}
                  onCancel={cancelIncident}
                />
              ))}
            </div>

            <div className="flex-1">
              <IncidentMap
                incidents={activeIncidents}
                selectedId={selected}
                onMarkerClick={setSelected}
              />
            </div>
          </div>
        </>
      )}

      {tab === "history" && (
        <HistoryPage
          incidents={historyIncidents}
          onRestore={restoreIncident}
          onDelete={deleteIncident}
          role={role}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsDashboard
          incidents={incidents}
          stats={stats}
        />
      )}

      {tab === "aed" && role === "admin" && (
        <div className="flex-1 overflow-y-auto p-4">
          <AEDManager />
        </div>
      )}

      {tab === "service_area" && role === "admin" && (
        <div className="flex-1 overflow-y-auto p-4">
          <ServiceAreaManager />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
        active
          ? "bg-white text-red-700"
          : "bg-white/20 text-white hover:bg-white/30"
      }`}
    >
      {children}
    </button>
  );
}