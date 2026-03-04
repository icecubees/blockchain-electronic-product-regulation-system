# ai_service/app.py
from flask import Flask, request, jsonify
import joblib
import fitz  # PyMuPDF，用于读取 PDF
import os

app = Flask(__name__)

# 加载刚才训练好的模型
MODEL_PATH = 'audit_model.pkl'
if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print("✅ AI 模型加载成功")
else:
    print("❌ 未找到模型文件，请先运行 train_model.py")


def extract_text_from_pdf(pdf_stream):
    """从 PDF 文件流中提取文本"""
    text = ""
    try:
        with fitz.open(stream=pdf_stream, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
    except Exception as e:
        print(f"PDF 解析失败: {e}")
    return text


@app.route('/audit', methods=['POST'])
def audit():
    try:
        # 1. 获取上传的文件
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']

        # 2. 解析 PDF 内容
        # 如果是 PDF，提取文本；如果是纯文本文件，直接读取
        if file.filename.endswith('.pdf'):
            content = extract_text_from_pdf(file.read())
        else:
            content = file.read().decode('utf-8')

        if not content.strip():
            return jsonify({'error': 'Empty content'}), 400

        print(f"📄 正在审核文档内容 (前50字): {content[:50]}...")

        # 3. 使用模型进行预测
        # predict 返回 [1] 或 [0]
        prediction = model.predict([content])[0]

        # 4. 返回结果
        result = "PASS" if prediction == 1 else "FAIL"
        print(f"🤖 AI 判定结果: {result}")

        return jsonify({
            'status': 'success',
            'result': result,
            'confidence': 0.95  # 演示用，真实项目可以用 model.predict_proba
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # 运行在 5000 端口
    app.run(port=5000, debug=True)