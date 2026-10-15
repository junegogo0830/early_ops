import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClock } from '../hooks/useClock';

const API_BASE = 'http://localhost:8000';

type Tone = 'up' | 'down' | 'flat';
type Rec = { name: string; note: string; from: number; to: number; tone: Tone };
type ChartData = { label: string; days: string[]; values: number[]; highlightIndex: number };
type OrdersData = {
  summary: { savings: number; vsAvgPercent: number };
  chart: ChartData;
  recommendations: Rec[];
};

export default function Orders() {
  const navigate = useNavigate();
  const { time } = useClock();
  const [data, setData] = useState<OrdersData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/orders/recommendations`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const chart = data?.chart;
  const maxVal = chart ? Math.max(...chart.values, 1) : 1;

  // up → flat → down 순, 같은 tone 내에서는 변화량 큰 순
  const sorted = data
    ? [...data.recommendations].sort((a, b) => {
        const order = { up: 0, flat: 1, down: 2 };
        if (a.tone !== b.tone) return order[a.tone] - order[b.tone];
        return Math.abs(b.to - b.from) - Math.abs(a.to - a.from);
      })
    : [];

  const upCount   = sorted.filter(r => r.tone === 'up').length;
  const downCount = sorted.filter(r => r.tone === 'down').length;

  return (
    <div className="w-[280px] h-[600px] bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">

      {/* status bar */}
      <div className="bg-[#0E2A26] px-3 py-2 flex justify-between items-center text-[11px] text-[#ACD4C7] shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="text-[#ACD4C7] hover:text-white transition -ml-0.5 p-0.5 rounded">
            <ArrowLeft size={12} />
          </button>
          <span>발주 추천</span>
        </div>
        <span>● ● ● {time}</span>
      </div>

      {/* step header */}
      <div className="px-3 pt-2.5 pb-1 shrink-0">
        <p className="text-[11px] text-stone-500">OPTIMIZE</p>
        <h2 className="text-sm font-medium mt-0.5">내일 발주</h2>
      </div>

      {/* summary card */}
      <div className="bg-[#E5F1ED] rounded-md px-2.5 py-2 mx-3 mb-2 shrink-0">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-[#164239]">예상 폐기 절감</span>
          <span className="text-base font-medium text-[#0E2A26]">
            {data ? `₩${data.summary.savings.toLocaleString()}` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-[10px] text-[#225B4D]">
            {data
              ? `평균 대비 ${data.summary.vsAvgPercent > 0 ? '+' : ''}${data.summary.vsAvgPercent}%`
              : '—'}
          </p>
          <div className="flex gap-2">
            <span className="text-[10px] text-[#37846C] flex items-center gap-0.5">
              <TrendingUp size={10} /> {upCount}건 증량
            </span>
            <span className="text-[10px] text-[#8B4545] flex items-center gap-0.5">
              <TrendingDown size={10} /> {downCount}건 감량
            </span>
          </div>
        </div>
      </div>

      {/* chart */}
      {chart && (
        <div className="px-3 pb-1.5 shrink-0">
          <p className="text-[10px] text-stone-500 mb-1">{chart.label}</p>
          <svg viewBox="0 0 180 50" className="w-full h-[46px] block">
            {chart.values.map((val, i) => {
              const barH = Math.max(2, Math.round((val / maxVal) * 38));
              const x = 2 + i * 26;
              const isHighlight = i === chart.highlightIndex;
              return (
                <g key={i}>
                  <rect x={x} y={44 - barH} width="22" height={barH} rx="2"
                    fill={isHighlight ? '#61813A' : '#BECFA5'} />
                  <text x={x + 11} y={49} fontSize="7" textAnchor="middle" fill={isHighlight ? '#3D5C20' : '#5F5E5A'}>
                    {chart.days[i]}
                  </text>
                </g>
              );
            })}
            <line
              x1={2 + chart.highlightIndex * 26 + 11} y1="2"
              x2={2 + chart.highlightIndex * 26 + 11} y2="44"
              stroke="#8B4545" strokeWidth="0.8" strokeDasharray="2 2"
            />
          </svg>
        </div>
      )}

      {/* recommendations — 스크롤 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <p className="text-[10px] tracking-wider text-stone-400 pt-1 pb-1.5 sticky top-0 bg-white">
          추천 발주량 · {sorted.length}개 품목
        </p>

        {sorted.map((rec, i) => (
          <RecRow key={rec.name + i} {...rec} last={i === sorted.length - 1} />
        ))}
      </div>
    </div>
  );
}

const TONE_CFG = {
  up:   { icon: TrendingUp,   color: 'text-[#37846C]', bg: 'bg-[#EAF5F0]', label: '↑' },
  down: { icon: TrendingDown, color: 'text-[#8B4545]', bg: 'bg-[#F9EEEE]', label: '↓' },
  flat: { icon: Minus,        color: 'text-stone-400',  bg: 'bg-stone-50',   label: '→' },
};

function RecRow({ name, note, from, to, tone, last }: Rec & { last?: boolean }) {
  const cfg = TONE_CFG[tone];
  const Icon = cfg.icon;
  const diff = to - from;

  return (
    <div className={`flex items-center gap-2 py-1.5 ${last ? '' : 'border-b border-stone-100'}`}>
      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon size={11} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name}</p>
        <p className="text-[10px] text-stone-400">{note}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-stone-400 line-through">{from}</span>
          <span className={`text-sm font-semibold ${cfg.color}`}>{to}</span>
        </div>
        {diff !== 0 && (
          <p className={`text-[10px] ${cfg.color}`}>
            {diff > 0 ? `+${diff}` : diff}개
          </p>
        )}
      </div>
    </div>
  );
}
