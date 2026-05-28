import React, { useEffect, useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Circle,
  useJsApiLoader,
} from "@react-google-maps/api";

import { ref, onValue } from "firebase/database";
import { db } from "../config/firebase";

const KPS_CENTER = {
  lat: 14.0280249,
  lng: 99.9806146,
};

const STATUS_COLORS = {
  pending: "#DC2626",
  accepted: "#EA580C",
  on_the_way: "#2563EB",
  arrived: "#7C3AED",
  completed: "#16A34A",
};

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  accepted: "รับเคสแล้ว",
  on_the_way: "กำลังเดินทาง",
  arrived: "ถึงจุดเกิดเหตุ",
  completed: "เสร็จสิ้น",
};

function makeMarkerIcon(color, isOutside) {
  const finalColor = isOutside ? "#6B7280" : color;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path
        d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z"
        fill="${finalColor}"
        stroke="white"
        stroke-width="2"
      />
      <circle cx="16" cy="16" r="7" fill="white"/>
      ${
        isOutside
          ? `<text x="16" y="20" text-anchor="middle" font-size="10" font-weight="bold" fill="#111827">!</text>`
          : ""
      }
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 40),
    anchor: new window.google.maps.Point(16, 40),
  };
}

export default function IncidentMap({
  incidents,
  selectedId,
  onMarkerClick,
}) {
  const [serviceArea, setServiceArea] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    const areaRef = ref(db, "service_area");

    const unsub = onValue(areaRef, (snapshot) => {
      setServiceArea(snapshot.val());
    });

    return () => unsub();
  }, []);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-xl">
        <p className="text-gray-500 text-sm">
          กำลังโหลดแผนที่...
        </p>
      </div>
    );
  }

  const serviceCenter = {
    lat: Number(serviceArea?.center?.lat || KPS_CENTER.lat),
    lng: Number(serviceArea?.center?.lng || KPS_CENTER.lng),
  };

  const validIncidents = incidents.filter(
    (inc) => inc.location?.lat && inc.location?.lng
  );

  const selectedIncident = validIncidents.find(
    (inc) => inc.id === selectedId
  );

  return (
    <GoogleMap
      mapContainerClassName="w-full h-full"
      center={serviceCenter}
      zoom={16}
      options={{
        mapTypeId: "hybrid",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {serviceArea && serviceArea.enabled && (
        <Circle
          center={serviceCenter}
          radius={Number(serviceArea?.radius || 1300)}
          options={{
            strokeColor: "#DC2626",
            strokeOpacity: 1,
            strokeWeight: 2,
            fillOpacity: 0,
          }}
        />
      )}

      {validIncidents.map((inc) => {
        const color = STATUS_COLORS[inc.status] || "#888";
        const isSelected = selectedId === inc.id;
        const isOutside = inc.isInsideServiceArea === false;

        return (
          <Marker
            key={inc.id}
            position={{
              lat: Number(inc.location.lat),
              lng: Number(inc.location.lng),
            }}
            icon={makeMarkerIcon(color, isOutside)}
            zIndex={isSelected ? 100 : 1}
            onClick={() => onMarkerClick(inc.id)}
          />
        );
      })}

      {selectedIncident && (
        <InfoWindow
          position={{
            lat: Number(selectedIncident.location.lat),
            lng: Number(selectedIncident.location.lng),
          }}
          onCloseClick={() => onMarkerClick(null)}
        >
          <div className="text-sm min-w-[180px]">
            <p className="font-bold text-gray-800 mb-1">
              {selectedIncident.type || "เหตุฉุกเฉิน"}
            </p>

            <p className="text-xs text-red-700 font-semibold mb-1">
              {STATUS_LABELS[selectedIncident.status] ||
                selectedIncident.status}
            </p>

            {selectedIncident.isInsideServiceArea === true && (
              <p className="text-xs text-green-700 font-semibold mb-1">
                อยู่ในพื้นที่ให้บริการ
              </p>
            )}

            {selectedIncident.isInsideServiceArea === false && (
              <p className="text-xs text-red-700 font-semibold mb-1">
                อยู่นอกพื้นที่ให้บริการ
              </p>
            )}

            <p className="text-gray-600 text-xs">
              {selectedIncident.location?.address ||
                "ไม่ทราบตำแหน่ง"}
            </p>

            {selectedIncident.description && (
              <p className="text-gray-500 text-xs mt-1">
                {selectedIncident.description}
              </p>
            )}

            <p className="text-gray-400 text-xs mt-2 font-mono">
              {Number(selectedIncident.location.lat).toFixed(5)},{" "}
              {Number(selectedIncident.location.lng).toFixed(5)}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}