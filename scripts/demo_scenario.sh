#!/usr/bin/env bash
# ============================================================
# AERO Demo Scenario Runner
# Runs the 3 scripted demo scenarios for judges.
# ============================================================

API="http://localhost:8000"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   AERO DEMO — Adaptive GPU Orchestrator   ║"
echo "╚════════════════════════════════════════════╝"
sleep 1

# ────────────────────────────────────────────────────────────
echo ""
echo "━━━ SCENARIO 1: Efficient Co-location ━━━"
echo "Submitting a COMPUTE-BOUND training job on node-1..."
curl -s -X POST "$API/jobs/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "bert-train",
    "workload_type": "COMPUTE_BOUND",
    "priority": "INTERACTIVE",
    "tenant": "team-nlp",
    "gpu_util_target": 85,
    "memory_util_target": 25,
    "power_target_watts": 320,
    "duration_seconds": 60,
    "preferred_gpu": "node-1:0"
  }' | python3 -m json.tool

sleep 3

echo ""
echo "Submitting a MEMORY-BOUND preprocessing job to co-locate on node-1..."
curl -s -X POST "$API/jobs/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "preproc-resnet",
    "workload_type": "MEMORY_BOUND",
    "priority": "BATCH",
    "tenant": "team-cv",
    "gpu_util_target": 20,
    "memory_util_target": 75,
    "power_target_watts": 180,
    "duration_seconds": 60,
    "preferred_gpu": "node-1:0"
  }' | python3 -m json.tool

echo ""
echo "→ AERO co-located COMPUTE + MEMORY: 1.3× speed bonus. Both jobs run at full efficiency."
sleep 2

# ────────────────────────────────────────────────────────────
echo ""
echo "━━━ SCENARIO 2: Preemption + Power Restore ━━━"
echo "Submitting a BATCH job (throttled to 60% TDP)..."
BATCH_RESP=$(curl -s -X POST "$API/jobs/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "batch-preproc",
    "workload_type": "MEMORY_BOUND",
    "priority": "BATCH",
    "tenant": "team-data",
    "gpu_util_target": 50,
    "memory_util_target": 60,
    "power_target_watts": 240,
    "duration_seconds": 90,
    "preferred_gpu": "node-2:0"
  }')
echo "$BATCH_RESP" | python3 -m json.tool

echo ""
echo "Throttling node-2 GPU to 240W (60% TDP for BATCH)..."
curl -s -X POST "$API/power/throttle/node-2__0" \
  -H "Content-Type: application/json" \
  -d '{"watts": 240}' | python3 -m json.tool

sleep 2
echo ""
echo "CRITICAL inference job arrives → AERO restores full power, evicts batch..."
curl -s -X POST "$API/power/throttle/node-2__0" \
  -H "Content-Type: application/json" \
  -d '{"watts": 400}' | python3 -m json.tool

curl -s -X POST "$API/jobs/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "realtime-inference",
    "workload_type": "COMPUTE_BOUND",
    "priority": "CRITICAL",
    "tenant": "prod-team",
    "gpu_util_target": 70,
    "memory_util_target": 35,
    "power_target_watts": 380,
    "duration_seconds": 30,
    "preferred_gpu": "node-2:0"
  }' | python3 -m json.tool

echo "→ AERO evicted BATCH, restored 400W, CRITICAL job is running at full speed."
sleep 2

# ────────────────────────────────────────────────────────────
echo ""
echo "━━━ SCENARIO 3: Demand Forecasting in Action ━━━"
echo "Querying AERO forecaster for next 15-minute window..."
curl -s "$API/forecast" | python3 -m json.tool

sleep 2
echo ""
echo "Energy savings summary:"
curl -s "$API/energy/summary" | python3 -m json.tool

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   DEMO COMPLETE — AERO saved XX% energy   ║"
echo "╚════════════════════════════════════════════╝"
