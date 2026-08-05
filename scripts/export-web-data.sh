#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"
.venv/bin/congestion-marl export --output web/public/data/story-v1.json
.venv/bin/congestion-marl validate web/public/data/story-v1.json
