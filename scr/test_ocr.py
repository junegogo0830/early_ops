"""
유통기한 OCR 전처리 비교 테스트 (EasyOCR 버전)
사용법: python scr/test_ocr.py data/raw/frames/frame_00000.jpg
"""

import cv2
import sys
import re
import numpy as np
import easyocr

reader = easyocr.Reader(['ko', 'en'], gpu=False)

DATE_PATTERNS = [
    (r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",  "4자리-한글"),
    (r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",           "4자리-구분자"),
    (r"(\d{4})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{1,2})",     "4자리-공백포함"),
    (r"(\d{4})(\d{2})(\d{2})",                             "4자리-연속"),
    (r"(\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",  "2자리-한글"),
    (r"(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})",           "2자리-구분자"),
    (r"(\d{2})\s*[.]\s*(\d{1,2})\s*[.]\s*(\d{1,2})",     "2자리-공백포함"),
    (r"(?:유통기한|까지|소비기한|best\s*before|use\s*by|exp)[^\d]*(\d{2,4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})", "키워드+날짜"),
    (r"(?:제조|제조일|제조일자)[^\d]*(\d{2,4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})", "제조일"),
]

def parse_date(text):
    cleaned = text.replace("O","0").replace("o","0").replace("l","1").replace("I","1")
    for pattern, desc in DATE_PATTERNS:
        m = re.search(pattern, cleaned, re.IGNORECASE)
        if m:
            y, mo, d = m.group(1), m.group(2), m.group(3)
            if len(y) == 2:
                y = "20" + y
            if not (1 <= int(mo) <= 12 and 1 <= int(d) <= 31):
                continue
            return f"{y}-{mo.zfill(2)}-{d.zfill(2)}", desc
    return None, None

def make_versions(img_path):
    img = cv2.imread(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    base = "data/raw/frames"
    versions = {"원본": img_path}

    # 업스케일
    up2 = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    up4 = cv2.resize(gray, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(f"{base}/_up2.jpg", up2)
    cv2.imwrite(f"{base}/_up4.jpg", up4)
    versions["업스케일2x"] = f"{base}/_up2.jpg"
    versions["업스케일4x"] = f"{base}/_up4.jpg"

    # CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(up2)
    cv2.imwrite(f"{base}/_clahe.jpg", cl)
    versions["CLAHE"] = f"{base}/_clahe.jpg"

    # 샤프닝
    k = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
    sharp = cv2.filter2D(cl, -1, k)
    cv2.imwrite(f"{base}/_sharp.jpg", sharp)
    versions["샤프닝"] = f"{base}/_sharp.jpg"

    # Dilate 2x — 잉크젯 점 연결
    dk = np.ones((2,2), np.uint8)
    inv2 = cv2.adaptiveThreshold(cl, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY_INV, 11, 2)
    d2 = cv2.bitwise_not(cv2.dilate(inv2, dk, iterations=1))
    cv2.imwrite(f"{base}/_dilate2x.jpg", d2)
    versions["Dilate2x"] = f"{base}/_dilate2x.jpg"

    # Dilate 4x — 잉크젯 점 연결 + 업스케일
    inv4 = cv2.adaptiveThreshold(up4, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                  cv2.THRESH_BINARY_INV, 11, 2)
    d4 = cv2.bitwise_not(cv2.dilate(inv4, dk, iterations=1))
    cv2.imwrite(f"{base}/_dilate4x.jpg", d4)
    versions["Dilate4x"] = f"{base}/_dilate4x.jpg"

    return versions

if __name__ == "__main__":
    img_path = sys.argv[1] if len(sys.argv) > 1 else "data/raw/frames/frame_00000.jpg"
    print(f"이미지: {img_path}\n")

    versions = make_versions(img_path)

    for name, path in versions.items():
        results = reader.readtext(path)
        print(f"{'─'*50}")
        print(f"[{name}]")
        if not results:
            print("  감지 없음")
            continue
        for (_, text, conf) in results:
            date, pattern = parse_date(text)
            tag = f"  ✅ {date} ({pattern})" if date else ""
            print(f"  '{text}' (신뢰도:{conf:.2f}){tag}")