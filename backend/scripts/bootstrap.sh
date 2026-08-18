#!/usr/bin/env bash
# ============================================================
# AERO Bootstrap Script
# Starts the complete AERO stack locally using Docker Compose.
# Then generates synthetic data and trains the forecaster.
# ============================================================
set -e

echo "========================================"
echo "  AERO — Bootstrap"
echo "========================================"

# 1. Generate synthetic data and train forecaster
echo "[1/4] Generating synthetic telemetry..."
cd forecaster
python data_generator.py
echo "[2/4] Training XGBoost demand forecaster..."
python train.py
cd ..

# 2. Build and start all services
echo "[3/4] Building Docker images..."
docker compose build

echo "[4/4] Starting AERO stack..."
docker compose up -d

sleep 5

# 3. Health check
echo ""
echo "Health checks:"
curl -sf http://localhost:8000/health && echo "  ✅ API Gateway  :8000"
curl -sf http://localhost:8001/gpus    && echo "  ✅ Simulator    :8001"
curl -sf http://localhost:8002/forecast/model-info && echo "  ✅ Forecaster   :8002"
curl -sf http://localhost:8003/health  && echo "  ✅ Power Ctrl   :8003"
curl -sf http://localhost:8080/health  && echo "  ✅ Extender     :8080"

echo ""
echo "========================================"
echo "  AERO is running. Open:"
echo "  API:        http://localhost:8000"
echo "  Simulator:  http://localhost:8001"
echo "  Forecaster: http://localhost:8002"
echo "  Prometheus: http://localhost:9091/metrics"
echo "========================================"
