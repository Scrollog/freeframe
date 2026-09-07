"""Audio-only media in a video container must not fail video transcoding."""
from types import SimpleNamespace
from unittest.mock import ANY, MagicMock, patch

import pytest

from apps.api.models.asset import AssetType
from apps.api.tasks import transcode_tasks
from packages.transcoder.base import TranscodeResult


def _fixtures():
    asset = SimpleNamespace(id="asset-1", project_id="project-1", asset_type=AssetType.video)
    version = SimpleNamespace(id="version-1")
    media_file = SimpleNamespace(s3_key_raw="raw/audio-only.mp4")
    return asset, version, media_file, MagicMock()


def test_audio_only_video_container_is_retyped_and_processed_as_audio():
    asset, version, media_file, db = _fixtures()
    result = TranscodeResult(
        success=False,
        no_video_stream=True,
        error="No video stream in raw/audio-only.mp4",
    )

    with patch("packages.transcoder.ffmpeg_transcoder.FFmpegTranscoder") as transcoder, \
         patch.object(transcode_tasks, "_run_async", return_value=result), \
         patch.object(transcode_tasks, "_process_audio") as process_audio:
        transcode_tasks._process_video(
            db, asset, version, media_file, MagicMock(), "processed/project/asset/version"
        )

    assert asset.asset_type == AssetType.audio
    db.flush.assert_called_once()
    process_audio.assert_called_once_with(
        db, asset, version, media_file, ANY, "processed/project/asset/version"
    )
    transcoder.return_value.transcode.assert_called_once()


def test_real_video_failure_is_not_reclassified_as_audio():
    asset, version, media_file, db = _fixtures()

    with patch("packages.transcoder.ffmpeg_transcoder.FFmpegTranscoder"), \
         patch.object(transcode_tasks, "_run_async", return_value=TranscodeResult(success=False, error="ffmpeg exited 1")), \
         patch.object(transcode_tasks, "_process_audio") as process_audio:
        with pytest.raises(RuntimeError, match="ffmpeg exited 1"):
            transcode_tasks._process_video(
                db, asset, version, media_file, MagicMock(), "processed/project/asset/version"
            )

    assert asset.asset_type == AssetType.video
    process_audio.assert_not_called()
