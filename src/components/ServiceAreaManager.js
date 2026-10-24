import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { db } from "../config/firebase";

// ค่าเริ่มต้นของพื้นที่ให้บริการ (สถานพยาบาล ม.เกษตรฯ กำแพงแสน)
const DEFAULT_AREA = {
  name: "มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
  center: { lat: 14.028746607870978, lng: 99.97823358223988 },
  radius: 1300,
  enabled: true,
};

const RADIUS_PRESETS = [
  { label: "500 ม.", value: 500 },
  { label: "1.0 กม.", value: 1000 },
  { label: "1.3 กม. (ค่ามาตรฐาน)", value: 1300 },
  { label: "2.0 กม.", value: 2000 },
  { label: "3.0 กม.", value: 3000 },
];

const MAP_OPTIONS = {
  mapTypeId: "hybrid",
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

const CENTER_MARKER_LABEL = {
  text: "จุดศูนย์สั่งกลาง",
  color: "#FFFFFF",
  fontWeight: "bold",
  fontSize: "12px",
};

const SERVICE_CIRCLE_OPTIONS = {
  strokeColor: "#EF4444",
  strokeOpacity: 0.85,
  strokeWeight: 2.5,
  fillColor: "#EF4444",
  fillOpacity: 0.15,
  clickable: false,
};

function normalizeServiceArea(data) {
  if (!data) return DEFAULT_AREA;

  const lat = Number(data.center?.latitude ?? data.center?.lat ?? DEFAULT_AREA.center.lat);
  const lng = Number(data.center?.longitude ?? data.center?.lng ?? DEFAULT_AREA.center.lng);

  return {
    name: data.name || DEFAULT_AREA.name,
    center: {
      lat: Number.isFinite(lat) ? lat : DEFAULT_AREA.center.lat,
      lng: Number.isFinite(lng) ? lng : DEFAULT_AREA.center.lng,
    },
    radius: Number(data.radius || DEFAULT_AREA.radius),
    enabled: data.enabled ?? true,
  };
}

export default function ServiceAreaManager() {
  const [area, setArea] = useState(DEFAULT_AREA);
  const [mapCenter, setMapCenter] = useState(DEFAULT_AREA.center);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // โหลดค่าการตั้งค่าพื้นที่บริการแบบ Real-time จาก Firestore doc("settings", "serviceArea")
  useEffect(() => {
    const areaRef = doc(db, "settings", "serviceArea");
    const unsubscribe = onSnapshot(areaRef, (snap) => {
      const normalized = normalizeServiceArea(snap.exists() ? snap.data() : null);
      setArea(normalized);
      setMapCenter(normalized.center);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (field, value) => {
    setArea((prev) => ({ ...prev, [field]: value }));
  };

  const handleCenterChange = (field, value) => {
    setArea((prev) => {
      const nextCenter = { ...prev.center, [field]: value };
      const lat = Number(nextCenter.lat);
      const lng = Number(nextCenter.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        setMapCenter({ lat, lng });
      }
      return {
        ...prev,
        center: nextCenter,
      };
    });
  };

  // คลิกบนแผนที่หรือลากหมุดเพื่อเปลี่ยนจุดศูนย์กลาง
  const handleMapClick = (event) => {
    if (!event?.latLng) return;
    const nextCenter = {
      lat: Number(event.latLng.lat().toFixed(6)),
      lng: Number(event.latLng.lng().toFixed(6)),
    };
    setArea((prev) => ({
      ...prev,
      center: nextCenter,
    }));
  };

  // บันทึกลง Firestore
  const handleSave = async (event) => {
    event.preventDefault();

    const lat = Number(area.center.lat);
    const lng = Number(area.center.lng);
    const radius = Number(area.radius);

    if (!area.name.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: area.name.trim(),
        center: {
          latitude: lat,
          longitude: lng,
        },
        radius,
        enabled: Boolean(area.enabled),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "settings", "serviceArea"), payload);
      alert("บันทึกการตั้งค่าพื้นที่ให้บริการเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // รีเซ็ตค่ากลับเป็นค่าเริ่มต้น
  const handleReset = async () => {
    if (!window.confirm("ต้องการรีเซ็ตพื้นที่ให้บริการกลับเป็นค่ามาตรฐาน (สถานพยาบาล มก.กพส. รัศมี 1,300 เมตร) ใช่หรือไม่?")) return;

    setSaving(true);
    try {
      const defaultPayload = {
        name: DEFAULT_AREA.name,
        center: {
          latitude: DEFAULT_AREA.center.lat,
          longitude: DEFAULT_AREA.center.lng,
        },
        radius: DEFAULT_AREA.radius,
        enabled: DEFAULT_AREA.enabled,
        updatedAt: serverTimestamp(),
      };
      setArea(DEFAULT_AREA);
      setMapCenter(DEFAULT_AREA.center);
      if (mapRef.current) {
        mapRef.current.panTo(DEFAULT_AREA.center);
        mapRef.current.setZoom(15);
      }
      await setDoc(doc(db, "settings", "serviceArea"), defaultPayload);
      alert("รีเซ็ตค่าเริ่มต้นเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      alert("รีเซ็ตค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // จัดการ Marker และ Circle บนแผนที่
  const currentCenter = useMemo(
    () => ({
      lat: Number(area.center.lat) || DEFAULT_AREA.center.lat,
      lng: Number(area.center.lng) || DEFAULT_AREA.center.lng,
    }),
    [area.center.lat, area.center.lng]
  );
  const radiusNum = Number(area.radius) || DEFAULT_AREA.radius;
  const isEnabled = Boolean(area.enabled);

  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;

    const marker = new window.google.maps.Marker({
      map: mapInstance,
      position: currentCenter,
      label: CENTER_MARKER_LABEL,
      draggable: true,
      title: "ลากเพื่อเปลี่ยนจุดศูนย์กลาง",
    });

    const dragListener = marker.addListener("dragend", (e) => {
      if (!e.latLng) return;
      const nextCenter = {
        lat: Number(e.latLng.lat().toFixed(6)),
        lng: Number(e.latLng.lng().toFixed(6)),
      };
      setArea((prev) => ({ ...prev, center: nextCenter }));
    });

    const circle = new window.google.maps.Circle({
      ...SERVICE_CIRCLE_OPTIONS,
      map: isEnabled ? mapInstance : null,
      center: currentCenter,
      radius: radiusNum,
    });

    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      window.google?.maps?.event?.removeListener(dragListener);
      marker.setMap(null);
      circle.setMap(null);
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance]);

  // อัปเดตตำแหน่ง Marker และ Circle แบบ Real-time ตามค่าใน state
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setPosition(currentCenter);
    }
    if (circleRef.current) {
      circleRef.current.setCenter(currentCenter);
      circleRef.current.setRadius(radiusNum);
      circleRef.current.setMap(isEnabled ? mapInstance : null);
    }
  }, [mapInstance, currentCenter.lat, currentCenter.lng, radiusNum, isEnabled, currentCenter]);

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
      {/* ส่วนหัวหน้า + สถานะปัจจุบัน */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            🌐 จัดการรัศมีและพื้นที่ให้บริการ (Service Area)
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            กำหนดขอบเขตรัศมีการให้บริการของศูนย์สั่งการรถพยาบาลฉุกเฉิน ม.เกษตรศาสตร์ วิทยาเขตกำแพงแสน
          </p>
        </div>

        {/* ป้ายแสดงข้อมูลสรุปปัจจุบัน */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <span className="text-[11px] font-bold text-slate-500 block">รัศมีบริการ</span>
            <span className="text-lg font-bold text-red-600">
              {radiusNum.toLocaleString()} ม. ({(radiusNum / 1000).toFixed(2)} กม.)
            </span>
          </div>

          <div
            className={`rounded-xl px-3.5 py-2 border ${
              isEnabled
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            <span className="text-[11px] font-bold block">สถานะการตรวจสอบ</span>
            <span className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isEnabled ? "เปิดใช้งานตรวจพื้นที่" : "ปิดการตรวจสอบพื้นที่"}
            </span>
          </div>
        </div>
      </div>

      {/* เนื้อหาหลัก: แบ่ง 2 คอลัมน์ (ซ้าย = แผงควบคุมตั้งค่า / ขวา = แผนที่ Real-time) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* คอลัมน์ซ้าย (5 คอลัมน์): แผงควบคุมตั้งค่าพื้นที่ */}
        <div className="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            ⚙️ ตั้งค่าขอบเขตพื้นที่ให้บริการ
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            {/* สวิตช์เปิด/ปิดการตรวจสอบพื้นที่ */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  ระบบตรวจสอบพื้นที่ให้บริการ
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  แจ้งเตือนผู้ใช้และเจ้าหน้าที่เมื่อมีการแจ้งเหตุนอกรัศมีบริการ
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={area.enabled}
                  onChange={(e) => handleChange("enabled", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            {/* ชื่อพื้นที่ */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                ชื่อพื้นที่ให้บริการ
              </label>
              <input
                type="text"
                required
                value={area.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="เช่น มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            {/* พิกัดจุดศูนย์กลาง */}
            <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-600 block">
                📍 พิกัดจุดศูนย์กลาง (ศูนย์สั่งการ)
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Latitude
                  </span>
                  <input
                    type="text"
                    value={area.center.lat}
                    onChange={(e) => handleCenterChange("lat", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                    Longitude
                  </span>
                  <input
                    type="text"
                    value={area.center.lng}
                    onChange={(e) => handleCenterChange("lng", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            {/* รัศมีการให้บริการ (เมตร) พร้อม Slider + ปุ่มลัด */}
            <div className="space-y-2.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">
                  ⭕ รัศมีครอบคลุมการให้บริการ
                </label>
                <span className="text-sm font-extrabold text-red-600 font-mono">
                  {radiusNum.toLocaleString()} ม. ({(radiusNum / 1000).toFixed(2)} กม.)
                </span>
              </div>

              {/* Slider ปรับรัศมี */}
              <input
                type="range"
                min="200"
                max="5000"
                step="50"
                value={radiusNum}
                onChange={(e) => handleChange("radius", Number(e.target.value))}
                className="w-full accent-red-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />

              {/* ปุ่มลัดเลือกรัศมีมาตรฐาน */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {RADIUS_PRESETS.map((p) => {
                  const active = radiusNum === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handleChange("radius", p.value)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                        active
                          ? "bg-red-500 text-white border-red-500 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ปุ่มบันทึก และ ปุ่มรีเซ็ต */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition"
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกการตั้งค่าพื้นที่บริการ"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 rounded-xl text-xs transition"
              >
                🔄 รีเซ็ตค่ามาตรฐาน
              </button>
            </div>
          </form>
        </div>

        {/* คอลัมน์ขวา (7 คอลัมน์): แผนที่ Real-time พร้อมวงรัศมี */}
        <div className="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              🗺️ ขอบเขตวงรัศมีบนแผนที่
            </h2>
            <p className="text-xs text-slate-500">
              คลิกบนแผนที่ หรือลากหมุดศูนย์สั่งการ เพื่อย้ายตำแหน่งศูนย์กลางแบบ Real-time
            </p>
          </div>

          <div className="w-full h-[580px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            {!isLoaded ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                กำลังโหลดแผนที่...
              </div>
            ) : (
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={mapCenter}
                zoom={15}
                onLoad={(map) => {
                  mapRef.current = map;
                  setMapInstance(map);
                }}
                onUnmount={() => {
                  mapRef.current = null;
                  setMapInstance(null);
                }}
                onClick={handleMapClick}
                options={MAP_OPTIONS}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
