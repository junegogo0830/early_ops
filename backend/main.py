import json
import random
import re
from datetime import date, timedelta
from pathlib import Path

import cv2
import numpy as np
import easyocr
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from date_recognizer import enhance_results

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

reader = easyocr.Reader(["en"], gpu=False)
barcode_detector = cv2.barcode.BarcodeDetector()

DATE_PATTERN = re.compile(r"\d{4}\s?[.\-/]\s?\d{1,2}\s?[.\-/]\s?\d{1,2}")
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]

random.seed(42)


def make_sales_history(base: int) -> list[int]:
    return [max(0, base + random.randint(-6, 6)) for _ in range(28)]


# 실제 POS/발주 시스템이 연동되기 전까지 사용하는 메모리 내 가짜 재고·판매 데이터.
inventory: list[dict] = []


def seed_inventory():
    today = date.today()
    seed_items = [
        # D-DAY
        {"barcode": "8801234567890", "name": "참치마요 삼각김밥",   "loc": "FF 진열대 · 3구역",   "expiry_offset": 0,  "qty": 2,  "base_sales": 28},
        {"barcode": "8801234567891", "name": "단팥크림빵",           "loc": "빵 진열대 · 1단",     "expiry_offset": 0,  "qty": 1,  "base_sales": 12},
        # D-1
        {"barcode": "8801234567892", "name": "햄에그 샌드위치",      "loc": "FF 진열대 · 1구역",   "expiry_offset": 1,  "qty": 3,  "base_sales": 16},
        {"barcode": "8801234567893", "name": "불고기 버거",           "loc": "FF 진열대 · 2구역",   "expiry_offset": 1,  "qty": 2,  "base_sales": 14},
        # D-2
        {"barcode": "8801234567894", "name": "치킨마요 삼각김밥",    "loc": "FF 진열대 · 3구역",   "expiry_offset": 2,  "qty": 4,  "base_sales": 22},
        {"barcode": "8801234567895", "name": "딸기 쇼트케이크",      "loc": "빵 진열대 · 2단",     "expiry_offset": 2,  "qty": 2,  "base_sales": 8},
        # D-3
        {"barcode": "8801234567896", "name": "매일우유 200ml",       "loc": "음료 · 2단 우측",     "expiry_offset": 3,  "qty": 8,  "base_sales": 20},
        {"barcode": "8801234567897", "name": "바나나 우유",           "loc": "음료 · 1단 좌측",     "expiry_offset": 3,  "qty": 6,  "base_sales": 18},
        # D-4
        {"barcode": "8801234567898", "name": "그릭 요거트",          "loc": "유제품 · 3단",        "expiry_offset": 4,  "qty": 5,  "base_sales": 10},
        {"barcode": "8801234567899", "name": "오렌지 주스 300ml",    "loc": "음료 · 3단 우측",     "expiry_offset": 4,  "qty": 7,  "base_sales": 15},
        # D-5
        {"barcode": "8801234567900", "name": "연세우유 초코",        "loc": "음료 · 2단 좌측",     "expiry_offset": 5,  "qty": 4,  "base_sales": 12},
        {"barcode": "8801234567901", "name": "두부 한모",            "loc": "냉장 식품 · 1구역",   "expiry_offset": 5,  "qty": 3,  "base_sales": 6},
        # D-7
        {"barcode": "8801234567902", "name": "계란 6구",             "loc": "냉장 식품 · 2구역",   "expiry_offset": 7,  "qty": 4,  "base_sales": 9},
        {"barcode": "8801234567903", "name": "콘샐러드",             "loc": "FF 진열대 · 4구역",   "expiry_offset": 7,  "qty": 2,  "base_sales": 7},
        # D-10
        {"barcode": "8801234567904", "name": "아이스티 500ml",       "loc": "음료 · 4단 우측",     "expiry_offset": 10, "qty": 12, "base_sales": 25},
        {"barcode": "8801234567905", "name": "콜라 500ml",           "loc": "음료 · 4단 좌측",     "expiry_offset": 10, "qty": 15, "base_sales": 32},
        # D-14
        {"barcode": "8801234567906", "name": "새우깡 90g",           "loc": "과자 진열대 · 2단",   "expiry_offset": 14, "qty": 20, "base_sales": 18},
        {"barcode": "8801234567907", "name": "포카칩 오리지널",      "loc": "과자 진열대 · 1단",   "expiry_offset": 14, "qty": 18, "base_sales": 22},
        # D-20
        {"barcode": "8801234567908", "name": "신라면 5입",           "loc": "라면 진열대 · 3단",   "expiry_offset": 20, "qty": 10, "base_sales": 14},
        {"barcode": "8801234567909", "name": "진라면 순한맛 5입",    "loc": "라면 진열대 · 2단",   "expiry_offset": 20, "qty": 8,  "base_sales": 11},
    ]
    for item in seed_items:
        inventory.append({
            "barcode": item["barcode"],
            "name": item["name"],
            "loc": item["loc"],
            "expiry": (today + timedelta(days=item["expiry_offset"])).isoformat(),
            "qty": item["qty"],
            "dailySales": make_sales_history(item["base_sales"]),
        })


