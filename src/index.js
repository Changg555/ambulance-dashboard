// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LoadScript } from '@react-google-maps/api';

// โหลด Google Maps และ libraries ที่จำเป็นครั้งเดียวที่นี่
// ห้ามใช้ useJsApiLoader หรือ LoadScript ใน component อื่นอีก
const LIBRARIES = ['marker'];

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LoadScript
      googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_KEY}
      libraries={LIBRARIES}
      version="weekly"
      loadingElement={<div />}
    >
      <App />
    </LoadScript>
  </React.StrictMode>
);