FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simulator/ .
EXPOSE 8001 9091
CMD ["uvicorn", "gpu_simulator:app", "--host", "0.0.0.0", "--port", "8001"]