seed_inventory()


@app.get("/alerts/items")
async def alerts_items(days: int = 3, ref_date: str | None = None):
    days = max(1, days)
    try:
        today = date.fromisoformat(ref_date) if ref_date else date.today()
    except ValueError:
        today = date.today()

    d_day_items = []
    range_items = []
    for item in inventory:
        days_left = (date.fromisoformat(item["expiry"]) - today).days
        if days_left <= 0:
            d_day_items.append({"barcode": item["barcode"], "name": item["name"], "loc": item["loc"], "qty": item["qty"]})
        elif days_left <= days:
            range_items.append({
                "name": item["name"],
                "loc": item["loc"],
                "dDay": f"D-{days_left}",
                "qty": item["qty"],
            })

    return {
        "days": days,
        "stats": {
            "dDay": sum(i["qty"] for i in d_day_items),
            "range": sum(i["qty"] for i in range_items),
        },
        "dDayItems": d_day_items,
        "rangeItems": range_items,
    }


@app.get("/orders/recommendations")
async def orders_recommendations(days: int = 7):
    days = max(1, min(days, 28))
    today = date.today()

    recommendations = []
    for item in inventory:
        history = item["dailySales"]
        recent = history[-days:]
        baseline = history[:-days]
        recent_avg = sum(recent) / len(recent)
        baseline_avg = (sum(baseline) / len(baseline)) if baseline else recent_avg

        from_qty = round(baseline_avg)
        to_qty = round(recent_avg)
        if to_qty > from_qty:
            tone = "up"
        elif to_qty < from_qty:
            tone = "down"
        else:
            tone = "flat"

        recommendations.append({
            "name": item["name"],
            "note": f"최근 {days}일 평균 기준",
            "from": from_qty,
            "to": to_qty,
            "tone": tone,
        })

    top_item = max(inventory, key=lambda i: sum(i["dailySales"][-days:]))
    weekday_labels = [WEEKDAY_KO[(today - timedelta(days=6 - i)).weekday()] for i in range(7)]

    total_from = sum(r["from"] for r in recommendations)
    total_to = sum(r["to"] for r in recommendations)
    vs_avg_percent = round((total_to - total_from) / total_from * 100) if total_from else 0
    savings = sum(max(0, r["from"] - r["to"]) for r in recommendations) * 1300

    return {
        "days": days,
        "summary": {"savings": savings, "vsAvgPercent": vs_avg_percent},
        "chart": {
            "label": f"{top_item['name']} · 최근 7일 판매",
            "days": weekday_labels,
            "values": top_item["dailySales"][-7:],
            "highlightIndex": 6,
        },
        "recommendations": recommendations,
    }


