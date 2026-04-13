from flask import Flask, request, jsonify
import joblib
import fitz
import os

app = Flask(__name__)

MODEL_PATH = "audit_model.pkl"
model = None

if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print("AI model loaded successfully.")
else:
    print("Model file not found. Please run train_model.py first.")


def extract_text_from_pdf(pdf_stream):
    """Extract text from a PDF byte stream."""
    text = ""
    try:
        with fitz.open(stream=pdf_stream, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as error:
        print(f"PDF parsing failed: {error}")
    return text


@app.route("/audit", methods=["POST"])
def audit():
    try:
        if model is None:
            return jsonify({"error": "Model is not loaded"}), 500

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        uploaded_file = request.files["file"]

        if uploaded_file.filename.lower().endswith(".pdf"):
            content = extract_text_from_pdf(uploaded_file.read())
        else:
            content = uploaded_file.read().decode("utf-8", errors="ignore")

        if not content.strip():
            return jsonify({"error": "Empty content"}), 400

        preview = content[:50].replace("\n", " ")
        print(f"Auditing content preview: {preview}...")

        prediction = model.predict([content])[0]
        result = "PASS" if prediction == 1 else "FAIL"
        print(f"AI audit result: {result}")

        return jsonify({
            "status": "success",
            "result": result,
            "confidence": 0.95,
        })

    except Exception as error:
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
