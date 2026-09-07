"""CORS must permit FreeFrame's client without granting arbitrary browser origins."""


def _preflight(client, origin: str):
    return client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type,range",
        },
    )


def test_cors_allows_the_configured_frontend_with_required_headers(client):
    response = _preflight(client, "http://localhost:3000")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "DELETE" in response.headers["access-control-allow-methods"]
    assert "Range" in response.headers["access-control-allow-headers"]


def test_cors_rejects_an_unconfigured_origin(client):
    response = _preflight(client, "https://untrusted.example")

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
