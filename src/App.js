import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db, isRegisteringStaff } from './config/firebase';

import LoginScreen from './components/LoginScreen';
import DashboardContent from './components/DashboardContent';
import { clearAdminSecretKeyFromMemory } from './components/ReporterDetailModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (isRegisteringStaff()) {
          return;
        }

        if (!currentUser) {
          clearAdminSecretKeyFromMemory();
          setUser(null);
          setProfile(null);
          setRole(null);
          setCheckingAuth(false);
          return;
        }

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() : null;
        const userRole = userData?.role;

        // 1. ตรวจสอบว่า role เป็น 'admin' หรือ 'staff'
        if (userRole !== 'staff' && userRole !== 'admin') {
          await signOut(auth);
          alert('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน Dashboard');
          setUser(null);
          setProfile(null);
          setRole(null);
          setCheckingAuth(false);
          return;
        }

        // 2. ตรวจสอบสถานะการอนุมัติ (admin อนุมัติอัตโนมัติยกเว้นถูกระงับ active === false, ส่วน staff ต้อง active === true เท่านั้น)
        const isApproved =
          userRole === 'admin'
            ? userData?.active !== false
            : userData?.active === true;

        if (!isApproved) {
          await signOut(auth);
          alert('บัญชีอยู่ระหว่างรอ Admin อนุมัติ');
          setUser(null);
          setProfile(null);
          setRole(null);
          setCheckingAuth(false);
          return;
        }

        setUser(currentUser);
        setProfile(userData);
        setRole(userRole);
        setCheckingAuth(false);
      } catch (err) {
        console.error(err);
        if (auth.currentUser) {
          await signOut(auth);
          alert('ไม่สามารถตรวจสอบสิทธิ์ได้');
        }
        setUser(null);
        setProfile(null);
        setRole(null);
        setCheckingAuth(false);
      }
    });

    return () => unsub();
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">
        กำลังตรวจสอบการเข้าสู่ระบบ...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <DashboardContent
      user={user}
      profile={profile}
      role={role}
    />
  );
}
