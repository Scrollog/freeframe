from apps.api.models.instance_branding import DEFAULT_INSTANCE_ORG_NAME


def test_public_branding_read_uses_defaults_without_creating_state(client, mock_db):
    mock_db.first.return_value = None

    response = client.get("/instance/branding")

    assert response.status_code == 200
    body = response.json()
    assert body["org_name"] == DEFAULT_INSTANCE_ORG_NAME
    assert body["primary_color"] is None
    assert body["powered_by_freeframe"] is True
    assert body["logo_light_url"] is None
    mock_db.add.assert_not_called()


def test_updating_instance_branding_requires_an_admin(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = False

    response = client.put("/instance/branding", headers=auth_headers, json={"org_name": "Acme Studio"})

    assert response.status_code == 403


def test_admin_updates_safe_instance_branding_values(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = True
    mock_db.first.return_value = None

    response = client.put(
        "/instance/branding",
        headers=auth_headers,
        json={"org_name": "  Acme Studio  ", "primary_color": "#7c3aed", "powered_by_freeframe": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["org_name"] == "Acme Studio"
    assert body["primary_color"] == "#7c3aed"
    assert body["powered_by_freeframe"] is False


def test_admin_can_reset_global_branding(client, auth_headers, mock_db, test_user):
    test_user.is_superadmin = True
    branding = type(
        "Branding",
        (),
        {
            "org_name": "Acme Studio",
            "primary_color": "#7c3aed",
            "powered_by_freeframe": False,
            "logo_light_key": "branding/instance/logo-light/old",
            "logo_dark_key": None,
            "favicon_key": None,
            "apple_icon_key": None,
            "login_logo_key": None,
        },
    )()
    mock_db.first.return_value = branding

    response = client.delete("/instance/branding", headers=auth_headers)

    assert response.status_code == 200
    assert branding.org_name == DEFAULT_INSTANCE_ORG_NAME
    assert branding.primary_color is None
    assert branding.powered_by_freeframe is True
    assert branding.logo_light_key is None


def test_branding_upload_rejects_unknown_slot_or_mime(client, auth_headers, test_user):
    test_user.is_superadmin = True

    response = client.post(
        "/instance/branding/favicon-upload",
        headers=auth_headers,
        params={"content_type": "image/gif"},
    )

    assert response.status_code == 400


def test_branding_upload_pins_a_known_mime_type(client, auth_headers, test_user, monkeypatch):
    from apps.api.routers import instance_branding as module

    test_user.is_superadmin = True
    calls = []
    monkeypatch.setattr(
        module.s3_service,
        "generate_presigned_put_url",
        lambda key, content_type, expires_in: calls.append((key, content_type, expires_in)) or "https://upload.test",
    )

    response = client.post(
        "/instance/branding/logo-light-upload",
        headers=auth_headers,
        params={"content_type": "image/png"},
    )

    assert response.status_code == 201
    assert response.json()["key"].startswith("branding/instance/logo-light/")
    assert calls[0][1:] == ("image/png", 3600)


def test_branding_confirm_rejects_a_key_for_another_slot(client, auth_headers, test_user):
    test_user.is_superadmin = True
    response = client.post(
        "/instance/branding/favicon-confirm",
        headers=auth_headers,
        json={"key": "branding/instance/logo-dark/not-a-favicon"},
    )
    assert response.status_code == 400
