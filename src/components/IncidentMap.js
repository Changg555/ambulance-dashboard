import React, { useEffect, useMemo, useState } from 'react';
import {
  Circle,
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api';
import { onValue, ref } from 'firebase/database';
import { db } from '../config/firebase';

// ค่ากลางเริ่มต้นและสถานะที่ใช้ร่วมกันในแผนที่
const KPS_CENTER = { lat: 14.0280249, lng: 99.9806146 };
const SERVICE_AREA_PATH = 'service_area';
const DEFAULT_SERVICE_RADIUS = 1300;
const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};
const STATUS_CONFIG = {
  pending: { color: '#EF4444', label: 'รอดำเนินการ' },
  accepted: { color: '#F59E0B', label: 'รับเคสแล้ว' },
  en_route: { color: '#3B82F6', label: 'กำลังเดินทาง' },
  arrived: { color: '#8B5CF6', label: 'ถึงจุดเกิดเหตุ' },
  completed: { color: '#10B981', label: 'เสร็จสิ้น' },
};
const FALLBACK_MARKER_COLOR = '#94A3B8';

// รวมชื่อสถานะเดิมให้ใช้รหัสสถานะมาตรฐานเดียวกัน
function normalizeStatus(status) {
  if (status === 'on_the_way') return 'en_route';
  return status || 'pending';
}

// แปลงพิกัดเป็นตัวเลข และปฏิเสธค่าที่ไม่ใช่พิกัดที่ถูกต้อง
function getCoordinates(location) {
  if (
    location?.lat === null ||
    location?.lat === undefined ||
    location?.lng === null ||
    location?.lng === undefined ||
    location.lat === '' ||
    location.lng === ''
  ) {
    return null;
  }

  const lat = Number(location?.lat);
  const lng = Number(location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

// คืนพิกัดกึ่งกลางพื้นที่ให้บริการ หรือใช้จุดเริ่มต้นเมื่อไม่มีค่าที่ถูกต้อง
function getServiceCenter(serviceArea) {
  const center = getCoordinates(serviceArea?.center);
  return center || KPS_CENTER;
}

// สร้างไอคอนหมุด SVG โดยทำหมุดสีเทาและมีเครื่องหมายเตือนเมื่อนอกพื้นที่
function createMarkerIcon(color, isOutside) {
  const markerColor = isOutside ? FALLBACK_MARKER_COLOR : color;
  const warning = isOutside
    ? '<text x="16" y="20" text-anchor="middle" font-size="10" font-weight="bold" fill="#1E293B">!</text>'
    : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z" fill="${markerColor}" stroke="white" stroke-width="2" />
      <circle cx="16" cy="16" r="7" fill="white" />
      ${warning}
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 40),
    anchor: new window.google.maps.Point(16, 40),
  };
}

// แสดงป้ายสถานะของเหตุการณ์ใน InfoWindow
function IncidentStatus({ status }) {
  const normalizedStatus = normalizeStatus(status);
  const label = STATUS_CONFIG[normalizedStatus]?.label || status || 'ไม่ระบุสถานะ';

  return (
    <p className="text-[11px] font-bold text-red-500 bg-red-50 inline-block px-2 py-0.5 rounded-md mb-2">
      {label}
    </p>
  );
}

