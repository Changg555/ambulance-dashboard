import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onValue, push, ref, remove, set, update } from 'firebase/database';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { db } from '../config/firebase';

// ค่าตั้งต้นและตัวเลือกที่ใช้ร่วมกันในหน้าจัดการ AED
const KPS_CENTER = { lat: 14.0280249, lng: 99.9806146 };
const AED_PATH = 'aed_locations';
const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  lat: '',
  lng: '',
  status: 'available',
};
const FIELD_CLASS_NAME =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all';
const AED_STATUS_OPTIONS = [
  { value: 'available', label: '✅ ใช้งานได้ปกติ' },
  { value: 'maintenance', label: '⚠️ ชำรุด / ปิดซ่อม' },
];

// แปลงข้อมูลใน Firebase เป็นรายการที่ผูกกับ id ของแต่ละตำแหน่ง
function toAEDList(snapshotValue) {
  return Object.entries(snapshotValue || {}).map(([id, value]) => ({
    ...value,
    id,
  }));
}

// แปลงตำแหน่ง AED ที่เลือกกลับเป็นค่าในฟอร์มสำหรับแก้ไข
function toAEDFormState(aed) {
  return {
    name: aed.name || '',
    description: aed.description || '',
    lat: aed.lat?.toString() || '',
    lng: aed.lng?.toString() || '',
    status: aed.status || 'available',
  };
}

// แปลงพิกัดจากฟอร์มเป็นตัวเลขก่อนบันทึกและใช้สร้าง marker
function parseCoordinates(lat, lng) {
  if (lat.trim() === '' || lng.trim() === '') return null;

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;

  return { lat: parsedLat, lng: parsedLng };
}

// สร้างข้อมูลมาตรฐานที่ใช้ทั้งตอนเพิ่มและแก้ไขตำแหน่ง AED
function createAEDPayload(form, coordinates) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    ...coordinates,
    status: form.status,
    updatedAt: Date.now(),
  };
}

// แสดง label และ input หรือ textarea ด้วยรูปแบบฟอร์มเดียวกัน
function FormField({ label, multiline = false, rows = 3, className = '', ...props }) {
  const Control = multiline ? 'textarea' : 'input';

  return (
    <label className="block text-[13px] font-bold text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      <Control
        className={`${FIELD_CLASS_NAME} ${className}`}
        {...(multiline ? { rows } : {})}
        {...props}
      />
    </label>
  );
}

// แสดงสถานะพร้อมสีและปุ่มสำหรับแก้ไขหรือลบรายการ
function AEDListItem({ aed, onEdit, onDelete }) {
  const isUnderMaintenance = aed.status === 'maintenance';

  return (
    <div className="border border-slate-200 rounded-2xl p-4 flex items-start gap-4 hover:border-slate-300 transition-colors bg-slate-50/50">
      <div className="text-3xl bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
        ⚡
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 leading-tight truncate">{aed.name}</p>
        <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1">
          {aed.description || '-'}
        </p>
        <span
          className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-md ${
            isUnderMaintenance
              ? 'bg-red-100 text-red-600'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {isUnderMaintenance ? 'ชำรุด' : 'ใช้งานได้'}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onEdit(aed)}
          className="text-xs font-bold bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          แก้ไข
        </button>
        <button
          type="button"
          onClick={() => onDelete(aed.id)}
          className="text-xs font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
        >
          ลบ
        </button>
      </div>
    </div>
  );
}

