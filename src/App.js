import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';

import { auth, db } from './config/firebase';

import LoginScreen from './components/LoginScreen';
import DashboardContent from './components/DashboardContent';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setUser(null);
          setRole(null);
          setCheckingAuth(false);
          return;
        }

        const roleSnap = await get(ref(db, `users/${currentUser.uid}/role`));
        const userRole = roleSnap.val();

        if (userRole !== 'staff' && userRole !== 'admin') {
          await signOut(auth);
          alert('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน Dashboard');
          setUser(null);
          setRole(null);
          setCheckingAuth(false);
          return;
        }

        setUser(currentUser);
        setRole(userRole);
        setCheckingAuth(false);
      } catch (err) {
        console.error(err);
        await signOut(auth);
        alert('ไม่สามารถตรวจสอบสิทธิ์ได้');
        setUser(null);
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
      role={role}
    />
  );
}