import React, { useEffect, useState } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { db } from '../config/firebase';

const KPS_CENTER = { lat: 14.0280249, lng: 99.9806146 };

const emptyForm = {
  name: '',
  description: '',
  lat: '',
  lng: '',
  status: 'available',
};

export default function AEDManager() {
  const [aedList, setAedList] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const aedRef = ref(db, 'aed_locations');

    const unsub = onValue(aedRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      setAedList(list);
    });

    return () => unsub();
  }, []);

  const handleMapClick = (e) => {
    setForm((prev) => ({
      ...prev,
      lat: e.latLng.lat().toString(),
      lng: e.latLng.lng().toString(),
    }));
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.lat || !form.lng) {
      alert('กรุณากรอกชื่อ และเลือกตำแหน่งบนแผนที่');
      return;
    }

    const lat = Number(form.lat);
    const lng = Number(form.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Latitude และ Longitude ต้องเป็นตัวเลข');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name,
        description: form.description,
        lat,
        lng,
        status: form.status,
        updatedAt: Date.now(),
      };

      if (editingId) {
        await update(ref(db, `aed_locations/${editingId}`), payload);
      } else {
        const newRef = push(ref(db, 'aed_locations'));
        await set(newRef, {
          ...payload,
          id: newRef.key,
          createdAt: Date.now(),
        });
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (aed) => {
    setEditingId(aed.id);
    setForm({
      name: aed.name || '',
      description: aed.description || '',
      lat: aed.lat || '',
      lng: aed.lng || '',
      status: aed.status || 'available',
    });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('ต้องการลบตำแหน่ง AED นี้ใช่หรือไม่?');
    if (!ok) return;

    await remove(ref(db, `aed_locations/${id}`));
  };

  const currentMarker =
    form.lat && form.lng
      ? { lat: Number(form.lat), lng: Number(form.lng) }
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-800">
          {editingId ? 'แก้ไขตำแหน่ง AED' : 'เพิ่มตำแหน่ง AED'}
        </h2>

        <p className="text-sm text-gray-500 mb-4">
          คลิกบนแผนที่เพื่อเลือกตำแหน่ง AED
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="ชื่อจุดติดตั้ง AED"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />

          <textarea
            className="w-full border rounded-lg px-3 py-2 resize-none"
            rows="3"
            placeholder="รายละเอียดสถานที่ เช่น ชั้น 1 หน้าเคาน์เตอร์"
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Latitude"
              value={form.lat}
              onChange={(e) => handleChange('lat', e.target.value)}
            />

            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Longitude"
              value={form.lng}
              onChange={(e) => handleChange('lng', e.target.value)}
            />
          </div>

          <select
            className="w-full border rounded-lg px-3 py-2"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="available">ใช้งานได้</option>
            <option value="maintenance">ชำรุด / ปิดซ่อม</option>
          </select>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-red-700 hover:bg-red-800 text-white rounded-lg py-2.5 font-semibold disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่ม AED'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2"
            >
              ยกเลิกแก้ไข
            </button>
          )}
        </form>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[420px]">
          <GoogleMap
            mapContainerClassName="w-full h-full"
            center={currentMarker || KPS_CENTER}
            zoom={16}
            onClick={handleMapClick}
            options={{
              mapTypeId: 'hybrid',
              streetViewControl: false,
              mapTypeControl: false,
            }}
          >
            {aedList.map((aed) => (
              <Marker
                key={aed.id}
                position={{ lat: Number(aed.lat), lng: Number(aed.lng) }}
                label="AED"
                onClick={() => handleEdit(aed)}
              />
            ))}

            {currentMarker && (
              <Marker
                position={currentMarker}
                label="NEW"
              />
            )}
          </GoogleMap>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            รายการตำแหน่ง AED ({aedList.length})
          </h2>

          <div className="space-y-3">
            {aedList.map((aed) => (
              <div
                key={aed.id}
                className="border rounded-xl p-4 flex items-start gap-4"
              >
                <div className="text-2xl">⚡</div>

                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{aed.name}</p>
                  <p className="text-sm text-gray-500">{aed.description}</p>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    {aed.lat}, {aed.lng}
                  </p>

                  <span
                    className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                      aed.status === 'maintenance'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {aed.status === 'maintenance' ? 'ชำรุด' : 'ใช้งานได้'}
                  </span>
                </div>

                <button
                  onClick={() => handleEdit(aed)}
                  className="text-xs bg-gray-100 px-3 py-2 rounded-lg"
                >
                  แก้ไข
                </button>

                <button
                  onClick={() => handleDelete(aed.id)}
                  className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg"
                >
                  ลบ
                </button>
              </div>
            ))}

            {aedList.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                ยังไม่มีข้อมูล AED
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}