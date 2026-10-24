import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from "@react-google-maps/api";
import { db } from "../config/firebase";

// ค่าตั้งต้น (สถานพยาบาล ม.เกษตรฯ กำแพงแสน)
const KPS_CENTER = { lat: 14.028746607870978, lng: 99.97823358223988 };
const AED_COLLECTION = "aeds";

const INITIAL_FORM_STATE = {
  name: "",
  description: "",
  lat: "",
  lng: "",
  status: "active",
};

const MAP_OPTIONS = {
  mapTypeId: "hybrid",
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

function normalizeAEDStatus(status) {
  if (status === "maintenance" || status === "inactive") return "inactive";
  return "active";
}

function parseCoordinates(lat, lng) {
  if (String(lat).trim() === "" || String(lng).trim() === "") return null;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

// สร้างไอคอนหมุด AED แบบ SVG สีเขียว (active) หรือสีส้ม/แดง (inactive)
function createAedMarkerIcon(status, isSelected = false) {
  const isInactive = status === "inactive";
  const color = isInactive ? "#F59E0B" : "#10B981";
  const strokeColor = isSelected ? "#FFFFFF" : "#FFFFFF";
  const strokeWidth = isSelected ? 3 : 2;
  const scale = isSelected ? 1.2 : 1.0;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 25 17 25s17-13 17-25C34 7.6 26.4 0 17 0z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
      <circle cx="17" cy="16" r="10" fill="white" />
      <path d="M17 8 L13 16 L17 16 L15 24 L21 14 L17 14 Z" fill="${color}" />
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(34 * scale, 42 * scale),
    anchor: new window.google.maps.Point(17 * scale, 42 * scale),
  };
}

export default function AEDManager() {
  const [aedList, setAedList] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [selectedMapAed, setSelectedMapAed] = useState(null);
  const [mapCenter, setMapCenter] = useState(KPS_CENTER);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // โหลดรายการ AED แบบ Real-time จาก Firestore
  useEffect(() => {
    const aedRef = collection(db, AED_COLLECTION);
    const unsubscribe = onSnapshot(aedRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const latitude = data.location?.latitude ?? data.lat;
        const longitude = data.location?.longitude ?? data.lng;
        return {
          id: docSnap.id,
          ...data,
          status: normalizeAEDStatus(data.status),
          lat: latitude,
          lng: longitude,
          location: {
            latitude,
            longitude,
          },
        };
      });
      setAedList(list);
    });

    return unsubscribe;
  }, []);

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM_STATE);
    setEditingId(null);
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (aed) => {
    setEditingId(aed.id);
    const lat = aed.location?.latitude ?? aed.lat;
    const lng = aed.location?.longitude ?? aed.lng;
    setForm({
      name: aed.name || "",
      description: aed.description || "",
      lat: lat != null ? String(lat) : "",
      lng: lng != null ? String(lng) : "",
      status: normalizeAEDStatus(aed.status),
    });

    if (lat != null && lng != null) {
      setMapCenter({ lat: Number(lat), lng: Number(lng) });
      setSelectedMapAed(aed);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`ต้องการลบจุดติดตั้ง AED "${name || "นี้"}" ใช่หรือไม่?`)) return;

    try {
      await deleteDoc(doc(db, AED_COLLECTION, id));
      if (editingId === id) resetForm();
      if (selectedMapAed?.id === id) setSelectedMapAed(null);
    } catch (error) {
      console.error("ลบตำแหน่ง AED ไม่สำเร็จ:", error);
      alert("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const handleMapClick = useCallback((event) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setForm((prev) => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));
    setSelectedMapAed(null);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const coordinates = parseCoordinates(form.lat, form.lng);
    if (!form.name.trim() || !coordinates) {
      alert("กรุณากรอกชื่อจุดติดตั้ง และเลือกตำแหน่งบนแผนที่");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: normalizeAEDStatus(form.status),
        location: {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        },
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, AED_COLLECTION, editingId), payload);
      } else {
        await addDoc(collection(db, AED_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error("บันทึกข้อมูล AED ไม่สำเร็จ:", error);
      alert("บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const currentMarkerCoords = useMemo(
    () => parseCoordinates(form.lat, form.lng),
    [form.lat, form.lng]
  );

  // คัดกรองรายการ AED ตามคำค้นหา และสถานะ
  const filteredAedList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aedList.filter((item) => {
      const matchSearch =
        !q ||
        (item.name || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [aedList, search, statusFilter]);

  const activeCount = useMemo(
    () => aedList.filter((i) => i.status === "active").length,
    [aedList]
  );
  const inactiveCount = useMemo(
    () => aedList.filter((i) => i.status === "inactive").length,
    [aedList]
  );

  return (
    <div className="p-4 h-full overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
      {/* ส่วนหัวหน้า + สถิติภาพรวม */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            ⚡ จัดการตำแหน่งเครื่องกระตุกหัวใจไฟฟ้า (AED)
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            เพิ่ม แก้ไข และตรวจสอบจุดติดตั้งเครื่อง AED ทั่วบริเวณมหาวิทยาลัยเกษตรศาสตร์ กำแพงแสน
          </p>
        </div>

        {/* 3 ตัวเลขสถิติภาพรวม */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <span className="text-[11px] font-bold text-slate-500 block">ทั้งหมด</span>
            <span className="text-lg font-bold text-slate-800">{aedList.length} จุด</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
            <span className="text-[11px] font-bold text-emerald-600 block">พร้อมใช้งาน</span>
            <span className="text-lg font-bold text-emerald-700">{activeCount} จุด</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
            <span className="text-[11px] font-bold text-amber-600 block">ไม่พร้อมใช้งาน / ซ่อม</span>
            <span className="text-lg font-bold text-amber-700">{inactiveCount} จุด</span>
          </div>
        </div>
      </div>

      {/* เนื้อหาหลัก: แบ่ง 2 คอลัมน์ (ซ้าย = รายการ + ฟอร์ม / ขวา = แผนที่) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* คอลัมน์ซ้าย (5 คอลัมน์): ฟอร์มเพิ่ม/แก้ไข + รายการ AED */}
        <div className="xl:col-span-5 space-y-5">
          {/* การ์ดฟอร์มเพิ่ม/แก้ไข */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                {editingId ? "✏️ แก้ไขข้อมูลจุดติดตั้ง AED" : "➕ เพิ่มจุดติดตั้ง AED ใหม่"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
                >
                  ✕ ยกเลิกแก้ไข
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">
              คลิกบนแผนที่ด้านขวา หรือกดปุ่มด้านล่างเพื่อกำหนดพิกัดจุดติดตั้ง
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  ชื่อจุดติดตั้ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น อาคารศูนย์เรียนรวม 4 (ศร.4)"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  รายละเอียดตำแหน่ง / จุดสังเกต
                </label>
                <input
                  type="text"
                  placeholder="เช่น หน้าเคาน์เตอร์ประชาสัมพันธ์ ชั้น 1 ฝั่งทิศตะวันออก"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* พิกัด */}
              <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <span className="text-xs font-bold text-slate-600 block">
                  พิกัดตำแหน่ง (GPS)
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Latitude</span>
                    <input
                      type="text"
                      placeholder="14.028746"
                      value={form.lat}
                      onChange={(e) => handleChange("lat", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Longitude</span>
                    <input
                      type="text"
                      placeholder="99.978233"
                      value={form.lng}
                      onChange={(e) => handleChange("lng", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* สถานะพร้อมใช้งาน */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  สถานะความพร้อมใช้งาน
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange("status", "active")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      form.status === "active"
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>✅</span> พร้อมใช้งาน
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange("status", "inactive")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      form.status === "inactive"
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>⚠️</span> ปิดซ่อมบำรุง
                  </button>
                </div>
              </div>

              {/* ปุ่มบันทึก */}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition"
              >
                {saving
                  ? "กำลังบันทึกข้อมูล..."
                  : editingId
                  ? "💾 บันทึกการแก้ไขจุดติดตั้ง"
                  : "➕ บันทึกจุดติดตั้ง AED ใหม่"}
              </button>
            </form>
          </div>

          {/* รายการตำแหน่ง AED ที่บันทึกไว้ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                📋 รายการจุดติดตั้ง AED ({filteredAedList.length})
              </h3>

              {/* ปุ่มสลับฟิลเตอร์สถานะ */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    statusFilter === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500"
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    statusFilter === "active" ? "bg-emerald-500 text-white shadow-xs" : "text-slate-500"
                  }`}
                >
                  พร้อมใช้
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("inactive")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    statusFilter === "inactive" ? "bg-amber-500 text-white shadow-xs" : "text-slate-500"
                  }`}
                >
                  ซ่อมบำรุง
                </button>
              </div>
            </div>

            {/* ช่องค้นหา */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 ค้นหาชื่ออาคาร หรือตำแหน่งติดตั้ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* รายการการ์ด AED */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
              {filteredAedList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-medium text-xs">
                  ไม่พบจุดติดตั้ง AED ตามเงื่อนไขที่ค้นหา
                </div>
              ) : (
                filteredAedList.map((item) => {
                  const isCurrentEditing = editingId === item.id;
                  const lat = Number(item.location?.latitude ?? item.lat);
                  const lng = Number(item.location?.longitude ?? item.lng);
                  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrentEditing
                          ? "bg-red-50/40 border-red-300 ring-2 ring-red-400/20"
                          : "bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-xs truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {item.status === "active" ? "พร้อมใช้" : "ซ่อมบำรุง"}
                            </span>
                          </div>

                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              📍 {item.description}
                            </p>
                          )}

                          {hasCoords && (
                            <p className="text-[10px] font-mono text-slate-400 mt-1">
                              {lat.toFixed(5)}, {lng.toFixed(5)}
                            </p>
                          )}
                        </div>

                        {/* ปุ่มดูบนแผนที่ / แก้ไข / ลบ */}
                        <div className="flex items-center gap-1 shrink-0">
                          {hasCoords && (
                            <button
                              type="button"
                              onClick={() => {
                                setMapCenter({ lat, lng });
                                setSelectedMapAed(item);
                              }}
                              title="เลื่อนแผนที่ไปที่จุดนี้"
                              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
                            >
                              🗺️
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            title="แก้ไขจุดติดตั้ง"
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 text-xs font-bold"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.name)}
                            title="ลบจุดนี้"
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 text-xs font-bold"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* คอลัมน์ขวา (7 คอลัมน์): แผนที่ขนาดใหญ่ Interactive พร้อมคำอธิบาย */}
        <div className="xl:col-span-7 space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="mb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                🗺️ แผนที่พิกัดจุดติดตั้ง AED
              </h2>
              <p className="text-xs text-slate-500">
                คลิกที่จุดใดก็ได้บนแผนที่เพื่อปักหมุดพิกัด หรือคลิกที่หมุดเพื่อดูรายละเอียด
              </p>
            </div>

            <div className="w-full h-[640px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              {!isLoaded ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                  กำลังโหลดแผนที่...
                </div>
              ) : (
                <GoogleMap
                  mapContainerClassName="w-full h-full"
                  center={mapCenter}
                  zoom={16}
                  onClick={handleMapClick}
                  options={MAP_OPTIONS}
                >
                  {/* แสดงหมุด AED ที่มีอยู่ทั้งหมดในระบบ */}
                  {aedList.map((aed) => {
                    const pos = parseCoordinates(
                      String(aed.location?.latitude ?? aed.lat ?? ""),
                      String(aed.location?.longitude ?? aed.lng ?? "")
                    );
                    if (!pos) return null;

                    const isSelected = selectedMapAed?.id === aed.id || editingId === aed.id;

                    return (
                      <Marker
                        key={aed.id}
                        position={pos}
                        icon={createAedMarkerIcon(aed.status, isSelected)}
                        onClick={() => {
                          setSelectedMapAed(aed);
                          setMapCenter(pos);
                        }}
                      />
                    );
                  })}

                  {/* หมุดใหม่ที่กำลังคลิกเลือกตำแหน่ง */}
                  {currentMarkerCoords && (
                    <Marker
                      position={currentMarkerCoords}
                      label={{
                        text: "📍 จุดใหม่",
                        color: "#FFFFFF",
                        fontWeight: "bold",
                        fontSize: "12px",
                      }}
                    />
                  )}

                  {/* InfoWindow เมื่อคลิกหมุด */}
                  {selectedMapAed && (
                    <InfoWindow
                      position={parseCoordinates(
                        String(selectedMapAed.location?.latitude ?? selectedMapAed.lat ?? ""),
                        String(selectedMapAed.location?.longitude ?? selectedMapAed.lng ?? "")
                      )}
                      onCloseClick={() => setSelectedMapAed(null)}
                    >
                      <div className="p-1 min-w-[200px] font-sans">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">⚡</span>
                          <span className="font-bold text-slate-800 text-sm">
                            {selectedMapAed.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-1.5">
                          {selectedMapAed.description || "ไม่มีรายละเอียดตำแหน่ง"}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              selectedMapAed.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {selectedMapAed.status === "active" ? "พร้อมใช้งาน" : "ไม่พร้อมใช้งาน"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEdit(selectedMapAed)}
                            className="text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            ✏️ แก้ไขจุดนี้
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
