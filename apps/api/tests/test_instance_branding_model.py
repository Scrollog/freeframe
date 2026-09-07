from apps.api.models.instance_branding import DEFAULT_INSTANCE_ORG_NAME, InstanceBranding


def test_instance_branding_table_shape():
    columns = InstanceBranding.__table__.columns

    assert InstanceBranding.__tablename__ == "instance_branding"
    assert {"org_name", "primary_color", "powered_by_freeframe"}.issubset(columns.keys())
    assert {
        "logo_light_key",
        "logo_dark_key",
        "favicon_key",
        "apple_icon_key",
        "login_logo_key",
    }.issubset(columns.keys())
    assert columns["org_name"].server_default.arg == DEFAULT_INSTANCE_ORG_NAME
    assert columns["powered_by_freeframe"].nullable is False