// แสดงฟอร์มสร้างหรือแก้ไข พร้อมคำแนะนำและตัวเลือกสถานะ
function AEDForm({
  form,
  editing,
  saving,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit">
      <h2 className="text-lg font-bold text-slate-800">
        {editing ? 'แก้ไขตำแหน่ง AED' : 'เพิ่มตำแหน่ง AED'}
      </h2>

      <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-4 text-[12px] text-red-700 space-y-1.5 shadow-sm">
        <p className="font-bold flex items-center gap-1.5">💡 คำแนะนำการใช้งาน:</p>
        <p>• คลิกบนแผนที่เพื่อปักหมุดพิกัดอัตโนมัติ</p>
        <p>• ตรวจสอบชื่อสถานที่และสถานะก่อนบันทึก</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          label="ชื่อจุดติดตั้ง"
          placeholder="เช่น อาคารศูนย์เรียนรวม 4"
          value={form.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
        <FormField
          label="รายละเอียดสถานที่"
          multiline
          placeholder="เช่น หน้าเคาน์เตอร์ชั้น 1"
          value={form.description}
          onChange={(event) => onChange('description', event.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Latitude"
            placeholder="พิกัดละติจูด"
            inputMode="decimal"
            value={form.lat}
            onChange={(event) => onChange('lat', event.target.value)}
          />
          <FormField
            label="Longitude"
            placeholder="พิกัดลองจิจูด"
            inputMode="decimal"
            value={form.lng}
            onChange={(event) => onChange('lng', event.target.value)}
          />
        </div>

        <label className="block text-[13px] font-bold text-slate-600">
          <span className="mb-1.5 block">สถานะ</span>
          <select
            className={`${FIELD_CLASS_NAME} font-medium`}
            value={form.status}
            onChange={(event) => onChange('status', event.target.value)}
          >
            {AED_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-60 mt-2"
        >
          {saving
            ? 'กำลังบันทึก...'
            : editing
              ? 'บันทึกการแก้ไข'
              : 'เพิ่ม AED ใหม่'}
        </button>

        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2.5 font-bold transition-all"
          >
            ยกเลิกการแก้ไข
          </button>
        )}
      </form>
    </section>
  );
}

// แสดงแผนที่ ตำแหน่ง AED ที่บันทึกไว้ และหมุดพิกัดที่กำลังแก้ไข
function AEDMap({ isLoaded, aedList, currentMarker, onMapClick, onEdit }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[450px]">
      {isLoaded ? (
        <GoogleMap
          mapContainerClassName="w-full h-full"
          center={currentMarker || KPS_CENTER}
          zoom={16}
          onClick={onMapClick}
          options={{
            mapTypeId: 'hybrid',
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {aedList.map((aed) => {
            const position = parseCoordinates(String(aed.lat ?? ''), String(aed.lng ?? ''));
            if (!position) return null;

            return (
              <Marker
                key={aed.id}
                position={position}
                label="AED"
                onClick={() => onEdit(aed)}
              />
            );
          })}
          {currentMarker && <Marker position={currentMarker} label="NEW" />}
        </GoogleMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
          กำลังโหลดแผนที่...
        </div>
      )}
    </div>
  );
}

// แสดงจำนวนและรายการตำแหน่ง AED พร้อมข้อความกรณียังไม่มีข้อมูล
function AEDListPanel({ aedList, onEdit, onDelete }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">
        รายการตำแหน่ง AED ทั้งหมด ({aedList.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
        {aedList.map((aed) => (
          <AEDListItem
            key={aed.id}
            aed={aed}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {aedList.length === 0 && (
          <p className="text-center text-slate-400 py-8 col-span-2 font-medium">
            ยังไม่มีข้อมูล AED ในระบบ
          </p>
        )}
      </div>
    </section>
  );
}

// ประสานข้อมูล Firebase, state ของฟอร์ม และการทำงานของแผนที่กับรายการ
export default function AEDManager() {
  const [aedList, setAedList] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // สมัครรับข้อมูลตำแหน่ง AED แบบ real-time และยกเลิก subscription เมื่อออกจากหน้า
  useEffect(() => {
    const aedRef = ref(db, AED_PATH);
    const unsubscribe = onValue(aedRef, (snapshot) => {
      setAedList(toAEDList(snapshot.val()));
    });

    return unsubscribe;
  }, []);

  // คืนฟอร์มและโหมดแก้ไขสู่ค่าเริ่มต้น
  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM_STATE);
    setEditingId(null);
  }, []);

  // เปลี่ยนค่าฟิลด์ในฟอร์มโดยคงค่าฟิลด์อื่นไว้
  const handleChange = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  // คลิกแผนที่เพื่อกรอกพิกัดลงในฟอร์ม
  const handleMapClick = useCallback((event) => {
    if (!event.latLng) return;

    setForm((currentForm) => ({
      ...currentForm,
      lat: event.latLng.lat().toString(),
      lng: event.latLng.lng().toString(),
    }));
  }, []);

  // เติมข้อมูลรายการที่เลือกลงฟอร์มและเปิดโหมดแก้ไข
  const handleEdit = (aed) => {
    setEditingId(aed.id);
    setForm(toAEDFormState(aed));
  };

  // ยืนยันก่อนลบรายการ แล้วแจ้งเมื่อ Firebase ไม่สามารถลบข้อมูลได้
  const handleDelete = async (id) => {
    if (!window.confirm('ต้องการลบตำแหน่ง AED นี้ใช่หรือไม่?')) return;

    try {
      await remove(ref(db, `${AED_PATH}/${id}`));
    } catch (error) {
      console.error('ลบตำแหน่ง AED ไม่สำเร็จ:', error);
      window.alert('ลบข้อมูลไม่สำเร็จ');
    }
  };

  // ตรวจสอบข้อมูลและเพิ่มหรือแก้ไขรายการใน Firebase
  const handleSubmit = async (event) => {
    event.preventDefault();

    const coordinates = parseCoordinates(form.lat, form.lng);
    if (!form.name.trim() || !coordinates) {
      window.alert('กรุณากรอกชื่อ และเลือกตำแหน่งบนแผนที่');
      return;
    }

    setSaving(true);
    try {
      const payload = createAEDPayload(form, coordinates);

      if (editingId) {
        await update(ref(db, `${AED_PATH}/${editingId}`), payload);
      } else {
        const newRef = push(ref(db, AED_PATH));
        await set(newRef, {
          ...payload,
          id: newRef.key,
          createdAt: Date.now(),
        });
      }

      resetForm();
    } catch (error) {
      console.error('บันทึกข้อมูล AED ไม่สำเร็จ:', error);
      window.alert('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // คำนวณพิกัดหมุดปัจจุบันจากค่าที่กรอก โดยไม่สร้าง marker หากพิกัดไม่สมบูรณ์
  const currentMarker = useMemo(
    () => parseCoordinates(form.lat, form.lng),
    [form.lat, form.lng],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <AEDForm
        form={form}
        editing={Boolean(editingId)}
        saving={saving}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={resetForm}
      />

      <div className="lg:col-span-2 flex flex-col gap-4">
        <AEDMap
          isLoaded={isLoaded}
          aedList={aedList}
          currentMarker={currentMarker}
          onMapClick={handleMapClick}
          onEdit={handleEdit}
        />
        <AEDListPanel
          aedList={aedList}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}