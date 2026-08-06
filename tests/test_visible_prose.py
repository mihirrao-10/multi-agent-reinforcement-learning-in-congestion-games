from pathlib import Path


def test_visible_sources_have_no_banned_prose() -> None:
    root = Path(__file__).parents[1]
    extensions = {".html", ".ts", ".md", ".json"}
    excluded = {
        "node_modules",
        "dist",
        "build",
        "congestion_marl.egg-info",
        "test-results",
        "playwright-report",
    }
    offenders: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in extensions or excluded.intersection(path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        for banned in (
            "\u2014",
            "Lorem ipsum",
            "Loading exported value",
            "Eighty independent",
            "80 labeled",
            "80 agents",
            "80-agent",
            "3^80",
            "story-v1.json",
            "schema 1.0.0",
        ):
            if banned in text:
                offenders.append(f"{path.relative_to(root)} contains {banned!r}")
        for marker in ("TO" + "DO", "FIX" + "ME"):
            if marker in text:
                offenders.append(f"{path.relative_to(root)} contains unresolved marker")
    assert not offenders, "\n".join(offenders)
