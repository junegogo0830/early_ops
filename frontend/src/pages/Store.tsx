import { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClock } from '../hooks/useClock';

const API_BASE = 'http://localhost:8000';

type InvItem = { barcode: string; name: string; loc: string; expiry: string; qty: number };
type FormState = { barcode: string; name: string; loc: string; expiry: string; qty: string };

const EMPTY: FormState = { barcode: '', name: '', loc: '', expiry: '', qty: '' };

function daysLeft(expiry: string) {
  const [y, m, d] = expiry.split('-').map(Number);
  const exp = new Date(y, m - 1, d).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((exp - today.getTime()) / 86_400_000);
}

function urgencyBar(d: number) {
  if (d <= 0) return 'bg-danger';
  if (d <= 3) return 'bg-warn';
  if (d <= 7) return 'bg-amber-300';
  if (d <= 14) return 'bg-[#7BAE5A]';
  return 'bg-stone-300';
}

function urgencyText(d: number) {
  if (d <= 0) return { label: 'D-DAY', cls: 'text-danger-dark' };
  if (d <= 3) return { label: `D-${d}`,  cls: 'text-warn-dark' };
  if (d <= 7) return { label: `D-${d}`,  cls: 'text-amber-600' };
  return { label: `D-${d}`, cls: 'text-stone-400' };
}

