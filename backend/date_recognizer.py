"""
날짜 전용 CRNN 추론 모듈
train/train_date_ocr.py 로 학습한 모델을 사용.
모델 파일이 없으면 easyocr 결과를 그대로 반환한다.
"""

import os, re
import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models/date_crnn.pth")
DATE_RE    = re.compile(r'(\d{4}|\d{2})[\.\-\/]\d{1,2}[\.\-\/]\d{1,2}')

_model  = None
_meta   = None
_loaded = False


def _load_model():
    global _model, _meta, _loaded
    if _loaded:
        return
    _loaded = True

    if not os.path.exists(MODEL_PATH):
        return

    try:
        import torch
        import torch.nn as nn

        ckpt = torch.load(MODEL_PATH, map_location='cpu')
        CHARSET = ckpt['charset']
        IMG_H   = ckpt.get('img_h', 32)
        IMG_W   = ckpt.get('img_w', 128)
        HIDDEN  = ckpt.get('hidden', 128)

        class TinyCRNN(nn.Module):
            def __init__(self):
                super().__init__()
                self.cnn = nn.Sequential(
                    nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
                    nn.MaxPool2d(2, 2),
                    nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
                    nn.MaxPool2d(2, 2),
                    nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
                    nn.MaxPool2d((2, 1)),
                    nn.Conv2d(128, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
                    nn.AdaptiveAvgPool2d((1, None)),
                )
                self.lstm = nn.LSTM(128, HIDDEN, num_layers=2, batch_first=True, bidirectional=True)
                self.fc   = nn.Linear(HIDDEN * 2, len(CHARSET) + 1)

            def forward(self, x):
                feat = self.cnn(x)
                B, C, _, W = feat.shape
                feat = feat.squeeze(2).permute(0, 2, 1)
                out, _ = self.lstm(feat)
                out = self.fc(out)
                return out.permute(1, 0, 2)

        model = TinyCRNN()
        model.load_state_dict(ckpt['model_state'])
        model.eval()
        _model = model
        _meta  = {'charset': CHARSET, 'img_h': IMG_H, 'img_w': IMG_W, 'blank': len(CHARSET)}
        print(f"[DateRecognizer] 날짜 전용 모델 로드 완료: {MODEL_PATH}")
    except Exception as e:
        print(f"[DateRecognizer] 모델 로드 실패 ({e}), easyocr fallback 사용")


def _preprocess(img_bgr, img_h, img_w):
    import torch
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY) if len(img_bgr.shape) == 3 else img_bgr
    h, w = gray.shape
    new_w = min(img_w, int(w * img_h / max(h, 1)))
    resized = cv2.resize(gray, (new_w, img_h))
    canvas = np.zeros((img_h, img_w), dtype=np.uint8)
    canvas[:, :new_w] = resized
    return torch.FloatTensor(canvas).unsqueeze(0).unsqueeze(0) / 255.0  # (1, 1, H, W)


def _decode(logits_t_b_c, charset, blank):
    """greedy CTC decode"""
    indices = logits_t_b_c[:, 0, :].argmax(1).tolist()
    result, prev = [], None
    for i in indices:
        if i == blank or i == prev:
            prev = i
            continue
        if i < len(charset):
            result.append(charset[i])
        prev = i
    return ''.join(result)


def recognize_date(crop_bgr: np.ndarray) -> str | None:
    """
    날짜 crop 이미지를 받아 날짜 문자열을 반환.
    모델 미로드 시 None 반환 → 호출 측에서 easyocr 결과 사용.
    """
    _load_model()
    if _model is None:
        return None

    import torch
    try:
        inp = _preprocess(crop_bgr, _meta['img_h'], _meta['img_w'])
        with torch.no_grad():
            out = _model(inp)
        text = _decode(out, _meta['charset'], _meta['blank'])
        return text if DATE_RE.search(text) else None
    except Exception:
        return None


def enhance_results(img_bgr: np.ndarray, easyocr_results: list) -> list:
    """
    easyocr 결과 리스트를 받아 날짜 영역에 대해 custom 모델로 재인식 시도.
    결과 형식: [(bbox, text, confidence), ...]
    """
    _load_model()
    enhanced = []

    for bbox, text, conf in easyocr_results:
        # 이미 날짜 패턴이 있거나 custom 모델 없으면 그대로
        if _model is None or DATE_RE.search(text):
            enhanced.append((bbox, text, conf))
            continue

        # 날짜처럼 보이는 영역 (숫자 비율 높은 경우)만 재시도
        digit_ratio = sum(c.isdigit() for c in text) / max(len(text), 1)
        if digit_ratio < 0.4:
            enhanced.append((bbox, text, conf))
            continue

        pts = np.array(bbox, dtype=np.float32)
        x_min, y_min = int(pts[:, 0].min()), int(pts[:, 1].min())
        x_max, y_max = int(pts[:, 0].max()), int(pts[:, 1].max())
        h_img, w_img = img_bgr.shape[:2]
        x_min, y_min = max(0, x_min - 2), max(0, y_min - 2)
        x_max, y_max = min(w_img, x_max + 2), min(h_img, y_max + 2)
        crop = img_bgr[y_min:y_max, x_min:x_max]

        if crop.size == 0:
            enhanced.append((bbox, text, conf))
            continue

        custom_text = recognize_date(crop)
        if custom_text:
            enhanced.append((bbox, custom_text, min(conf + 0.1, 1.0)))
        else:
            enhanced.append((bbox, text, conf))

    return enhanced
