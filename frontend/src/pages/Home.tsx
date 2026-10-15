import { Link } from 'react-router-dom';
import { ScanLine, Bell, Package, Store } from 'lucide-react';
import { useClock } from '../hooks/useClock';

const navItems = [
  { to: '/scan',   label: '검수 스캔',    desc: '바코드 · 유통기한 인식',  icon: ScanLine, accent: 'bg-brand-blue' },
  { to: '/alerts', label: '만료 알림',    desc: '오늘 처리할 품목',        icon: Bell,     accent: 'bg-[#C46968]' },
  { to: '/orders', label: '발주 추천',    desc: '내일 발주 최적화',        icon: Package,  accent: 'bg-[#37846C]' },
  { to: '/store',  label: '내 매장 관리', desc: '재고 · 위치 · 상품 편집', icon: Store,    accent: 'bg-brand-navy' },
] as const;

export default function Home() {
  const { time } = useClock();
  return (
    <div className="w-[280px] h-[600px] bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      {/* status bar */}
      <div className="bg-brand-navy px-3 py-2 flex justify-between text-[11px] text-blue-200">
        <span>EarlyOps</span><span>● ● ● {time}</span>
      </div>

      {/* logo */}
      {/* TODO: 로고 이미지로 교체 — frontend/src/assets/에 파일 추가 후 <img>로 변경 */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-brand-navy tracking-tight">
          Early<span className="text-brand-blue">Ops</span>
        </h1>
        <p className="text-[11px] text-stone-400 mt-2 tracking-wider">유통기한 검수 · 발주 자동화</p>
      </div>

      {/* nav buttons */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {navItems.map(({ to, label, desc, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3.5 bg-white border border-stone-200 rounded-xl shadow-md hover:shadow-lg transition"
          >
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg text-white shadow-md ${accent}`}>
              <Icon size={18} />
            </span>
            <span className="flex-1 text-left">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">{desc}</p>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