export default function Store() {
  const navigate = useNavigate();
  const { time } = useClock();
  const [items, setItems]               = useState<InvItem[]>([]);
  const [form,  setForm]                = useState<FormState | null>(null);
  const [editingBarcode, setEditing]    = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState('');

  const load = () =>
    fetch(`${API_BASE}/inventory`).then(r => r.json()).then(setItems).catch(() => {});

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (form)  { if (e.key === 'Escape') setForm(null); }
      else       { if (e.key === 'Escape' || e.key === 'Backspace') navigate('/'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, form]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); };
  const openEdit = (it: InvItem) => {
    setEditing(it.barcode);
    setForm({ barcode: it.barcode, name: it.name, loc: it.loc, expiry: it.expiry, qty: String(it.qty) });
  };

  const set = (k: keyof FormState, v: string) =>
    setForm(p => p ? { ...p, [k]: v } : p);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (editingBarcode) {
        await fetch(`${API_BASE}/inventory/${editingBarcode}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, loc: form.loc, expiry: form.expiry, qty: Number(form.qty) }),
        });
      } else {
        await fetch(`${API_BASE}/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, qty: Number(form.qty) }),
        });
      }
      await load();
      setForm(null); setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (barcode: string) => {
    await fetch(`${API_BASE}/inventory/${barcode}`, { method: 'DELETE' });
    setItems(p => p.filter(it => it.barcode !== barcode));
    setForm(null); setEditing(null);
  };

  const filtered = (search.trim()
    ? items.filter(it =>
        it.name.includes(search) || it.loc.includes(search) || it.barcode.includes(search))
    : items
  ).slice().sort((a, b) => a.expiry.localeCompare(b.expiry));

  return (
    <div className="w-[280px] h-[600px] bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col relative">

      {/* status bar */}
      <div className="bg-brand-navy px-3 py-2 flex justify-between items-center text-[11px] text-blue-200 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="text-blue-200 hover:text-white transition -ml-0.5 p-0.5 rounded">
            <ArrowLeft size={12} />
          </button>
          <span>내 매장 관리</span>
        </div>
        <span>● ● ● {time}</span>
      </div>

      {/* header */}
      <div className="px-3 pt-2.5 pb-1.5 shrink-0">
        <p className="text-[11px] text-stone-500">INVENTORY</p>
        <div className="flex justify-between items-baseline mt-0.5">
          <h2 className="text-sm font-medium">전체 {items.length}개 품목</h2>
          <span className="text-[10px] text-stone-400">위치 · 수량 · D-Day</span>
        </div>
      </div>

      {/* search */}
      <div className="px-3 pb-2 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="상품명 · 위치 · 바코드 검색"
          className="w-full text-[11px] border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-blue placeholder:text-stone-300"
        />
      </div>

      {/* legend */}
      <div className="px-3 pb-1 shrink-0 flex gap-2">
        {[['bg-danger','D-DAY'],['bg-warn','D-3'],['bg-amber-300','D-7'],['bg-[#7BAE5A]','D-14'],['bg-stone-300','여유']].map(([c,l]) => (
          <span key={l} className="flex items-center gap-0.5 text-[9px] text-stone-400">
            <span className={`w-2 h-2 rounded-sm ${c}`} />{l}
          </span>
        ))}
      </div>

      {/* item list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-16">
        {filtered.length === 0 && (
          <p className="text-[11px] text-stone-400 text-center mt-10">품목 없음</p>
        )}
        {filtered.map((item, i) => {
          const d = daysLeft(item.expiry);
          const { label, cls } = urgencyText(d);
          return (
            <div key={item.barcode}
              className={`flex gap-2 items-center py-2 ${i < filtered.length - 1 ? 'border-b border-stone-100' : ''}`}>
              <div className={`w-1 self-stretch rounded-sm shrink-0 ${urgencyBar(d)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-stone-400 truncate">{item.loc}</p>
              </div>
              <div className="text-right shrink-0 mr-1">
                <p className="text-xs font-medium">{item.qty}개</p>
                <p className={`text-[10px] font-medium ${cls}`}>{label}</p>
              </div>
              <button onClick={() => openEdit(item)}
                className="p-1 rounded hover:bg-stone-100 text-stone-300 hover:text-stone-600 transition shrink-0">
                <Pencil size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        className="absolute bottom-4 right-4 w-11 h-11 bg-brand-blue text-white rounded-full shadow-lg hover:bg-brand-navy transition flex items-center justify-center">
        <Plus size={18} />
      </button>

      {/* Add / Edit overlay */}
      {form && (
        <div className="absolute inset-0 bg-white rounded-3xl flex flex-col overflow-hidden">
          <div className="bg-brand-navy px-3 py-2 flex items-center justify-between text-[11px] text-blue-200 shrink-0">
            <button onClick={() => setForm(null)} className="text-blue-200 hover:text-white transition p-0.5 rounded">
              <ArrowLeft size={12} />
            </button>
            <span>{editingBarcode ? '상품 정보 수정' : '상품 추가'}</span>
            <span className="w-4" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex flex-col gap-3">
            <Field label="상품명"            value={form.name}   onChange={v => set('name', v)} />
            <Field label="바코드"            value={form.barcode} onChange={v => set('barcode', v)} readonly={!!editingBarcode} />
            <Field label="위치"              value={form.loc}    onChange={v => set('loc', v)} placeholder="예: FF 진열대 · 3구역" />
            <Field label="수량"  type="number" value={form.qty}  onChange={v => set('qty', v)} />
            <Field label="유통기한" type="date" value={form.expiry} onChange={v => set('expiry', v)} />

            {editingBarcode && (
              <button onClick={() => handleDelete(editingBarcode)}
                className="flex items-center justify-center gap-1.5 w-full py-2 mt-1 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 transition">
                <Trash2 size={12} /> 상품 삭제
              </button>
            )}
          </div>

          <div className="px-4 pb-5 pt-2 flex gap-2 shrink-0">
            <button onClick={() => setForm(null)}
              className="flex-1 py-2 border border-stone-200 text-stone-500 rounded-xl text-xs hover:bg-stone-50 transition">
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 bg-brand-blue text-white rounded-xl text-xs hover:bg-brand-navy transition shadow-md disabled:opacity-50">
              {saving ? '저장 중...' : editingBarcode ? '저장' : '추가'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, readonly }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; readonly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readonly}
        className={`text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-blue
          ${readonly ? 'bg-stone-50 text-stone-400' : 'bg-white'}`}
      />
    </div>
  );
}