class RegisterRequest(BaseModel):
    barcode: str | None = None
    expiry: str | None = None
    qty: int = 1


@app.post("/scan/register")
async def register_item(payload: RegisterRequest):
    today = date.today()

    digits = re.findall(r"\d+", payload.expiry) if payload.expiry else []
    if len(digits) == 3:
        y, m, d = (int(part) for part in digits)
        expiry_iso = date(y, m, d).isoformat()
    else:
        expiry_iso = (today + timedelta(days=3)).isoformat()

    barcode = payload.barcode or f"UNKNOWN-{len(inventory) + 1}"

    for item in inventory:
        if item["barcode"] == barcode:
            item["qty"] += payload.qty
            item["expiry"] = expiry_iso
            return item

    new_item = {
        "barcode": barcode,
        "name": f"신규 품목 {barcode[-4:]}",
        "loc": "미분류",
        "expiry": expiry_iso,
        "qty": payload.qty,
        "dailySales": make_sales_history(random.randint(5, 20)),
    }
    inventory.append(new_item)
    return new_item


@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    data = await file.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)

    decoded_info, _, _ = barcode_detector.detectAndDecode(img)
    barcode = decoded_info or None

    expiry = None
    confidence = None
    raw_results = reader.readtext(img)
    results = enhance_results(img, raw_results)  # 날짜 전용 모델로 재인식 (모델 없으면 pass-through)
    for _, text, conf in results:
        match = DATE_PATTERN.search(text)
        if match:
            expiry = re.sub(r"\s", "", match.group())
            confidence = round(conf * 100, 1)
            break

    return {"barcode": barcode, "expiry": expiry, "confidence": confidence}


FEEDBACK_FILE = Path("ocr_feedback.jsonl")


class OcrFeedback(BaseModel):
    barcode: str | None = None
    original: str
    corrected: str


class InventoryItem(BaseModel):
    barcode: str
    name: str
    loc: str
    expiry: str
    qty: int


class InventoryPatch(BaseModel):
    name: str | None = None
    loc: str | None = None
    expiry: str | None = None
    qty: int | None = None


@app.post("/feedback/ocr")
async def feedback_ocr(payload: OcrFeedback):
    entry = {
        "barcode": payload.barcode,
        "original": payload.original,
        "corrected": payload.corrected,
        "ts": date.today().isoformat(),
    }
    with FEEDBACK_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"saved": True}


@app.get("/inventory")
async def get_inventory():
    return [{k: v for k, v in item.items() if k != "dailySales"} for item in inventory]


@app.post("/inventory")
async def add_inventory_item(item: InventoryItem):
    for existing in inventory:
        if existing["barcode"] == item.barcode:
            return {"error": "barcode already exists"}
    new_item = {
        "barcode": item.barcode,
        "name": item.name,
        "loc": item.loc,
        "expiry": item.expiry,
        "qty": item.qty,
        "dailySales": make_sales_history(random.randint(5, 20)),
    }
    inventory.append(new_item)
    return {k: v for k, v in new_item.items() if k != "dailySales"}


@app.patch("/inventory/{barcode}")
async def update_inventory_item(barcode: str, patch: InventoryPatch):
    for item in inventory:
        if item["barcode"] == barcode:
            if patch.name    is not None: item["name"]   = patch.name
            if patch.loc     is not None: item["loc"]    = patch.loc
            if patch.expiry  is not None: item["expiry"] = patch.expiry
            if patch.qty     is not None: item["qty"]    = patch.qty
            return {k: v for k, v in item.items() if k != "dailySales"}
    return {"error": "not found"}


@app.delete("/inventory/{barcode}")
async def delete_inventory_item(barcode: str):
    for i, item in enumerate(inventory):
        if item["barcode"] == barcode:
            inventory.pop(i)
            return {"deleted": True}
    return {"error": "not found"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
