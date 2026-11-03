import { useEffect, useState } from "react";

export default function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage เต็มหรือถูกปิด ก็ไม่ต้องทำอะไร
    }
  }, [key, value]);

  return [value, setValue];
}