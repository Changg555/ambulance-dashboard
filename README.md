# 🚑 KPS Ambulance Emergency Dispatcher Dashboard
### ระบบศูนย์รับแจ้งและบริหารจัดการการแพทย์ฉุกเฉิน มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน

เว็บแอปพลิเคชันศูนย์สั่งการและควบคุมระบบการแพทย์ฉุกเฉิน พัฒนาด้วย **React 19 + Tailwind CSS + Google Maps API + Firebase** สำหรับเจ้าหน้าที่ศูนย์วิทยุและผู้บริหาร เพื่อการมอนิเตอร์เหตุฉุกเฉินแบบ Real-time, สั่งการรถพยาบาล, จัดการพื้นที่บริการ, ควบคุมตู้ AED และวิเคราะห์ข้อมูลสถิติ

---

## 🌟 ฟีเจอร์เด่น (Key Features)

### 1. 🚨 ระบบมอนิเตอร์และเสียงไซเรนแจ้งเตือนภัยสด (Live Emergency Alert)
- ป๊อปอัปแจ้งเตือนภัยระดับสูงสุดเด้งขึ้นทันทีที่มีเคสใหม่สถานะ `pending` (รอเจ้าหน้าที่รับเรื่อง) ทับหน้าจอทุกแท็บ
- **เสียงไซเรนเตือนภัยแบบวนซ้ำ (`alert.mp3`)** ดังต่อเนื่องจนกว่าเจ้าหน้าที่จะกด **"รับทราบเคส"**
- ออกแบบ UI เด่นชัดเป็นพิเศษ เน้น **ประเภทเหตุฉุกเฉิน** (ไอคอนและสีกรอบเฉพาะ) และ **ระดับความรุนแรง** (ไฟกระพริบฉุกเฉินเมื่อเป็นเคสวิกฤต)
- รองรับปุ่มปิด/เปิดเสียงชั่วคราวขณะสนทนาสายกับผู้แจ้งเหตุ

### 2. 🚑 ขั้นตอนปฏิบัติการสั่งการรถพยาบาล (Single Step Workflow)
- ปุ่มเปลี่ยนสถานะขั้นตอนเดียวแบบไดนามิกบนการ์ดเคส:
  $$\text{รอรับเรื่อง} \longrightarrow \text{รับเคส} \longrightarrow \text{กำลังเดินทาง} \longrightarrow \text{ถึงจุดเกิดเหตุ} \longrightarrow \text{เสร็จสิ้น}$$
- บันทึกข้อมูลเจ้าหน้าที่ผู้รับผิดชอบและเลขทะเบียนรถกู้ชีพ (`assignedTo`) ลงในเคส และส่งสัญญาณอัปเดตไปยังแอปมือถือของประชาชนทันที

### 3. 🗺️ แผนที่ตอบสนองแบบสด (Interactive Google Maps)
- ปักหมุดเคสแยกสีตามระดับความรุนแรง (แดง = วิกฤต, ส้ม = รุนแรง, เหลือง = ปานกลาง, เขียว = ไม่รุนแรง)
- แสดงเส้นขอบเขตพื้นที่ให้บริการ (Service Area Geofencing Circle)
- แสดงพิกัดตู้กระตุกหัวใจไฟฟ้า (AED) ทั่ววิทยาเขต และคำนวณเส้นทางนำทางไปยังจุดเกิดเหตุ

### 4. 📊 แดชบอร์ดวิเคราะห์สถิติผู้บริหาร (Executive Analytics Dashboard)
- แสดงตัวชี้วัดหลัก (KPIs): ยอดเคสรวม, อัตราความสำเร็จ (%), เคสที่กำลังทำ, และเวลาตอบสนองเฉลี่ย (นาที)
- สรุปสัดส่วนตามระดับความรุนแรง และสถิติตามประเภทเหตุการณ์
- แผนที่สถิติจุดเกิดเหตุ (Incident Heatmap) และตารางสรุปแนวโน้มรายวัน
- **ปุ่มส่งออกรายงานสรุปสถิติ (Analytics CSV)**: ส่งออกรายงานระดับผู้บริหารแบ่งเป็น 4 หมวดหมู่ ครอบคลุมทุกมิติในคลิกเดียว

### 5. 📜 ประวัติการออกเหตุและการตรวจสอบย้อนหลัง (History & Audit Logs)
- ค้นหาและกรองเคสย้อนหลังตามช่วงเวลา, ประเภทเหตุ และสถานะ
- **ปุ่มส่งออกรายงานประวัติรายเคส (Case Logs CSV)**: สรุปข้อมูลรายแถวอย่างละเอียด (ชื่อผู้แจ้ง, เบอร์โทร, พิกัด GPS, รถที่ไปรับ, เวลาเริ่ม-เสร็จสิ้น) สำหรับงานธุรการ

