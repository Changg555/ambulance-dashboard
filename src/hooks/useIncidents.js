import { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  update,
  remove,
} from "firebase/database";
import { db } from "../config/firebase";

const STATUS_LABELS = {
  pending: "แจ้งเหตุ",
  accepted: "เจ้าหน้าที่รับเคส",
  on_the_way: "รถพยาบาลกำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้นเคส",
};

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
    return incidents.filter((item) => !item.archived);
  }, [incidents]);

  const historyIncidents = useMemo(() => {
    return incidents.filter(
      (item) => item.archived || item.status === "completed"
    );
  }, [incidents]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayText = today.toDateString();

    const todayCases = incidents.filter((item) => {
      if (!item.createdAt) return false;
      return new Date(item.createdAt).toDateString() === todayText;
    });

    const completedCases = incidents.filter(
      (item) => item.status === "completed"
    );

    const pendingCases = incidents.filter(
      (item) => item.status === "pending"
    );

    const activeCases = incidents.filter(
      (item) => !item.archived && item.status !== "completed"
    );

    const insideCases = incidents.filter(
      (item) => item.isInsideServiceArea === true
    );

    const outsideCases = incidents.filter(
      (item) => item.isInsideServiceArea === false
    );

    const typeCount = {};

    incidents.forEach((item) => {
      const type = item.type || "other";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const topType =
      Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "-";

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
      pending: pendingCases.length,
      completed: completedCases.length,
      archived: incidents.filter((item) => item.archived).length,
      inside: insideCases.length,
      outside: outsideCases.length,
      topType,
      avgResponseTime,
    };
  }, [incidents]);

  const updateStatus = async (incidentId, newStatus) => {
    const incident = incidents.find((item) => item.id === incidentId);

    if (!incident) return;

    const oldTimeline = Array.isArray(incident.timeline)
      ? incident.timeline
      : [];

    const timelineItem = {
      status: newStatus,
      label: STATUS_LABELS[newStatus] || newStatus,
      time: Date.now(),
    };

    const payload = {
      status: newStatus,
      updatedAt: Date.now(),
      timeline: [...oldTimeline, timelineItem],
    };

    if (newStatus === "completed") {
      payload.completedAt = Date.now();
    }

    await update(ref(db, `incidents/${incidentId}`), payload);
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
    archiveIncident,
    restoreIncident,
    deleteIncident,
  };
}