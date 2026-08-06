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
	.venv/bin/python -m mypy

test:
	.venv/bin/python -m pytest

export:
	PYTHONPATH=src .venv/bin/python -m congestion_marl.cli export --output web/public/data

validate:
	PYTHONPATH=src .venv/bin/python -m congestion_marl.cli validate web/public/data

web-check:
	cd web && npm run check

e2e:
	cd web && npm run test:e2e

check: lint typecheck test validate web-check e2e
