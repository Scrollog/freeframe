"""Redis-backed SSE event bus for cross-process real-time events."""
import asyncio
import json
import logging
from typing import AsyncGenerator
import redis as sync_redis
import redis.asyncio as aioredis
from ..config import settings

_pool = None
_sync_pool = None
logger = logging.getLogger(__name__)
_PUBLISH_TIMEOUT_SECONDS = 2.0


def _channel(project_id: str) -> str:
    return f"project:{project_id}"


def _encode(event_type: str, payload: dict) -> str:
    return json.dumps({"type": event_type, "payload": payload})


def _get_redis():
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)
    return aioredis.Redis(connection_pool=_pool)


def _get_sync_redis():
    """Return the bounded client used by sync routes and Celery tasks."""
    global _sync_pool
    if _sync_pool is None:
        _sync_pool = sync_redis.ConnectionPool.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=_PUBLISH_TIMEOUT_SECONDS,
            socket_connect_timeout=_PUBLISH_TIMEOUT_SECONDS,
        )
    return sync_redis.Redis(connection_pool=_sync_pool)


async def publish(project_id: str, event_type: str, payload: dict) -> None:
    """Publish an event to a Redis channel for the project."""
    r = _get_redis()
    await r.publish(_channel(project_id), _encode(event_type, payload))


def publish_sync(project_id: str, event_type: str, payload: dict) -> bool:
    """Publish a best-effort event without risking a completed request."""
    try:
        _get_sync_redis().publish(_channel(project_id), _encode(event_type, payload))
        return True
    except Exception:
        logger.warning(
            "SSE publish failed for %s on project %s", event_type, project_id, exc_info=True
        )
        return False


async def event_stream(project_id: str) -> AsyncGenerator[str, None]:
    """Subscribe to a Redis channel and yield SSE messages."""
    r = _get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(_channel(project_id))
    try:
        while True:
            try:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=30.0)
                if message and message["type"] == "message":
                    try:
                        parsed = json.loads(message["data"])
                        event_type = parsed.get("type", "message")
                        payload = json.dumps(parsed.get("payload", parsed))
                        yield f"event: {event_type}\ndata: {payload}\n\n"
                    except (json.JSONDecodeError, TypeError):
                        yield f"data: {message['data']}\n\n"
                else:
                    yield ": keepalive\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        await pubsub.unsubscribe(f"project:{project_id}")
        await pubsub.aclose()
