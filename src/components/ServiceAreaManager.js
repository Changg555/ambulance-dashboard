import React, { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { GoogleMap, Marker, Circle, useJsApiLoader } from "@react-google-maps/api";
import { db } from "../config/firebase";

// ค่าเริ่มต้นของพื้นที่ให้บริการ ใช้ทั้งตอนเปิดหน้าครั้งแรกและตอน reset
const DEFAULT_AREA = {
  name: "มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน",
  center: { lat: 14.0280249, lng: 99.9806146 },
  radius: 1300,
  enabled: true,
};

// ข้อความแจ้งเตือนและ label ที่ใช้ซ้ำในหน้านี้
const SERVICE_AREA_TEXT = {
  title: "จัดการรัศมีพื้นที่ให้บริการ",
  subtitle: "กำหนดขอบเขตที่ระบบจะถือว่าอยู่ในพื้นที่",
  validationError: "กรุณากรอกข้อมูลให้ครบถ้วน",
  saveSuccess: "บันทึกพื้นที่ให้บริการเรียบร้อยแล้ว",
  saveError: "บันทึกไม่สำเร็จ",
  resetConfirm: "ต้องการรีเซ็ตพื้นที่ให้บริการกลับเป็นค่าเริ่มต้นหรือไม่?",
  resetSuccess: "รีเซ็ตค่าเริ่มต้นเรียบร้อยแล้ว",
};

// class กลางของ input เพื่อลดการเขียน Tailwind ซ้ำหลายช่อง
const INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none";

const COMPACT_INPUT_CLASS =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none";

// option ของ Google Map แยกไว้เพื่อไม่ให้ JSX หลักรก
const MAP_OPTIONS = {
  mapTypeId: "hybrid",
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

// label ของ marker จุดศูนย์กลางพื้นที่บริการ
const CENTER_MARKER_LABEL = {
  text: "ศูนย์กลาง",
  color: "#FFFFFF",
  fontWeight: "bold",
  fontSize: "14px",
};

// style ของวงรัศมีพื้นที่บริการบนแผนที่
const SERVICE_CIRCLE_OPTIONS = {
  strokeColor: "#EF4444",
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillColor: "#EF4444",
  fillOpacity: 0.1,
};

// แปลงข้อมูลจาก Firebase ให้ครบ field และเป็นชนิดข้อมูลที่ UI ใช้งานได้
function normalizeServiceArea(data) {
  if (!data) return DEFAULT_AREA;

  return {
    name: data.name || DEFAULT_AREA.name,
    center: {
      lat: Number(data.center?.lat || DEFAULT_AREA.center.lat),
      lng: Number(data.center?.lng || DEFAULT_AREA.center.lng),
    },
    radius: Number(data.radius || DEFAULT_AREA.radius),
    enabled: data.enabled ?? true,
  };
}

// แปลง state ในฟอร์มให้เป็น payload ที่พร้อมบันทึกลง Firebase
function createServiceAreaPayload(area) {
  const lat = Number(area.center.lat);
  const lng = Number(area.center.lng);
  const radius = Number(area.radius);

  if (!area.name || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
    return { error: SERVICE_AREA_TEXT.validationError };
  }

  return {
    payload: {
      name: area.name,
      center: { lat, lng },
      radius,
      enabled: Boolean(area.enabled),
      updatedAt: Date.now(),
    },
  };
}

// แปลงค่าศูนย์กลางจาก state ให้เป็น number สำหรับส่งเข้า Google Map
function getMapCenter(area) {
  return {
    lat: Number(area.center.lat),
    lng: Number(area.center.lng),
  };
}

// แสดงรัศมีจากเมตรเป็นกิโลเมตรเพื่อให้อ่านง่ายขึ้นในกล่องคำแนะนำ
function formatRadiusKm(radius) {
  return (Number(radius) / 1000).toFixed(1);
}

// field input พร้อม label มาตรฐานของฟอร์ม
function FormField({ label, value, onChange, type = "text", compact = false }) {
  return (
    <div>
      <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        className={compact ? COMPACT_INPUT_CLASS : INPUT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

// กล่องคำแนะนำการใช้งานและสรุปรัศมีปัจจุบัน
function UsageHint({ radius }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5 text-[12px] text-red-700 space-y-1.5 shadow-sm">
      <p className="font-bold flex items-center gap-1.5">💡 คำแนะนำการใช้งาน:</p>
      <p>• คลิกบนแผนที่เพื่อปักหมุดศูนย์กลางพื้นที่ให้บริการ</p>
      <p>• พิกัด Latitude / Longitude จะเปลี่ยนตามตำแหน่งที่คลิก</p>
      <p className="font-bold">• รัศมีปัจจุบัน: {formatRadiusKm(radius)} กม.</p>
    </div>
  );
}

// toggle เปิด/ปิดการเช็คพื้นที่บริการของระบบ
function EnabledToggle({ checked, onChange }) {
  return (
    <label className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer">
      <input
        type="checkbox"
        className="w-4 h-4 text-red-500 rounded border-slate-300 focus:ring-red-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      เปิดใช้งานเช็คพิกัดพื้นที่
    </label>
  );
}

// ฟอร์มตั้งค่าพื้นที่บริการ แยกจาก component หลักเพื่อให้อ่าน flow ง่ายขึ้น
function ServiceAreaForm({ area, saving, onChange, onCenterChange, onSave, onReset }) {
  return (
    <form onSubmit={onSave} className="space-y-4">
      <FormField label="ชื่อพื้นที่" value={area.name} onChange={(value) => onChange("name", value)} />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Latitude"
          value={area.center.lat}
          onChange={(value) => onCenterChange("lat", value)}
          compact
        />
        <FormField
          label="Longitude"
          value={area.center.lng}
          onChange={(value) => onCenterChange("lng", value)}
          compact
        />
      </div>

      <FormField
        label="รัศมีบริการ (เมตร)"
        type="number"
        value={area.radius}
        onChange={(value) => onChange("radius", value)}
      />

      <EnabledToggle checked={area.enabled} onChange={(value) => onChange("enabled", value)} />

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-60 mt-2"
      >
        {saving ? "กำลังบันทึก..." : "บันทึกตั้งค่า"}
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={saving}
        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2.5 font-bold transition-all disabled:opacity-60"
      >
        รีเซ็ตค่าเริ่มต้น
      </button>
    </form>
  );
}

// panel ด้านซ้าย รวมคำอธิบาย คำแนะนำ และฟอร์มตั้งค่า
function ServiceAreaSettingsPanel({ area, saving, onChange, onCenterChange, onSave, onReset }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
      <h2 className="text-lg font-bold text-slate-800">{SERVICE_AREA_TEXT.title}</h2>
      <p className="text-sm font-medium text-slate-500 mb-5">{SERVICE_AREA_TEXT.subtitle}</p>

      <UsageHint radius={area.radius} />
      <ServiceAreaForm
        area={area}
        saving={saving}
        onChange={onChange}
        onCenterChange={onCenterChange}
        onSave={onSave}
        onReset={onReset}
      />
    </div>
  );
}

// แผนที่ด้านขวา แสดง marker ศูนย์กลางและวงรัศมีพื้นที่บริการ
function ServiceAreaMap({ area, isLoaded, onMapClick }) {
  const currentCenter = getMapCenter(area);

  return (
    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[600px]">
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
          กำลังโหลดแผนที่...
        </div>
      ) : (
        <GoogleMap
          mapContainerClassName="w-full h-full"
          center={currentCenter}
          zoom={15}
          onClick={onMapClick}
          options={MAP_OPTIONS}
        >
          <Marker position={currentCenter} label={CENTER_MARKER_LABEL} />
          {area.enabled && (
            <Circle
              center={currentCenter}
              radius={Number(area.radius)}
              options={SERVICE_CIRCLE_OPTIONS}
            />
          )}
        </GoogleMap>
      )}
    </div>
  );
}

// component หลัก: โหลด/บันทึกพื้นที่บริการ และส่ง state ให้ form กับ map
export default function ServiceAreaManager() {
  const [area, setArea] = useState(DEFAULT_AREA);
  const [saving, setSaving] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    const areaRef = ref(db, "service_area");
    const unsubscribe = onValue(areaRef, (snapshot) => {
      setArea(normalizeServiceArea(snapshot.val()));
    });

    return () => unsubscribe();
  }, []);

  // อัปเดต field ระดับบน เช่น name, radius, enabled
  const handleChange = (field, value) => {
    setArea((prev) => ({ ...prev, [field]: value }));
  };

  // อัปเดต field ภายใน center เช่น lat/lng โดยคงค่าเดิมของอีกแกนไว้
  const handleCenterChange = (field, value) => {
    setArea((prev) => ({
      ...prev,
      center: { ...prev.center, [field]: value },
    }));
  };

  // คลิกบนแผนที่เพื่อเปลี่ยนศูนย์กลางพื้นที่บริการ
  const handleMapClick = (event) => {
    setArea((prev) => ({
      ...prev,
      center: { lat: event.latLng.lat(), lng: event.latLng.lng() },
    }));
  };

  // validate และบันทึกค่าพื้นที่บริการลง Firebase
  const handleSave = async (event) => {
    event.preventDefault();

    const { payload, error } = createServiceAreaPayload(area);
    if (error) {
      alert(error);
      return;
    }

    setSaving(true);
    try {
      await set(ref(db, "service_area"), payload);
      alert(SERVICE_AREA_TEXT.saveSuccess);
    } catch (err) {
      console.error(err);
      alert(SERVICE_AREA_TEXT.saveError);
    } finally {
      setSaving(false);
    }
  };

  // reset กลับค่า default และบันทึกลง Firebase ทันทีหลังยืนยัน
  const handleReset = async () => {
    const ok = window.confirm(SERVICE_AREA_TEXT.resetConfirm);
    if (!ok) return;

    setSaving(true);
    try {
      const defaultPayload = { ...DEFAULT_AREA, updatedAt: Date.now() };
      setArea(DEFAULT_AREA);
      await set(ref(db, "service_area"), defaultPayload);
      alert(SERVICE_AREA_TEXT.resetSuccess);
    } catch (err) {
      console.error(err);
      alert(SERVICE_AREA_TEXT.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ServiceAreaSettingsPanel
        area={area}
        saving={saving}
        onChange={handleChange}
        onCenterChange={handleCenterChange}
        onSave={handleSave}
        onReset={handleReset}
      />
      <ServiceAreaMap area={area} isLoaded={isLoaded} onMapClick={handleMapClick} />
    </div>
  );
}
