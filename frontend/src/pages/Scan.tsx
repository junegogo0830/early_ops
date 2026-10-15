import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Barcode, CalendarClock, Camera, CameraOff, CheckCircle } from 'lucide-react';
import { useClock } from '../hooks/useClock';

const API_BASE = 'http://localhost:8000';

const ROI = { x: 0.08, y: 0.30, w: 0.84, h: 0.35 };

type ScanResult = {
  barcode: string | null;
  expiry: string | null;
  confidence: number | null;
};

export default function Scan() {
  const navigate = useNavigate();
  const { time, date, weekday } = useClock();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive]   = useState(false);
  const [cameraError,  setCameraError]    = useState<string | null>(null);
  const [scanning,     setScanning]       = useState(false);
  const [scanError,    setScanError]       = useState<string | null>(null);
  const [result,       setResult]         = useState<ScanResult>({ barcode: null, expiry: null, confidence: null });
  const [editedExpiry, setEditedExpiry]   = useState('');
  const [registering,  setRegistering]    = useState(false);
  const [registered,   setRegistered]     = useState(false);

  // 스캔 결과 바뀌면 편집값 초기화
  useEffect(() => {
    setEditedExpiry(result.expiry ?? '');
    setRegistered(false);
  }, [result.expiry]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraError('카메라에 접근할 수 없습니다');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const captureAndScan = async () => {
    const video = videoRef.current;
    if (!video) return;
    const roiX = Math.round(video.videoWidth  * ROI.x);
    const roiY = Math.round(video.videoHeight * ROI.y);
    const roiW = Math.round(video.videoWidth  * ROI.w);
    const roiH = Math.round(video.videoHeight * ROI.h);
    const canvas = document.createElement('canvas');
    canvas.width = roiW; canvas.height = roiH;
    canvas.getContext('2d')?.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    setScanning(true); setScanError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'frame.jpg');
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      setScanError('인식 서버에 연결할 수 없습니다');
    } finally {
      setScanning(false);
    }
  };

  const isModified = result.expiry !== null && editedExpiry !== result.expiry;
  const canRegister = !!(result.barcode || result.expiry || editedExpiry);

  const handleRegister = async () => {
    if (!canRegister) return;
    setRegistering(true);
    try {
      if (isModified && result.expiry) {
        await fetch(`${API_BASE}/feedback/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: result.barcode,
            original: result.expiry,
            corrected: editedExpiry,
          }),
        });
      }
      await fetch(`${API_BASE}/scan/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: result.barcode, expiry: editedExpiry, qty: 1 }),
      });
      setRegistered(true);
    } catch {
      setScanError('등록에 실패했습니다');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="w-[280px] h-[600px] bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
      {/* status bar */}
      <div className="bg-brand-navy px-3 py-2 flex justify-between items-center text-[11px] text-blue-200 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className="text-blue-200 hover:text-white transition -ml-0.5 p-0.5 rounded">
            <ArrowLeft size={12} />
          </button>
          <span>검수</span>
        </div>
        <span>● ● ● {time}</span>
      </div>

      {/* step header */}
      <div className="px-3 pt-2.5 pb-1 shrink-0">
        <p className="text-[9px] text-stone-500">카메라를 유통기한 부분에 대고 찍어주세요</p>
        <h2 className="text-sm font-medium mt-0.5">{date}, {weekday}</h2>
      </div>

      <CameraViewfinder videoRef={videoRef} active={cameraActive} error={cameraError}
        onStart={startCamera} onStop={stopCamera} />

      {/* capture button */}
      <div className="px-3 pb-1 shrink-0">
        <button
          onClick={captureAndScan}
          disabled={!cameraActive || scanning}
          className="w-full py-2 bg-stone-900 text-white rounded-xl shadow-md hover:shadow-lg text-xs font-medium hover:bg-stone-700 transition disabled:opacity-40 disabled:hover:bg-stone-900 disabled:shadow-none"
        >
          {scanning ? '인식 중...' : '촬영 · 인식하기'}
        </button>
        {scanError && <p className="text-[10px] text-danger mt-1 text-center">{scanError}</p>}
      </div>

      {/* results */}
      <div className="px-3 pt-1 pb-3.5 shrink-0">
        {/* barcode row */}
        <div className="flex justify-between items-center py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Barcode size={14} className="text-success" />바코드
          </span>
          <span className="text-[11px] font-mono">{result.barcode ?? '-'}</span>
        </div>

        {/* editable expiry row */}
        <div className="flex justify-between items-center py-1.5 border-t border-stone-200">
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500 shrink-0">
            <CalendarClock size={14} className="text-warn-dark" />유통기한 OCR
          </span>
          <div className="flex items-center gap-1 min-w-0">
            {isModified && (
              <span className="text-[9px] text-amber-500 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
                수정됨
              </span>
            )}
            <input
              type="text"
              value={editedExpiry}
              onChange={e => { setEditedExpiry(e.target.value); setRegistered(false); }}
              placeholder="-"
              className="text-[11px] font-mono font-medium text-right border-b border-transparent hover:border-stone-300 focus:border-brand-blue outline-none bg-transparent w-28"
            />
          </div>
        </div>

        {isModified && (
          <p className="text-[9px] text-amber-600 text-right -mt-0.5 mb-1">
            원본: {result.expiry} → 수정 후 재학습 데이터로 저장됩니다
          </p>
        )}

        {/* confidence bar */}
        <ConfidenceBar value={result.confidence ?? 0} />

        {/* register button */}
        <button
          onClick={handleRegister}
          disabled={!canRegister || registering || registered}
          className={`w-full mt-2.5 py-2 rounded-xl shadow-md text-xs font-medium transition
            ${registered
              ? 'bg-success text-white shadow-none'
              : 'bg-brand-blue text-white hover:bg-brand-navy hover:shadow-lg disabled:opacity-40 disabled:shadow-none'
            }`}
        >
          {registered
            ? <span className="flex items-center justify-center gap-1.5"><CheckCircle size={13} />등록 완료</span>
            : registering ? '등록 중...' : '등록 · 1개'}
        </button>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-success transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-success font-medium">{value > 0 ? `${value}%` : '-'}</span>
    </div>
  );
}

