import { useEffect, useState } from 'react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function snapshot(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,           // "14:07"
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, // "2026-06-12"
    weekday: WEEKDAYS[d.getDay()],                                 // "금"
  };
}

export function useClock() {
  const [now, setNow] = useState(() => snapshot(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(snapshot(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}