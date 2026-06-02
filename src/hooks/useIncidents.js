import { useEffect, useMemo, useState } from "react";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "../config/firebase";

const STATUS_LABELS = {
  pending: "แจ้งเหตุ",
  accepted: "เจ้าหน้าที่รับเคส",
  en_route: "รถพยาบาลกำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้นเคส",
  cancelled: "ยกเลิกเคส",
};

function normalizeStatus(status) {
  if (status === "on_the_way") return "en_route";
  return status || "pending";
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useIncidents() {
  const [incidentsRaw, setIncidentsRaw] = useState([]);
  const [serviceArea, setServiceArea] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const incidentsRef = ref(db, "incidents");

    const unsub = onValue(incidentsRef, (snapshot) => {
      const data = snapshot.val() || {};

      const list = Object.entries(data)
        .map(([id, value]) => ({
          id,
          ...value,
          status: normalizeStatus(value.status),
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setIncidentsRaw(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const areaRef = ref(db, "service_area");

    const unsub = onValue(areaRef, (snapshot) => {
      setServiceArea(snapshot.val());
    });

    return () => unsub();
  }, []);

  const incidents = useMemo(() => {
    if (!serviceArea || serviceArea.enabled !== true) {
      return incidentsRaw.map((item) => ({
        ...item,
        serviceAreaStatus: "not_configured",
        isInsideServiceArea: null,
      }));
    }

    const centerLat = Number(serviceArea.center?.lat);
    const centerLng = Number(serviceArea.center?.lng);
    const radius = Number(serviceArea.radius);

    return incidentsRaw.map((item) => {
      const lat = Number(item.location?.lat);
      const lng = Number(item.location?.lng);

      if (!lat || !lng) {
        return {
          ...item,
          serviceAreaStatus: "unknown",
          isInsideServiceArea: null,
        };
      }

      const distance = calcDistance(lat, lng, centerLat, centerLng);
      const isInside = distance <= radius;

      return {
        ...item,
        serviceAreaStatus: isInside ? "inside" : "outside",
        isInsideServiceArea: isInside,
        distanceFromServiceCenter: Math.round(distance),
      };
    });
  }, [incidentsRaw, serviceArea]);

  const activeIncidents = useMemo(() => {
    return incidents.filter(
      (item) =>
        !item.archived &&
        item.status !== "completed" &&
        item.status !== "cancelled"
    );
  }, [incidents]);

  const historyIncidents = useMemo(() => {
    return incidents.filter(
      (item) =>
        item.archived ||
        item.status === "completed" ||
        item.status === "cancelled"
    );
  }, [incidents]);

  const stats = useMemo(() => {
    const todayText = new Date().toDateString();

    const todayCases = incidents.filter((item) => {
      if (!item.createdAt) return false;
      return new Date(item.createdAt).toDateString() === todayText;
    });

    const completedCases = incidents.filter(
      (item) => item.status === "completed"
    );

    const activeCases = incidents.filter(
      (item) =>
        !item.archived &&
        item.status !== "completed" &&
        item.status !== "cancelled"
    );

    const completedWithTime = completedCases.filter(
      (item) => item.createdAt && item.completedAt
    );

    const avgResponseTime =
      completedWithTime.length > 0
        ? Math.round(
            completedWithTime.reduce((sum, item) => {
              return sum + (item.completedAt - item.createdAt);
            }, 0) /
              completedWithTime.length /
              60000
          )
        : 0;

    return {
      total: incidents.length,
      today: todayCases.length,
      active: activeCases.length,
      pending: incidents.filter((item) => item.status === "pending").length,
      accepted: incidents.filter((item) => item.status === "accepted").length,
      en_route: incidents.filter((item) => item.status === "en_route").length,
      arrived: incidents.filter((item) => item.status === "arrived").length,
      completed: completedCases.length,
      cancelled: incidents.filter((item) => item.status === "cancelled").length,
      archived: incidents.filter((item) => item.archived).length,
      inside: incidents.filter((item) => item.isInsideServiceArea === true)
        .length,
      outside: incidents.filter((item) => item.isInsideServiceArea === false)
        .length,
      avgResponseTime,
    };
  }, [incidents]);

  const updateStatus = async (incidentId, newStatus) => {
    const fixedStatus = normalizeStatus(newStatus);
    const incident = incidents.find((item) => item.id === incidentId);

    if (!incident) return;

    const oldTimeline = Array.isArray(incident.timeline)
      ? incident.timeline
      : [];

    const timelineItem = {
      status: fixedStatus,
      label: STATUS_LABELS[fixedStatus] || fixedStatus,
      time: Date.now(),
    };

    const payload = {
      status: fixedStatus,
      updatedAt: Date.now(),
      timeline: [...oldTimeline, timelineItem],
    };

    if (fixedStatus === "completed") {
      payload.completedAt = Date.now();
    }

    await update(ref(db, `incidents/${incidentId}`), payload);
  };

  const cancelIncident = async (incidentId) => {
    const incident = incidents.find((item) => item.id === incidentId);

    if (!incident) return;

    const oldTimeline = Array.isArray(incident.timeline)
      ? incident.timeline
      : [];

    await update(ref(db, `incidents/${incidentId}`), {
      status: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
      timeline: [
        ...oldTimeline,
        {
          status: "cancelled",
          label: "ยกเลิกเคส",
          time: Date.now(),
        },
      ],
    });
  };

  const archiveIncident = async (incidentId) => {
    await update(ref(db, `incidents/${incidentId}`), {
      archived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const restoreIncident = async (incidentId) => {
    await update(ref(db, `incidents/${incidentId}`), {
      archived: false,
      updatedAt: Date.now(),
    });
  };

  const deleteIncident = async (incidentId) => {
    await remove(ref(db, `incidents/${incidentId}`));
  };

  return {
    incidents,
    activeIncidents,
    historyIncidents,
    loading,
    stats,
    serviceArea,
    updateStatus,
    cancelIncident,
    archiveIncident,
    restoreIncident,
    deleteIncident,
  };
}