function CameraViewfinder({ videoRef, active, error, onStart, onStop }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean; error: string | null;
  onStart: () => void; onStop: () => void;
}) {
  return (
    <div className="mx-3 my-2 flex-1 min-h-0 bg-stone-900 rounded-lg relative overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted
        className={`w-full h-full object-cover ${active ? '' : 'hidden'}`} />

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <button onClick={onStart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue text-white rounded-xl shadow-md hover:shadow-lg text-xs font-medium hover:bg-brand-navy transition">
            <Camera size={13} /> 카메라 시작
          </button>
          {error && <p className="text-[10px] text-danger px-4 text-center">{error}</p>}
        </div>
      )}

      {active && (
        <>
          <div className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-amber-300 font-mono">
            SCAN · LIVE
          </div>
          <button onClick={onStop}
            className="absolute top-2 right-2 bg-black/60 rounded-lg shadow-md p-1 text-stone-200 hover:text-white transition">
            <CameraOff size={13} />
          </button>
          <div className="absolute border-2 border-green-400 rounded pointer-events-none"
            style={{ left: `${ROI.x * 100}%`, top: `${ROI.y * 100}%`, width: `${ROI.w * 100}%`, height: `${ROI.h * 100}%` }} />
          <span className="absolute text-[9px] text-green-400 font-mono pointer-events-none"
            style={{ left: `${ROI.x * 100}%`, top: `calc(${ROI.y * 100}% - 14px)` }}>
            유통기한 영역
          </span>
        </>
      )}
    </div>
  );
}
