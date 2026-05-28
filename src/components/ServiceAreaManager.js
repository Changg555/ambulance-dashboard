import React, { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";

import {
  GoogleMap,
  Marker,
  Circle,
  useJsApiLoader,
} from "@react-google-maps/api";

import { db } from "../config/firebase";

const DEFAULT_AREA = {
  name: "มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
  center: {
    lat: 14.0280249,
    lng: 99.9806146,
  },
  radius: 1300,
  enabled: true,
};

export default function ServiceAreaManager() {
  const [area, setArea] = useState(DEFAULT_AREA);
  const [saving, setSaving] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    const areaRef = ref(db, "service_area");

    const unsub = onValue(areaRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        setArea({
          name: data.name || DEFAULT_AREA.name,
          center: {
            lat: Number(data.center?.lat || DEFAULT_AREA.center.lat),
            lng: Number(data.center?.lng || DEFAULT_AREA.center.lng),
          },
          radius: Number(data.radius || DEFAULT_AREA.radius),
          enabled: data.enabled ?? true,
        });
      }
    });

    return () => unsub();
  }, []);

  const handleChange = (field, value) => {
    setArea((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCenterChange = (field, value) => {
    setArea((prev) => ({
      ...prev,
      center: {
        ...prev.center,
        [field]: value,
      },
    }));
  };

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setArea((prev) => ({
      ...prev,
      center: {
        lat,
        lng,
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const lat = Number(area.center.lat);
    const lng = Number(area.center.lng);
    const radius = Number(area.radius);

    if (
      !area.name ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      Number.isNaN(radius)
    ) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setSaving(true);

    try {
      await set(ref(db, "service_area"), {
        name: area.name,
        center: {
          lat,
          lng,
        },
        radius,
        enabled: Boolean(area.enabled),
        updatedAt: Date.now(),
      });

      alert("บันทึกพื้นที่ให้บริการแล้ว");
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = window.confirm(
      "ต้องการรีเซ็ตพื้นที่ให้บริการกลับเป็นค่าเริ่มต้นหรือไม่?"
    );

    if (!ok) return;

    setSaving(true);

    try {
      setArea(DEFAULT_AREA);

      await set(ref(db, "service_area"), {
        ...DEFAULT_AREA,
        updatedAt: Date.now(),
      });

      alert("รีเซ็ตค่าเริ่มต้นเรียบร้อยแล้ว");
    } catch (err) {
      console.error(err);
      alert("รีเซ็ตค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const currentCenter = {
    lat: Number(area.center.lat),
    lng: Number(area.center.lng),
  };

  const radiusText =
    Number(area.radius) >= 1000
      ? `${(Number(area.radius) / 1000).toFixed(1)} กม.`
      : `${Number(area.radius)} ม.`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-800">
          จัดการพื้นที่ให้บริการ
        </h2>

        <p className="text-sm text-gray-500 mb-4">
          กำหนดขอบเขตพื้นที่ที่ระบบ KPS Ambulance ดูแล
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">
              ชื่อพื้นที่
            </label>

            <input
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2"
              value={area.name}
              onChange={(e) =>
                handleChange("name", e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">
                Latitude
              </label>

              <input
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2"
                value={area.center.lat}
                onChange={(e) =>
                  handleCenterChange("lat", e.target.value)
                }
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Longitude
              </label>

              <input
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2"
                value={area.center.lng}
                onChange={(e) =>
                  handleCenterChange("lng", e.target.value)
                }
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">
              รัศมีพื้นที่ให้บริการ (เมตร)
            </label>

            <input
              type="number"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2"
              value={area.radius}
              onChange={(e) =>
                handleChange("radius", e.target.value)
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={area.enabled}
              onChange={(e) =>
                handleChange("enabled", e.target.checked)
              }
            />

            เปิดใช้งานพื้นที่ให้บริการ
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-red-700 hover:bg-red-800 text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
          >
            {saving
              ? "กำลังบันทึก..."
              : "บันทึกพื้นที่ให้บริการ"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg py-2.5 font-semibold disabled:opacity-60"
          >
            รีเซ็ตค่าเริ่มต้น
          </button>
        </form>

        <div className="mt-5 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <p>คำแนะนำ:</p>
          <p>คลิกบนแผนที่เพื่อปักหมุดศูนย์กลางพื้นที่ให้บริการ</p>
          <p>พิกัด Latitude / Longitude จะเปลี่ยนตามตำแหน่งที่คลิก</p>
          <p>รัศมีปัจจุบัน: {radiusText}</p>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[520px]">
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            กำลังโหลดแผนที่...
          </div>
        ) : (
          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={currentCenter}
            zoom={15}
            onClick={handleMapClick}
            options={{
              mapTypeId: "hybrid",
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
            }}
          >
            <Marker
              position={currentCenter}
              label={{
                text: "ศูนย์กลาง",
                color: "#111827",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            />

            {area.enabled && (
              <>
                <Circle
                  center={currentCenter}
                  radius={Number(area.radius)}
                  options={{
                    strokeColor: "#DC2626",
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    fillColor: "#DC2626",
                    fillOpacity: 0.05,
                  }}
                />

                <Marker
                  position={currentCenter}
                  label={{
                    text: radiusText,
                    color: "#DC2626",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 0,
                  }}
                />
              </>
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}