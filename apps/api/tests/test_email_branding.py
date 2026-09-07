from unittest.mock import patch


def test_email_templates_use_the_instance_name():
    from apps.api.tasks.email_tasks import render_template

    html = render_template(
        "email/magic_code.html",
        subject="Code",
        code="123456",
        expiry_minutes=10,
        org_name="Acme Studio",
    )

    assert "Acme Studio" in html
    assert "Use this code to sign in to Acme Studio" in html
    assert "FreeFrame" not in html


def test_magic_code_subject_uses_resolved_instance_name():
    from apps.api.tasks import email_tasks

    with patch.object(email_tasks, "_send_email", return_value=True), patch(
        "apps.api.services.branding_service.resolve_org_name", return_value="Acme Studio"
    ):
        result = email_tasks.send_magic_code_email.run("member@example.test", "123456")

    assert result["status"] == "sent"
