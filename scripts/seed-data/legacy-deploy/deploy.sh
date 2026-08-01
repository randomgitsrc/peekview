#!/bin/bash
set -euo pipefail
docker pull peekview/backend:1.2.0
kubectl rollout restart deployment/peekview-backend -n peekview
kubectl rollout status deployment/peekview-backend -n peekview --timeout=120s
