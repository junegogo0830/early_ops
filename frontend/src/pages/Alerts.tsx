import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClock } from '../hooks/useClock';

const API_BASE = 'http://localhost:8000';
const DAY_OPTIONS = [3, 7, 14] as const;
type DayOption = typeof DAY_OPTIONS[number];

type AlertItem = { barcode: string; name: string; loc: string; qty: number };
type RangeItem  = { name: string; loc: string; dDay: string; qty: number };
type AlertsData = {
  days: number;
  stats: { dDay: number; range: number };
  dDayItems: AlertItem[];
  rangeItems: RangeItem[];
};

export default function Alerts() {
  const navigate = useNavigate();
  const { time } = useClock();
  const todayStr = new Date().toISOString().split('T')[0];
  const [days, setDays]             = useState<DayOption>(3);
  const [refDate, setRefDate]       = useState(todayStr);
  const [data, setData]             = useState<AlertsData | null>(null);
  const [confirm, setConfirm]       = useState<AlertItem | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const load = () =>
    fetch(`${API_BASE}/alerts/items?days=${days}&ref_date=${refDate}`)
      .then(r => r.json()).then(setData).catch(() => {});

  useEffect(() => { load(); }, [days, refDate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else navigate('/');
      }
      if (e.key === 'Backspace' && !confirm) navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, confirm]);

  const handleDiscard = async () => {
    if (!confirm) return;
    setDiscarding(true);
    try {
      await fetch(`${API_BASE}/inventory/${confirm.barcode}`, { method: 'DELETE' });
      setData(prev => prev ? {
        ...prev,
        stats: { ...prev.stats, dDay: prev.stats.dDay - confirm.qty },
        dDayItems: prev.dDayItems.filter(it => it.barcode !== confirm.barcode),
      } : prev);
    } finally {
      setDiscarding(false);
      setConfirm(null);
    }
  };

  return (
    <div className="w-[280px] h-[600px] bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col relative">

      {/* status bar */}
      <div className="bg-[#441F1F] px-3 py-2 flex justify-between items-center text-[11px] text-[#ECCCCC] shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="text-[#ECCCCC] hover:text-white transition -ml-0.5 p-0.5 rounded">
            <ArrowLeft size={12} />
          </button>
          <span>만료 알림</span>
        </div>
        <span>● ● ● {time}</span>
      </div>

      {/* step header */}
      <div className="px-3 pt-2.5 pb-1 shrink-0">
        <p className="text-[11px] text-stone-500">EXPIRED</p>
        <h2 className="text-sm font-medium mt-0.5">오늘 처리할 품목</h2>
      </div>

      {/* 기준 날짜 + D-N 필터 */}
      <div className="px-3 pb-2 shrink-0 flex items-center gap-2">
        <label className="flex items-center gap-1 flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1">
          <CalendarDays size={11} className="text-stone-400 shrink-0" />
          <input
            type="date"
            value={refDate}
            onChange={e => setRefDate(e.target.value)}
            className="text-[11px] text-stone-600 bg-transparent outline-none w-full"
          />
        </label>
        <div className="flex gap-1 shrink-0">
          {DAY_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-[10px] px-2 py-1 rounded-full font-medium transition ${
                days === d ? 'bg-[#441F1F] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}>
              D-{d}
            </button>
          ))}
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-1.5 px-3 pb-2.5 shrink-0">
        <div className="bg-[#F9EEEE] rounded-md p-2">
          <p className="text-[10px] text-[#673131]">D-DAY</p>
          <p className="text-[20px] font-medium text-[#441F1F] leading-[1.1]">{data?.stats.dDay ?? '—'}</p>
          <p className="text-[10px] text-[#673131]">즉시 폐기</p>
        </div>
        <div className="bg-[#F4ECE0] rounded-md p-2">
          <p className="text-[10px] text-[#503719]">D-{days} 이내</p>
          <p className="text-[20px] font-medium text-[#34230F] leading-[1.1]">{data?.stats.range ?? '—'}</p>
          <p className="text-[10px] text-[#503719]">선반 회전</p>
        </div>
      </div>

      {/* item list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3.5">
        {(data?.dDayItems.length ?? 0) > 0 && (
          <div className="mb-2">
            <p className="text-[10px] tracking-wider text-stone-400 mb-1 sticky top-0 bg-white py-0.5">
              D-DAY · 즉시 폐기 <span className="text-[9px] text-[#C46968]">· 클릭하여 폐기처리</span>
            </p>
            {data!.dDayItems.map((item, i, arr) => (
              <ItemRow
                key={item.barcode + i}
                name={item.name} loc={item.loc} dDay="D-DAY" qty={item.qty}
                barColor="bg-[#C46968]" dDayColor="text-[#673131]"
                last={i === arr.length - 1}
                onClick={() => setConfirm(item)}
              />
            ))}
          </div>
        )}

        {(data?.rangeItems.length ?? 0) > 0 && (
          <div>
            <p className="text-[10px] tracking-wider text-stone-400 mb-1 sticky top-0 bg-white py-0.5">
              D-{days} 이내 · 선반 회전
            </p>
            {data!.rangeItems.map((item, i, arr) => (
              <ItemRow
                key={item.name + i}
                name={item.name} loc={item.loc} dDay={item.dDay} qty={item.qty}
                barColor="bg-[#C7974F]" dDayColor="text-[#6D4C23]"
                last={i === arr.length - 1}
              />
            ))}
          </div>
        )}

        {data && data.dDayItems.length === 0 && data.rangeItems.length === 0 && (
          <p className="text-[11px] text-stone-400 text-center mt-10">해당 기간 만료 품목 없음</p>
        )}
      </div>

      {/* 폐기 확인 모달 */}
      {confirm && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-3xl">
          <div className="bg-white rounded-2xl mx-5 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={16} className="text-[#C46968] shrink-0" />
              <p className="text-sm font-medium">폐기처리하시겠습니까?</p>
            </div>
            <p className="text-xs text-stone-500 mb-1 truncate">{confirm.name}</p>
            <p className="text-[10px] text-stone-400 mb-4 flex items-center gap-1">
              <MapPin size={10} />{confirm.loc} · {confirm.qty}개
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2 border border-stone-200 text-stone-500 rounded-xl text-xs hover:bg-stone-50 transition"
              >
                아니오
              </button>
              <button
                onClick={handleDiscard}
                disabled={discarding}
                className="flex-1 py-2 bg-[#C46968] text-white rounded-xl text-xs hover:bg-[#441F1F] transition disabled:opacity-50"
              >
                {discarding ? '처리 중...' : '예, 폐기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ name, loc, dDay, qty, barColor, dDayColor, last, onClick }: {
  name: string; loc: string; dDay: string; qty: number;
  barColor: string; dDayColor: string; last?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex gap-2 items-center py-1.5
        ${last ? '' : 'border-b border-stone-100'}
        ${onClick ? 'cursor-pointer hover:bg-[#FDF5F5] rounded transition' : ''}`}
    >
      <div className={`w-1 self-stretch rounded-sm shrink-0 ${barColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name}</p>
        <p className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
          <MapPin size={10} className="shrink-0" />{loc}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-medium ${dDayColor}`}>{dDay}</p>
        <p className="text-[10px] text-stone-400">×{qty}</p>
      </div>
    </div>
  );
}
