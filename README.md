# AERO — Adaptive Energy-aware Resource Orchestrator
**PS32 | VITISH 2026 | Smart India Hackathon**

## What is AERO?
A Kubernetes-native intelligent GPU scheduler that combines:
- ML-based demand forecasting (XGBoost)
- Workload interference profiling (compute-bound vs memory-bound co-location)
- Multi-objective placement scoring (makespan + fairness + energy)
- Dynamic NVML power capping per job priority
- 5-layer architecture fully operable without real GPU hardware

## Quick Start
```bash
git clone https://github.com/<org>/aero
cd aero
pip install -r requirements.txt
bash scripts/bootstrap.sh
bash scripts/demo_scenario.sh