### 6. 🫀 ระบบจัดการตู้กระตุกหัวใจ (AED Manager)
- คลิกปักหมุดบนแผนที่เพื่อเพิ่มพิกัดตู้ AED ใหม่ แก้ไขชื่ออาคาร/ชั้นที่ติดตั้ง และบันทึกสถานะความพร้อมใช้งาน

### 7. 📍 ระบบกำหนดพื้นที่ให้บริการ (Service Area Manager)
- กำหนดพิกัดจุดศูนย์กลางและปรับรัศมีพื้นที่ครอบคลุม (เป็นเมตร) แบบสดบนแผนที่ พร้อมสูตรคำนวณระยะห่างอัตโนมัติ

### 8. 👥 ระบบจัดการและอนุมัติเจ้าหน้าที่ (User Management)
- สำหรับ Admin: ตรวจสอบรายชื่อเจ้าหน้าที่ที่สมัครเข้ามาใหม่, กดอนุมัติเปิดใช้งาน (`active`), กำหนดบทบาท (`staff` หรือ `admin`) หรือระงับสิทธิ์

### 9. 🛡️ ความปลอดภัยข้อมูลส่วนบุคคลตามมาตรฐาน PDPA
- เลขประจำตัวประชาชน 13 หลักของผู้แจ้งเหตุถูกเข้ารหัส End-to-End ด้วย TweetNaCl
- ถอดรหัสในหน่วยความจำ RAM ชั่วคราว และมีระบบนับถอยหลัง 30 วินาทีเพื่อซ่อนข้อมูลอัตโนมัติ พร้อมบันทึกประวัติ Audit Log การเปิดดูข้อมูลทุกครั้ง

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend Framework**: React 19, React Scripts
- **Styling**: Tailwind CSS
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`
- **Backend & Database**: Firebase Cloud Firestore, Firebase Authentication, Firebase Storage
- **Cryptography**: TweetNaCl, TweetNaCl-Util, Pure JS RFC 7914 Scrypt

---

## 🚀 การติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. โคลนโปรเจกต์
```bash
git clone https://github.com/Changg555/ambulance-dashboard.git
cd ambulance-dashboard
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment Variables
สร้างไฟล์ `.env` ที่โฟลเดอร์ราก (Root) และระบุค่า Firebase & Google Maps:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=kps-ambulance-5308f.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=kps-ambulance-5308f
REACT_APP_FIREBASE_STORAGE_BUCKET=kps-ambulance-5308f.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 4. สั่งรันแอปพลิเคชัน
```bash
# รัน Development Server
npm start

# สร้าง Production Build
npm run build
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
ambulance_dashboard/
├── public/                     # ไฟล์ Static (alert.mp3, favicon, index.html)
├── src/
│   ├── config/
│   │   └── firebase.js         # การเชื่อมต่อ Firebase
│   ├── hooks/
│   │   └── useIncidents.js     # State กลางและ Real-time Firestore Listener
│   ├── utils/
│   │   └── idcardAdmin.js      # ถอดรหัสเลขบัตรประชาชน PDPA (NaCl + Scrypt)
│   ├── components/             # คอมโพเนนต์หน้าจอทั้งหมด
│   │   ├── LoginScreen.js          # หน้าล็อกอิน/สมัครสมาชิกเจ้าหน้าที่
│   │   ├── DashboardContent.js     # Layout Shell และแท็บเมนู
│   │   ├── EmergencyAlertModal.js  # ป๊อปอัปแจ้งเตือนสด + ไซเรนเตือนภัย
│   │   ├── IncidentCard.js         # การ์ดเคสและปุ่มเปลี่ยนสถานะ Workflow
│   │   ├── IncidentMap.js          # แผนที่ Google Maps มอนิเตอร์เหตุ
│   │   ├── StatsBar.js             # แถบสรุปด่วน 4 ตัวชี้วัด
│   │   ├── HistoryPage.js          # ประวัติการออกเหตุ + ส่งออก CSV รายเคส
│   │   ├── AnalyticsDashboard.js   # สถิติภาพรวม + ส่งออก CSV ผู้บริหาร
│   │   ├── AEDManager.js           # จัดการพิกัดตู้ AED
│   │   ├── ServiceAreaManager.js   # จัดการพื้นที่บริการ Geofencing
│   │   ├── UserManagement.js       # จัดการบัญชีและอนุมัติเจ้าหน้าที่
│   │   └── ReporterDetailModal.js  # ป๊อปอัปดูข้อมูลผู้แจ้งและถอดรหัสเลขบัตร
│   ├── App.js                  # Authentication & Role Guard
│   └── index.js                # React Root Entry Point
├── firestore.rules             # กฎความปลอดภัยของฐานข้อมูล Firestore
└── package.json
```

---

## 📄 License
ระบบนี้จัดทำขึ้นเพื่อการศึกษาและการปฏิบัติการช่วยเหลือฉุกเฉิน มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน
