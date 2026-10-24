import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ข้อความสถานะฝั่ง Mobile (src/constants/incident.js)
export const MOBILE_STATUS_LABEL = {
  pending: "รอเจ้าหน้าที่รับเรื่อง",
  accepted: "เจ้าหน้าที่รับเรื่องแล้ว",
  on_the_way: "กำลังเดินทางไปหาคุณ",
  arrived: "ถึงจุดเกิดเหตุแล้ว",
  completed: "ช่วยเหลือเสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

// แปลงค่าเวลา (Firestore Timestamp / Date / number / ISO string) ให้เป็น milliseconds
export function toMillis(val) {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (typeof val?.toMillis === "function") return val.toMillis();
  if (typeof val?.seconds === "number") return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return Number.isFinite(parsed) ? parsed : null;
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

export function useIncidents({ user, profile } = {}) {
  const [incidentsRaw, setIncidentsRaw] = useState([]);
  const [timelinesMap, setTimelinesMap] = useState({});
  const [serviceArea, setServiceArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(null);
  const timelineUnsubsRef = useRef({});

  // ดึงข้อมูลเหตุฉุกเฉินจาก Firestore คอลเลกชัน "incidents"
  useEffect(() => {
    let fallbackUnsub = null;

    const handleSnapshot = (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;

        const lat = Number(data.location?.latitude ?? data.location?.lat);
        const lng = Number(data.location?.longitude ?? data.location?.lng);
        const hasValidCoords =
          Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
        const address = data.address || data.location?.address || "";
        const rawType = data.type || "other";
        const normalizedType =
          rawType === "vehicle_accident" ? "car_accident" : rawType;

        return {
          id,
          ...data,
          type: normalizedType,
          caseNumber: data.caseNumber || `KPS-${id.slice(0, 8).toUpperCase()}`,
          status: data.status || "pending",
          address,
          location: {
            ...data.location,
            latitude: hasValidCoords ? lat : null,
            longitude: hasValidCoords ? lng : null,
            lat: hasValidCoords ? lat : null,
            lng: hasValidCoords ? lng : null,
            address,
          },
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
          completedAt: toMillis(data.completedAt),
          cancelledAt: toMillis(data.cancelledAt),
          archivedAt: toMillis(data.archivedAt),
        };
      });

      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setIncidentsRaw(list);
      setLoading(false);

      // จัดการ subscribe subcollection "timeline" ของแต่ละ incident
      const currentIds = new Set(list.map((i) => i.id));

      // ยกเลิก listener ของเคสที่ถูกลบไปแล้ว
      Object.keys(timelineUnsubsRef.current).forEach((incId) => {
        if (!currentIds.has(incId)) {
          timelineUnsubsRef.current[incId]();
          delete timelineUnsubsRef.current[incId];
        }
      });

      // เพิ่ม listener สำหรับเคสใหม่
      list.forEach((inc) => {
        if (!timelineUnsubsRef.current[inc.id]) {
          const tlQuery = query(
            collection(db, "incidents", inc.id, "timeline"),
            orderBy("at", "asc")
          );
          timelineUnsubsRef.current[inc.id] = onSnapshot(
            tlQuery,
            (tlSnap) => {
              const tlItems = tlSnap.docs.map((d) => {
                const tlData = d.data();
                const st = tlData.status || "pending";
                const timeMs = toMillis(tlData.at ?? tlData.time);
                return {
                  id: d.id,
                  ...tlData,
                  status: st,
                  note: tlData.note || tlData.label || MOBILE_STATUS_LABEL[st] || st,
                  label: tlData.note || tlData.label || MOBILE_STATUS_LABEL[st] || st,
                  time: timeMs,
                };
              });
              setTimelinesMap((prev) => ({ ...prev, [inc.id]: tlItems }));
            },
            (err) => console.warn("Timeline subscribe error:", err)
          );
        }
      });
    };

    const incidentsRef = collection(db, "incidents");

    const unsub = onSnapshot(
      incidentsRef,
      (snapshot) => {
        setPermissionError(null);
        handleSnapshot(snapshot);
      },
      (error) => {
        console.error("Error subscribing to all incidents:", error);
        setPermissionError(error.message || "Missing or insufficient permissions");

        // Fallback: ถ้า Firestore Rules บล็อกการดึงเคสทั้งหมด ให้ลองดึงเฉพาะของ uid ปัจจุบัน
        if (user?.uid) {
          const myQuery = query(
            collection(db, "incidents"),
            where("userId", "==", user.uid)
          );
          fallbackUnsub = onSnapshot(
            myQuery,
            (snap) => handleSnapshot(snap),
            () => setLoading(false)
          );
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
      Object.values(timelineUnsubsRef.current).forEach((fn) => fn());
      timelineUnsubsRef.current = {};
    };
  }, [user?.uid]);

  // ดึงการตั้งค่าพื้นที่ให้บริการจาก Firestore: doc(db, "settings", "serviceArea") ตามฝั่ง Mobile
  useEffect(() => {
    const areaRef = doc(db, "settings", "serviceArea");

    const unsub = onSnapshot(
      areaRef,
      (snap) => {
        if (!snap.exists()) {
          setServiceArea(null);
          return;
        }
        const data = snap.data();
        const centerLat = Number(data.center?.latitude ?? data.center?.lat);
        const centerLng = Number(data.center?.longitude ?? data.center?.lng);
        setServiceArea({
          ...data,
          center: {
            latitude: centerLat,
            longitude: centerLng,
            lat: centerLat,
            lng: centerLng,
          },
        });
      },
      (err) => console.warn("ServiceArea subscribe error:", err)
    );

    return () => unsub();
  }, []);

  const incidents = useMemo(() => {
    const areaEnabled =
      serviceArea &&
      serviceArea.enabled !== false &&
      serviceArea.center &&
      typeof serviceArea.radius === "number";
    const centerLat = Number(serviceArea?.center?.latitude ?? serviceArea?.center?.lat);
    const centerLng = Number(serviceArea?.center?.longitude ?? serviceArea?.center?.lng);
    const radius = Number(serviceArea?.radius);

    return incidentsRaw.map((item) => {
      const subTimeline = timelinesMap[item.id];
      const legacyTimeline = Array.isArray(item.timeline)
        ? item.timeline.map((t) => ({
            ...t,
            status: t.status || "pending",
            time: toMillis(t.at ?? t.time),
          }))
        : [];
      const timeline =
        subTimeline && subTimeline.length > 0 ? subTimeline : legacyTimeline;

      // หาก completedAt หรือ cancelledAt ไม่มีใน root doc ให้ดึงจาก timeline หรือ updatedAt
      const completedEntry = timeline.find((t) => t.status === "completed");
      const cancelledEntry = timeline.find((t) => t.status === "cancelled");
      const completedAt =
        item.completedAt ||
        completedEntry?.time ||
        (item.status === "completed" ? item.updatedAt : null);
      const cancelledAt =
        item.cancelledAt ||
        cancelledEntry?.time ||
        (item.status === "cancelled" ? item.updatedAt : null);

      const enriched = {
        ...item,
        timeline,
        completedAt,
        cancelledAt,
      };

      if (
        !areaEnabled ||
        !Number.isFinite(centerLat) ||
        !Number.isFinite(centerLng) ||
        !Number.isFinite(radius)
      ) {
        return {
          ...enriched,
          serviceAreaStatus: "not_configured",
          isInsideServiceArea: null,
        };
      }

      const lat = Number(item.location?.latitude ?? item.location?.lat);
      const lng = Number(item.location?.longitude ?? item.location?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        return {
          ...enriched,
          serviceAreaStatus: "unknown",
          isInsideServiceArea: null,
        };
      }

      const distance = calcDistance(lat, lng, centerLat, centerLng);
      const isInside = distance <= radius;

      return {
        ...enriched,
        serviceAreaStatus: isInside ? "inside" : "outside",
        isInsideServiceArea: isInside,
        distanceFromServiceCenter: Math.round(distance),
      };
    });
  }, [incidentsRaw, timelinesMap, serviceArea]);

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
      (item) =>
        item.createdAt && item.completedAt && item.completedAt >= item.createdAt
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
      on_the_way: incidents.filter((item) => item.status === "on_the_way").length,
      arrived: incidents.filter((item) => item.status === "arrived").length,
      completed: completedCases.length,
      cancelled: incidents.filter((item) => item.status === "cancelled").length,
      archived: incidents.filter((item) => item.archived).length,
      inside: incidents.filter((item) => item.isInsideServiceArea === true).length,
      outside: incidents.filter((item) => item.isInsideServiceArea === false).length,
      avgResponseTime,
    };
  }, [incidents]);

  // อัปเดตสถานะเคสลง Firestore พร้อมเพิ่มข้อมูลใน subcollection "timeline" และระบุเจ้าหน้าที่ผู้รับผิดชอบ (assignedTo)
  const updateStatus = async (incidentId, newStatus, customNote = null) => {
    const firestoreStatus = newStatus || "pending";
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;

    const batch = writeBatch(db);
    const incRef = doc(db, "incidents", incidentId);
    const tlRef = doc(collection(db, "incidents", incidentId, "timeline"));

    const payload = {
      status: firestoreStatus,
      updatedAt: serverTimestamp(),
    };

    // บันทึกข้อมูลเจ้าหน้าที่ที่รับผิดชอบ (แสดงบนหน้า StatusScreen ฝั่ง Mobile)
    if ((firestoreStatus === "accepted" || !incident.assignedTo) && user) {
      const staffName =
        [profile?.firstname, profile?.lastname].filter(Boolean).join(" ") ||
        profile?.name ||
        user.displayName ||
        user.email ||
        "เจ้าหน้าที่กู้ชีพ";

      payload.assignedTo = {
        uid: user.uid,
        name: staffName,
        phone: profile?.phone || "",
        vehicle: profile?.vehicle || "",
      };
    }

    if (firestoreStatus === "completed") {
      payload.completedAt = serverTimestamp();
    }

    batch.update(incRef, payload);
    batch.set(tlRef, {
      status: firestoreStatus,
      note: customNote?.trim() || MOBILE_STATUS_LABEL[firestoreStatus] || firestoreStatus,
      at: serverTimestamp(),
    });

    await batch.commit();
  };

  // ยกเลิกเคสตามโครงสร้างเดียวกับ cancelIncident ฝั่ง Mobile
  const cancelIncident = async (incidentId) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;

    const batch = writeBatch(db);
    const incRef = doc(db, "incidents", incidentId);
    const tlRef = doc(collection(db, "incidents", incidentId, "timeline"));

    batch.update(incRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(tlRef, {
      status: "cancelled",
      note: MOBILE_STATUS_LABEL.cancelled,
      at: serverTimestamp(),
    });

    await batch.commit();
  };

  const archiveIncident = async (incidentId) => {
    await updateDoc(doc(db, "incidents", incidentId), {
      archived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const restoreIncident = async (incidentId) => {
    await updateDoc(doc(db, "incidents", incidentId), {
      archived: false,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteIncident = async (incidentId) => {
    const batch = writeBatch(db);
    const tlSnap = await getDocs(collection(db, "incidents", incidentId, "timeline"));
    tlSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "incidents", incidentId));
    await batch.commit();
  };

  return {
    incidents,
    activeIncidents,
    historyIncidents,
    loading,
    permissionError,
    stats,
    serviceArea,
    updateStatus,
    cancelIncident,
    archiveIncident,
    restoreIncident,
    deleteIncident,
  };
}
