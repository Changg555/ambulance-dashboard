import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { INCIDENT_TYPES, STATUS_COLORS, STATUS_LABELS } from "../constants/incident";

// ค่ากลางเริ่มต้น (สถานพยาบาล ม.เกษตรฯ กำแพงแสน) และสถานะที่ใช้ร่วมกันในแผนที่
const KPS_CENTER = { lat: 14.028746607870978, lng: 99.97823358223988 };
const DEFAULT_SERVICE_RADIUS = 1300;
const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};
const FALLBACK_MARKER_COLOR = '#94A3B8';

// แปลงพิกัดเป็นตัวเลข รองรับทั้ง latitude/longitude (Mobile) และ lat/lng
function getCoordinates(location) {
  const rawLat = location?.latitude ?? location?.lat;
  const rawLng = location?.longitude ?? location?.lng;

  if (
    rawLat === null ||
    rawLat === undefined ||
    rawLng === null ||
    rawLng === undefined ||
    rawLat === '' ||
    rawLng === ''
  ) {
    return null;
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;

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
  const currentStatus = status || 'pending';
  const label = STATUS_LABELS[currentStatus] || status || 'ไม่ระบุสถานะ';

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
  const address = incident.address || incident.location?.address || 'ไม่ทราบตำแหน่ง';

  if (!position) return null;

  return (
    <InfoWindow position={position} onCloseClick={onClose}>
      <div className="p-1 min-w-[200px] font-sans">
        <p className="font-bold text-slate-800 text-sm mb-1">
          {INCIDENT_TYPES[incident.type]?.label || incident.type || 'เหตุฉุกเฉิน'}
        </p>
        <IncidentStatus status={incident.status} />
        {incident.reporter && (
          <p className="text-slate-700 text-xs font-medium mb-1">
            👤 {incident.reporter.name} {incident.reporter.phone ? `(${incident.reporter.phone})` : ''}
          </p>
        )}
        <div className="mb-2">
          <ServiceAreaStatus isInside={incident.isInsideServiceArea} />
        </div>
        <p className="text-slate-600 text-xs font-medium leading-relaxed mt-1">
          {address}
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
    const status = incident.status || 'pending';
    const color = STATUS_COLORS[status] || FALLBACK_MARKER_COLOR;
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
  const [mapCenter, setMapCenter] = useState(KPS_CENTER);
  const [mapInstance, setMapInstance] = useState(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const initialCenteredRef = useRef(false);
  const lastTopIncidentIdRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  // สมัครรับข้อมูลพื้นที่ให้บริการจาก Firestore (doc(db, "settings", "serviceArea")) ตามฝั่ง Mobile
  useEffect(() => {
    const areaRef = doc(db, 'settings', 'serviceArea');
    return onSnapshot(areaRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setServiceArea(data);
      const center = getServiceCenter(data);
      if (!lastTopIncidentIdRef.current) {
        setMapCenter(center);
      }
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

  const panToCoord = useCallback((coord, zoomLevel = 17) => {
    if (!coord) return;
    setMapCenter(coord);
    if (mapRef.current) {
      mapRef.current.panTo(coord);
      if (zoomLevel) {
        mapRef.current.setZoom(zoomLevel);
      }
    }
  }, []);

  // เมื่อคลิกเลือกเคส ให้เลื่อนแผนที่ไปยังตำแหน่งเกิดเหตุของเคสนั้นทันที
  useEffect(() => {
    if (!selectedIncident) return;
    const pos = getCoordinates(selectedIncident.location);
    if (pos) {
      panToCoord(pos, 17);
    }
  }, [selectedIncident, panToCoord]);

  // เมื่อมีเคสใหม่เข้ามา หรือโหลดเคสครั้งแรก ให้เลื่อนแผนที่ไปยังจุดเกิดเหตุล่าสุดอัตโนมัติ
  useEffect(() => {
    if (validIncidents.length === 0) return;
    const newest = validIncidents[0];
    if (lastTopIncidentIdRef.current !== newest.id) {
      lastTopIncidentIdRef.current = newest.id;
      const pos = getCoordinates(newest.location);
      if (pos) {
        panToCoord(pos, 17);
      }
    }
  }, [validIncidents, panToCoord]);

  const handleMapLoad = useCallback(
    (map) => {
      mapRef.current = map;
      setMapInstance(map);
      if (!initialCenteredRef.current) {
        initialCenteredRef.current = true;
        if (validIncidents.length > 0) {
          const firstPos = getCoordinates(validIncidents[0].location);
          if (firstPos) {
            setMapCenter(firstPos);
            map.setCenter(firstPos);
            map.setZoom(17);
            return;
          }
        }
        setMapCenter(serviceCenter);
        map.setCenter(serviceCenter);
        map.setZoom(16);
      }
    },
    [validIncidents, serviceCenter]
  );

  // สร้างและอัปเดตวงกลมพื้นที่ให้บริการเพียงวงเดียว (ป้องกันวงกลมเก่าค้างบนแผนที่เมื่อเปลี่ยนพื้นที่)
  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;

    const circle = new window.google.maps.Circle({
      strokeColor: '#EF4444',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillOpacity: 0,
      clickable: false,
      map: serviceArea?.enabled !== false && serviceArea?.center ? mapInstance : null,
      center: serviceCenter,
      radius: Number(serviceArea?.radius) || DEFAULT_SERVICE_RADIUS,
    });
    circleRef.current = circle;

    return () => {
      circle.setMap(null);
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance]);

  useEffect(() => {
    if (!circleRef.current) return;
    const isVisible = serviceArea?.enabled !== false && Boolean(serviceArea?.center);
    circleRef.current.setCenter(serviceCenter);
    circleRef.current.setRadius(Number(serviceArea?.radius) || DEFAULT_SERVICE_RADIUS);
    circleRef.current.setMap(isVisible ? mapInstance : null);
  }, [mapInstance, serviceArea, serviceCenter]);

  const goToMyBrowserLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        panToCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17);
      },
      () => {
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่งของเบราว์เซอร์');
      },
      { enableHighAccuracy: true }
    );
  };

  // แสดงสถานะโหลดจนกว่า Google Maps API จะพร้อมใช้งาน
  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
        <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={mapCenter}
        zoom={16}
        onLoad={handleMapLoad}
        onUnmount={() => {
          mapRef.current = null;
          setMapInstance(null);
        }}
        options={MAP_OPTIONS}
      >
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

      {/* ปุ่มลัดควบคุมตำแหน่งแผนที่ */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
        {validIncidents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const target = selectedIncident || validIncidents[0];
              const pos = getCoordinates(target?.location);
              if (pos) panToCoord(pos, 17);
            }}
            className="bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl shadow-md border border-slate-200 transition-all"
          >
           ไปที่จุดเกิดเหตุ ({validIncidents.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => panToCoord(serviceCenter, 15)}
          className="bg-white/95 hover:bg-white text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-md border border-slate-200 transition-all"
        >
          ศูนย์กลางพื้นที่บริการ
        </button>
        <button
          type="button"
          onClick={goToMyBrowserLocation}
          className="bg-white/95 hover:bg-white text-red-600 text-xs font-bold px-3 py-2 rounded-xl shadow-md border border-slate-200 transition-all"
        >
          ตำแหน่งปัจจุบันของฉัน
        </button>
      </div>
    </div>
  );
}
