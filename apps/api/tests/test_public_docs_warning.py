import logging

from apps.api.config import settings
from apps.api import main


def test_public_frontend_with_docs_enabled_logs_a_warning(monkeypatch, caplog):
    monkeypatch.setattr(settings, "frontend_url", "https://frame.example.com")
    monkeypatch.setattr(main, "_disable_docs", False)

    with caplog.at_level(logging.WARNING):
        main._warn_public_docs()

    assert "DISABLE_DOCS=true" in caplog.text
