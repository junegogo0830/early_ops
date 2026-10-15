# EarlyOps

> 편의점·소매점을 위한 **유통기한 스캔 · 임박 알림 · 발주 추천** 서비스

바코드와 유통기한을 카메라로 찍으면 자동으로 인식해 재고에 등록하고, 폐기 위험 품목을 미리 알려주며, 판매 추이에 기반해 발주 수량을 추천합니다.

---

## 1. 문제 정의

- 유통기한 확인과 폐기 관리는 점포에서 사람이 직접 눈으로 확인하는 반복 작업입니다.
- 임박 상품을 놓치면 폐기 손실이 발생하고, 감에 의존한 발주는 과잉·품절을 만듭니다.

## 2. 주요 기능

| 기능 | 설명 |
| --- | --- |
| **스캔 등록** | 사진 한 장에서 바코드 + 유통기한을 동시에 인식하고 재고에 등록 |
| **임박 알림** | D-Day(오늘 만료) / D-N(기준일 이내) 품목과 수량, 진열 위치를 한눈에 확인 |
| **발주 추천** | 최근 N일 판매 평균과 이전 평균을 비교해 증가/감소/유지 수량 제시, 예상 절감액 요약 |
| **재고 관리** | 품목 조회·추가·수정·삭제 (바코드 기준) |
| **OCR 피드백** | 사용자가 수정한 인식 결과를 저장해 모델 개선용 데이터로 축적 |

## 3. 시스템 구성

```
┌──────────────┐   사진/JSON    ┌─────────────────────────────┐
│   Frontend   │ ─────────────▶ │  Backend (FastAPI :8000)     │
│ React + Vite │ ◀───────────── │  ├ 바코드: OpenCV            │
│ (웹 프로토타입) │                │  ├ 텍스트: EasyOCR           │
└──────────────┘                │  ├ 날짜 보정: 자체 CRNN 모델  │
┌──────────────┐                │  └ 재고/판매 (인메모리 mock)  │
│ EarlyOpsApp  │ ─────────────▶ └─────────────────────────────┘
│ React Native │
└──────────────┘
```

### 인식 파이프라인 (`POST /scan`)

1. OpenCV `BarcodeDetector`로 바코드 디코딩
2. EasyOCR로 이미지 내 텍스트 검출
3. 날짜 전용 **TinyCRNN**(CNN + 2층 BiLSTM + CTC)으로 날짜 영역 재인식 (모델 파일이 없으면 EasyOCR 결과를 그대로 사용)
4. 정규식(`YYYY.MM.DD`, `YYYY-MM-DD`, `YYYY/MM/DD`)으로 유통기한 추출, 신뢰도(%) 함께 반환

## 4. 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn, OpenCV(contrib), EasyOCR, PyTorch |
| Web Frontend | React 19, TypeScript, Vite, React Router 7, Tailwind CSS, lucide-react |
| Mobile | React Native 0.75, NativeWind, react-native-vision-camera |

## 5. 폴더 구조

```
early_ops/
├── backend/
│   ├── main.py              # FastAPI 앱 (API 전체)
│   ├── date_recognizer.py   # 날짜 전용 CRNN 추론
│   ├── models/              # 학습된 체크포인트 (date_crnn*.pth)
│   ├── train/               # 날짜 OCR 학습 코드 (데이터는 git 제외)
│   ├── ocr_feedback.jsonl   # 사용자 수정 피드백 로그
│   └── requirements.txt
├── frontend/
│   ├── src/pages/           # Home, Scan, Alerts, Orders, Store
│   └── EarlyOpsApp/         # React Native 앱
└── scr/
    ├── extract_and_ocr.py   # 프레임 → OCR → 날짜 파싱 실험 스크립트
    └── test_ocr.py
```

## 6. 실행 방법

### Backend

```bash
cd backend
pip install -r requirements.txt
pip install torch            # 날짜 전용 모델 사용 시
python main.py               # http://localhost:8000  (Swagger: /docs)
```

### Web Frontend

```bash
cd frontend
npm install
npm run dev
```

페이지: `/` 홈 · `/scan` 스캔 · `/alerts` 임박 알림 · `/orders` 발주 추천 · `/store` 재고

### Mobile (React Native)

```bash
cd frontend/EarlyOpsApp
npm install
npm run android   # 또는 npm run ios
```

## 7. API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/scan` | 이미지 업로드 → `{barcode, expiry, confidence}` |
| POST | `/scan/register` | 스캔 결과를 재고에 등록 (동일 바코드면 수량 합산) |
| GET | `/alerts/items?days=3&ref_date=` | D-Day 및 D-N 임박 품목, 수량 통계 |
| GET | `/orders/recommendations?days=7` | 발주 추천, 요약(절감액·평균 대비 %), 차트 데이터 |
| GET | `/inventory` | 재고 목록 |
| POST | `/inventory` | 품목 추가 |
| PATCH | `/inventory/{barcode}` | 품목 수정 (name, loc, expiry, qty) |
| DELETE | `/inventory/{barcode}` | 품목 삭제 |
| POST | `/feedback/ocr` | OCR 수정 결과 저장 (`original` → `corrected`) |

## 8. 현재 상태 및 한계

- 재고·판매 이력은 **서버 메모리의 mock 데이터**이며 재시작 시 초기화됩니다. (POS/발주 시스템 연동 전)
- 프론트엔드의 API 주소가 `http://localhost:8000`으로 고정되어 있습니다.
- 인식 정확도는 조명·인쇄 상태에 영향을 받으며, 수정 피드백을 통해 개선할 계획입니다.

## 9. 로드맵

- [ ] DB 영속화 (SQLite/PostgreSQL)
- [ ] 바코드 → 상품명 조회 연동
- [ ] 실제 POS 판매 데이터 기반 수요 예측
- [ ] 피드백 데이터로 날짜 인식 모델 재학습
- [ ] 푸시 알림 (임박 품목)
