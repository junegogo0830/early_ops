"""
scripts/extract_and_ocr.py
프레임 이미지 → EasyOCR → 날짜 파싱
"""

import os
import re
import cv2
import numpy as np
import easyocr

# ─── 설정 ───────────────────────────────────────────
FRAME_DIR  = "data/raw/frames"
VIZ_DIR    = "data/raw/frames_viz"

# ─── EasyOCR 초기화 ─────────────────────────────────
ocr = easyocr.Reader(['ko', 'en'], gpu=False)

# ─── 날짜 파싱 ──────────────────────────────────────
DATE_PATTERNS = [
    # ── 4자리 연도 ──────────────────────────────────
    (r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",  "2025년12월31일"),
    (r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",           "2025.12.31 / 2025-12-31"),
    (r"(\d{4})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{1,2})",     "2025. 12. 31 (공백 포함)"),
    (r"(\d{4})(\d{2})(\d{2})",                             "20251231"),

    # ── 2자리 연도 ──────────────────────────────────
    (r"(\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",  "25년12월31일"),
    (r"(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})",           "25.12.31 / 25-12-31"),
    (r"(\d{2})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{1,2})",     "25. 12. 31 (공백 포함)"),

    # ── 유통기한 키워드 + 날짜 ──────────────────────
    (r"(?:유통기한|까지|소비기한|best\s*before|use\s*by|exp)[^\d]*(\d{2,4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})",
                                                           "유통기한 2025.12.31"),

    # ── 제조일 ──────────────────────────────────────
    (r"(?:제조|제조일|제조일자)[^\d]*(\d{2,4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})",
                                                           "제조 2025.06.01"),
]

def parse_date(text: str) -> dict | None:
    cleaned = text.replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1")

    for pattern, desc in DATE_PATTERNS:
        m = re.search(pattern, cleaned, re.IGNORECASE)
        if m:
            y, mo, d = m.group(1), m.group(2), m.group(3)
            if len(y) == 2:
                y = "20" + y
            if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31):
                continue
            return {
                "date":    f"{y}-{mo.zfill(2)}-{d.zfill(2)}",
                "raw":     text,
                "pattern": desc,
            }
    return None

def draw_ocr_result(img_path: str, ocr_result: list, out_path: str):
    img = cv2.imread(img_path)
    for (bbox, text, conf) in ocr_result:
        pts = np.array(bbox, dtype=np.int32)
        parsed = parse_date(text)
        color = (0, 0, 255) if parsed else (0, 200, 0)  # 날짜=빨강, 일반=초록
        cv2.polylines(img, [pts], isClosed=True, color=color, thickness=2)
        cv2.putText(img, f"{text} ({conf:.2f})", tuple(pts[0]),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
    cv2.imwrite(out_path, img)


def run_ocr(frame_paths: list[str]) -> list[dict]:
    os.makedirs(VIZ_DIR, exist_ok=True)
    results = []

    for path in frame_paths:
        raw = ocr.readtext(path)
        texts = [(text, conf) for (_, text, conf) in raw]

        detected_date = None
        for text, conf in texts:
            parsed = parse_date(text)
            if parsed:
                detected_date = {**parsed, "conf": round(conf, 3)}
                break

        viz_path = os.path.join(VIZ_DIR, os.path.basename(path))
        draw_ocr_result(path, raw, viz_path)

        results.append({
            "frame":     os.path.basename(path),
            "detected":  detected_date,
            "all_texts": [(t, round(c, 3)) for t, c in texts],
        })

    return results

if __name__ == "__main__":
    frame_paths = sorted(
        os.path.join(FRAME_DIR, f)
        for f in os.listdir(FRAME_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )
    print(f"프레임 {len(frame_paths)}장 로드")

    print("\n=== OCR 실행 ===")
    results = run_ocr(frame_paths)

    print("\n=== 결과 ===")
    detected = [r for r in results if r["detected"]]
    print(f"날짜 감지 성공: {len(detected)} / {len(results)} 프레임")

    for r in detected:
        d = r["detected"]
        print(f"  [{r['frame']}] {d['date']}  (raw: '{d['raw']}' | 패턴: {d['pattern']} | conf: {d['conf']})")