// แสดงว่าจุดเกิดเหตุอยู่ในพื้นที่ให้บริการหรืออยู่นอกพื้นที่
function ServiceAreaStatus({ isInside }) {
  if (isInside === null || isInside === undefined) return null;

  const isCovered = isInside === true;
  return (
    <p
      className={`text-[11px] font-bold flex items-center gap-1 ${
        isCovered ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {isCovered ? '✓ อยู่ในพื้นที่ให้บริการ' : '⚠️ อยู่นอกพื้นที่ให้บริการ'}
    </p>
  );
}

// แสดงรายละเอียดเหตุการณ์และตำแหน่งในหน้าต่างข้อมูลของหมุด
function IncidentInfoWindow({ incident, onClose }) {
  const position = getCoordinates(incident.location);

  if (!position) return null;

  return (
    <InfoWindow position={position} onCloseClick={onClose}>
      <div className="p-1 min-w-[200px] font-sans">
        <p className="font-bold text-slate-800 text-sm mb-1">
          {incident.type || 'เหตุฉุกเฉิน'}
        </p>
        <IncidentStatus status={incident.status} />
        <div className="mb-2">
          <ServiceAreaStatus isInside={incident.isInsideServiceArea} />
        </div>
        <p className="text-slate-600 text-xs font-medium leading-relaxed mt-1">
          📍 {incident.location?.address || 'ไม่ทราบตำแหน่ง'}
        </p>
        {incident.description && (
          <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <p className="text-slate-500 text-xs italic">"{incident.description}"</p>
          </div>
        )}
        <p className="text-slate-400 text-xs mt-2 font-mono">
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      </div>
    </InfoWindow>
  );
}

// วาดหมุดเหตุการณ์ตามสถานะ พร้อมยกหมุดที่เลือกขึ้นมาแสดงด้านหน้า
function IncidentMarkers({ incidents, selectedId, onMarkerClick }) {
  return incidents.map((incident) => {
    const status = normalizeStatus(incident.status);
    const color = STATUS_CONFIG[status]?.color || FALLBACK_MARKER_COLOR;
    const position = getCoordinates(incident.location);
    const isSelected = selectedId === incident.id;
    const isOutside = incident.isInsideServiceArea === false;

    return (
      <Marker
        key={incident.id}
        position={position}
        icon={createMarkerIcon(color, isOutside)}
        zIndex={isSelected ? 100 : 1}
        onClick={() => onMarkerClick?.(incident.id)}
      />
    );
  });
}

// โหลดพื้นที่ให้บริการและเหตุการณ์ แล้วประกอบเป็นแผนที่พร้อมวงรัศมีและ InfoWindow
export default function IncidentMap({
  incidents = [],
  selectedId,
  onMarkerClick,
}) {
  const [serviceArea, setServiceArea] = useState(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // สมัครรับข้อมูลพื้นที่ให้บริการจาก Firebase และยกเลิกเมื่อออกจากหน้า
  useEffect(() => {
    const areaRef = ref(db, SERVICE_AREA_PATH);
    return onValue(areaRef, (snapshot) => {
      setServiceArea(snapshot.val());
    });
  }, []);

  // คำนวณจุดศูนย์กลางและกรองเหตุการณ์ที่มีพิกัดถูกต้อง
  const serviceCenter = useMemo(
    () => getServiceCenter(serviceArea),
    [serviceArea],
  );
  const validIncidents = useMemo(
    () => incidents.filter((incident) => getCoordinates(incident?.location)),
    [incidents],
  );
  const selectedIncident = useMemo(
    () => validIncidents.find((incident) => incident.id === selectedId),
    [validIncidents, selectedId],
  );

  // แสดงสถานะโหลดจนกว่า Google Maps API จะพร้อมใช้งาน
  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName="w-full h-full"
      center={serviceCenter}
      zoom={16}
      options={MAP_OPTIONS}
    >
      {/* วาดวงรัศมีเมื่อเปิดใช้งานพื้นที่ให้บริการ */}
      {serviceArea?.enabled && (
        <Circle
          center={serviceCenter}
          radius={Number(serviceArea.radius) || DEFAULT_SERVICE_RADIUS}
          options={{
            strokeColor: '#EF4444',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillOpacity: 0,
          }}
        />
      )}

      {/* แสดงหมุดเหตุการณ์ทั้งหมดที่มีพิกัดถูกต้อง */}
      <IncidentMarkers
        incidents={validIncidents}
        selectedId={selectedId}
        onMarkerClick={onMarkerClick}
      />

      {/* แสดงข้อมูลเหตุการณ์เมื่อเลือกหมุด */}
      {selectedIncident && (
        <IncidentInfoWindow
          incident={selectedIncident}
          onClose={() => onMarkerClick?.(null)}
        />
      )}
    </GoogleMap>
  );
}
