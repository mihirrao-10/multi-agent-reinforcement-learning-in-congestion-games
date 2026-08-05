.PHONY: setup format lint typecheck test export validate web-check e2e check

setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/python -m pip install -e ".[dev]"
	cd web && npm install

format:
	.venv/bin/ruff format .
	cd web && npm run format

lint:
	.venv/bin/ruff format --check .
	.venv/bin/ruff check .

typecheck:
	.venv/bin/mypy

test:
	.venv/bin/pytest

export:
	.venv/bin/congestion-marl export --output web/public/data/story-v1.json

validate:
	.venv/bin/congestion-marl validate web/public/data/story-v1.json

web-check:
	cd web && npm run check

e2e:
	cd web && npm run test:e2e

check: lint typecheck test validate web-check e2e
