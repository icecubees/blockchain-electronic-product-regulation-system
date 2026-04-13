import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

# Simple training samples for the prototype audit model.
# 1 means approved, 0 means rejected.
texts = [
    "该电子产品符合 GB/T 18287-2013 标准，电池安全测试合格。",
    "经过检测，各项指标均在安全范围内，准予上市。",
    "产品通过 CCC 认证，绝缘性能良好，无漏电风险。",
    "检测报告结论：合格，符合 IEC 标准要求。",
    "质量稳定，经过 24 小时老化测试，性能正常。",
    "警报：电池在高温测试中发生起火爆炸，存在严重安全隐患。",
    "检测结果：不合格，绝缘电阻低于标准值，存在触电风险。",
    "该批次产品辐射超标，禁止在市场流通。",
    "未通过耐压测试，电路板设计存在明显缺陷。",
    "存在严重质量问题，建议立即召回。",
]

labels = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]

model = make_pipeline(TfidfVectorizer(), MultinomialNB())

print("Training AI audit model...")
model.fit(texts, labels)

joblib.dump(model, "audit_model.pkl")
print("Model saved to audit_model.pkl")

test_text = "本产品经过严格测试，符合安全标准，结论为合格。"
prediction = model.predict([test_text])[0]
print(f"Test text: {test_text}")
print(f"Prediction: {'PASS' if prediction == 1 else 'FAIL'}")
