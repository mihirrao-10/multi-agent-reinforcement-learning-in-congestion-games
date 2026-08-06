#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"
PYTHONPATH=src .venv/bin/python -m congestion_marl.cli export --output web/public/data
PYTHONPATH=src .venv/bin/python -m congestion_marl.cli validate web/public/data
