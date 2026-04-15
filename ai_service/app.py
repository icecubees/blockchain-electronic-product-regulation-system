from __future__ import annotations

import json
from pathlib import Path

import fitz
import joblib
from flask import Flask, jsonify, request

from model_utils import build_model_input, suggest_reason_codes


app = Flask(__name__)

MODEL_PATH = Path(__file__).resolve().parent / "audit_model.pkl"
model = None
model_bundle = {}
model_version = "unknown"

if MODEL_PATH.exists():
    loaded = joblib.load(MODEL_PATH)
    if isinstance(loaded, dict) and "model" in loaded:
        model_bundle = loaded
        model = loaded["model"]
        model_version = str(loaded.get("version", "electronic-audit-v2"))
    else:
        model = loaded
        model_bundle = {"version": "legacy-audit-model"}
        model_version = "legacy-audit-model"
    print(f"AI model loaded successfully. version={model_version}")
else:
    print("Model file not found. Please run train_model.py first.")


def extract_text_from_pdf(pdf_stream):
    text = ""
    try:
        with fitz.open(stream=pdf_stream, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as error:
        print(f"PDF parsing failed: {error}")
    return text


def read_structured_payload():
    payload = {}

    if request.is_json:
        data = request.get_json(silent=True)
        if isinstance(data, dict):
            payload = data

    if "payload" in request.form:
        try:
            data = json.loads(request.form["payload"])
            if isinstance(data, dict):
                payload = data
        except json.JSONDecodeError:
            pass

    return payload


@app.route("/audit", methods=["POST"])
def audit():
    try:
        if model is None:
            return jsonify({"error": "Model is not loaded"}), 500

        payload = read_structured_payload()
        uploaded_file = request.files.get("file")
        content = ""

        if uploaded_file:
            if uploaded_file.filename.lower().endswith(".pdf"):
                content = extract_text_from_pdf(uploaded_file.read())
            else:
                content = uploaded_file.read().decode("utf-8", errors="ignore")

        record = build_model_input(payload, content)
        text_preview = (record.get("report_text") or record.get("description") or "")[:80].replace("\n", " ")

        has_signal = any(
            record.get(key)
            for key in ("name", "description", "brand", "model", "category", "report_text", "ccc_number")
        )
        if not has_signal:
            return jsonify({"error": "Empty content"}), 400

        print(f"Auditing content preview: {text_preview}...")

        prediction = model.predict([record])[0]
        pass_probability = 0.0
        confidence = 0.0

        if hasattr(model, "predict_proba"):
            probability_map = dict(zip(model.classes_, model.predict_proba([record])[0].tolist()))
            pass_probability = float(probability_map.get("PASS", 0.0))
            confidence = float(max(probability_map.values()))

        result = "PASS" if prediction == "PASS" else "FAIL"
        print(f"AI audit result: label={prediction} result={result} pass_probability={pass_probability:.3f}")

        return jsonify(
            {
                "status": "success",
                "result": result,
                "label": prediction,
                "confidence": round(confidence, 4),
                "pass_probability": round(pass_probability, 4),
                "reason_hints": suggest_reason_codes(record),
                "model_version": model_version,
            }
        )

    except Exception as error:
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
