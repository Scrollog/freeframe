# Upstream Sync Ledger

This is the complete, behaviour-level comparison with upstream
[`Techiebutler/freeframe`](https://github.com/Techiebutler/freeframe), not a
cherry-pick plan. A local implementation can deliberately differ from an
upstream patch, so commit distance alone does not say which product behaviour
is present.

## Baseline

- Fork remote: `origin` (`Scrollog/freeframe`)
- Upstream remote: `upstream` (`Techiebutler/freeframe`)
- Last common ancestor: `17db3303fb1294dea81a44a998e59804f036f98a`
- At the time this ledger was refreshed, `origin/main` was 40 commits ahead of
  and 31 commits behind `upstream/main`.

The 40 local commits are not a defect or a count of work to discard. They are
the project's independent history. The table below records the 31 upstream
commits after the common ancestor and the intended local decision for each.

## Status meanings

| Status | Meaning |
| --- | --- |
| Adopted | The local code provides the complete relevant behaviour and tests it. |
| Partially adopted | A useful subset is local; the stated remaining work is still real. |
| Already present | The local implementation pre-dated the upstream patch. |
| Pending implementation | A compatible behaviour is missing and should be built locally, not blindly cherry-picked. |
| Deferred | A compatible change exists, but it is not justified for the current product or deployment. |
| Not planned | It conflicts with an intentional local product decision. |
| No runtime action | Release or documentation-only metadata; there is no application code to port. |

## Complete upstream commit inventory

| Upstream commit | Status locally | Exact comparison and required decision |
| --- | --- | --- |
| [`65e2113`](https://github.com/Techiebutler/freeframe/commit/65e2113) `security audit fixes` | Adopted | The secure-share authentication gate is local and centrally enforced. HLS manifests use the authenticated proxy and segments use presigned URLs, so startup no longer creates public `processed/*` access; the production bucket was read-only checked and has no matching legacy policy. Local code now also enforces bcrypt's 72 UTF-8-byte rule, rate-limits refresh-token requests, bounds stored preferences, restricts CORS to known origins and required request metadata, emits safe RFC 6266 download dispositions, warns about public production OpenAPI documentation, and makes frontend redirects and links base-path-aware. Local share search already escapes its one search value, and no direct `like`/`ilike` call sites were found, so a central helper is preventive cleanup rather than a known current query flaw. |
| [`f77cce0`](https://github.com/Techiebutler/freeframe/commit/f77cce0) `instance branding` | Partially adopted | The local singleton `InstanceBranding` model and a linear migration from the current local Alembic head are in place. It intentionally remains separate from authenticated operational `InstanceSettings`, because login and public-share surfaces must be able to resolve branding. Administrator APIs, uploads, UI, public surfaces, emails, and regression coverage remain tracked in the global-branding checklist. |
| [`22354f4`](https://github.com/Techiebutler/freeframe/commit/22354f4) `validate completion asset id` | Adopted | Local `/upload/complete` rejects an `asset_id` that is not the named version's asset before storage access or task dispatch. Regression coverage is local. |
| [`90fdf7d`](https://github.com/Techiebutler/freeframe/commit/90fdf7d) `ask server before marking upload failed` | Adopted | Both local upload paths now re-read the specific version after a completion request fails. A matching `processing` or `ready` version wins over the browser error, so the UI preserves the successful upload and skips abort. The shared recovery routine also re-checks after abort, because the existing server abort path can rescue an assembled object whose state write did not land. Regression coverage includes new assets, new versions, older ready versions, genuine failures, and user cancellation during the read. |
| [`f39a2de`](https://github.com/Techiebutler/freeframe/commit/f39a2de) `retry completion returns status` | Adopted | A repeated `/upload/complete` validates the recorded upload id and returns the current `processing` or `ready` state when the assembled object is present. Object-size probes use short dedicated timeouts and distinguish absence from uncertainty; temporary storage failures during completion or abort return retryable `503` without changing the version. Failed versions and unknown upload ids remain conflicts, and no retry dispatches a second transcode. |
| [`d8bc6eb`](https://github.com/Techiebutler/freeframe/commit/d8bc6eb) `branding controls and preview` | Deferred | This repairs the feature introduced by `f77cce0`: persistence, preview, contrast, share appearance, and tests. It cannot be selectively useful without adopting instance branding first. |
| [`076ee54`](https://github.com/Techiebutler/freeframe/commit/076ee54) `release v1.10.0` | No runtime action | Release notes and version metadata only. Do not copy a release marker into an independently versioned fork. |
| [`c7a8853`](https://github.com/Techiebutler/freeframe/commit/c7a8853) `portable NVENC/VAAPI and HDR` | Deferred | Upstream adds optional GPU-driver build support, NVENC/VAAPI detection and CPU fallback, selectable H.264/HEVC output, HDR/Dolby Vision handling, tone mapping, thumbnail colour fixes, and extensive FFmpeg tests. The current Coolify host is ARM and CPU-only, so NVENC/VAAPI cannot be used there. CPU-side HDR correctness could be adopted later, but only with representative HDR/Dolby Vision samples and a dedicated media-quality test plan; it is not a safe blind merge. |
| [`d399b77`](https://github.com/Techiebutler/freeframe/commit/d399b77) `hardware transcoding documentation` | Deferred | Deployment/README documentation for `c7a8853`. It belongs only if the optional hardware backend is adopted. |
| [`56c9ecb`](https://github.com/Techiebutler/freeframe/commit/56c9ecb) `NLE comment export guide` | Adopted | `docs/comment-export.md` now documents export workflow, Resolve EDL, Final Cut FCPXML, Premiere XML and CSV choices, video-only constraints, source FPS selection, default EDL start timecode, variable-frame-rate caveats, and troubleshooting. README links to the guide. |
| [`335e521`](https://github.com/Techiebutler/freeframe/commit/335e521) `remove dead review share tabs` | Adopted | `components/review/share-dialog.tsx` now contains only the mounted dropdown and its ShareCreateDialog integration. The unused tabbed link/direct-share UI, its redundant types, controls, state, and imports were removed after confirming no call site referenced them. TypeScript validation covers the retained flow. |
| [`f8f798f`](https://github.com/Techiebutler/freeframe/commit/f8f798f) `do not remove React-managed icons` | Deferred | This corrects icon handling in upstream's instance-branding head component and moves favicon assets. It has no matching local global branding component. Re-evaluate only with `f77cce0`. |
| [`3e44ffa`](https://github.com/Techiebutler/freeframe/commit/3e44ffa) `restore full-logo arc` | Deferred | A one-line upstream SVG visual correction. Local currently uses a different logo asset arrangement, including `logo-full.png` in the auth layout. It should be reviewed as part of a deliberate visual-brand asset update, not copied as an isolated SVG change that may not render anywhere locally. |
| [`a541104`](https://github.com/Techiebutler/freeframe/commit/a541104) `correct setIcon rationale` | No runtime action | Tests/comments explaining the upstream branding favicon sweep. It only accompanies the branding icon fix and has no standalone local behaviour. |
| [`43fe9ba`](https://github.com/Techiebutler/freeframe/commit/43fe9ba) `branding fallback surfaces` | Deferred | Upstream applies unconfigured-branding fallback colours/logos across settings, auth, shares, sidebar, notifications, and upload surfaces. It depends on instance branding and should not be mixed into the local project/share branding model piecemeal. |
| [`4cab0c6`](https://github.com/Techiebutler/freeframe/commit/4cab0c6) `remove unreachable dashboard home` | Adopted | The duplicate `apps/web/app/(dashboard)/page.tsx` route was removed after confirming there are no importers. The canonical root route remains `apps/web/app/page.tsx`, which redirects `/` to `/projects`; the dashboard route group contributes no URL segment and therefore must not define a competing root page. |
| [`67e9383`](https://github.com/Techiebutler/freeframe/commit/67e9383) `correct AGENTS.md` | Adopted | The operational guide now states that soft delete is model-specific, query filtering is explicit rather than middleware-driven, and maintenance retention GC permanently removes eligible soft-deleted roots and their storage after the configured window. |
| [`a6bc268`](https://github.com/Techiebutler/freeframe/commit/a6bc268) `correct architecture documentation` | Adopted | Architecture documentation now reflects the local worker-originated SSE flow and exact payloads, presigned streaming HLS pipeline, audio-only-container reroute, active project/share authorization paths, current storage prefixes, explicit soft-delete filtering and retention GC, and the actual model relationships. It intentionally avoids importing upstream-only GPU and organization claims. |
| [`5ba6754`](https://github.com/Techiebutler/freeframe/commit/5ba6754) `SSE event producers` | Partially adopted | Local publishes bounded best-effort events for comments, replies, guest comments, comment resolution, approvals, transcoding, and watermark completion. Watermark tasks use the shared event service instead of opening an independent Redis connection. Contract tests pin the comment, approval, and transcode payloads on both producer and hook sides. Approval events still have no currently mounted review consumer because the approval bar is intentionally not mounted on the current review page; that display-side product decision remains separate from event production. |
| [`1c2237f`](https://github.com/Techiebutler/freeframe/commit/1c2237f) `remove soft-delete middleware` | Adopted | The unused helper was removed after confirming it had no runtime import or registration. Soft-delete filtering remains explicit at query sites, as documented in `AGENTS.md`; retention cleanup remains the intentional hard-deletion mechanism. |
| [`8e3a260`](https://github.com/Techiebutler/freeframe/commit/8e3a260) `clear compare offsets` | Already present | Local compare selection already clears both pane synchronization offsets whenever either version changes. |
| [`04653fd`](https://github.com/Techiebutler/freeframe/commit/04653fd) `clear compare annotation` | Already present | Local compare selection already clears the switched pane's stale annotation. |
| [`c322e03`](https://github.com/Techiebutler/freeframe/commit/c322e03) `release v1.11.0` | No runtime action | Release metadata only. |
| [`8f5e299`](https://github.com/Techiebutler/freeframe/commit/8f5e299) `audio-only video container` | Adopted | The FFmpeg transcoder reports an absent video stream as an explicit result instead of constructing an invalid HLS ladder. The task changes the asset type to audio and reuses the normal audio pipeline. Regression coverage proves the reroute, preserves ordinary video metadata processing, and ensures genuine FFmpeg failures still raise. |
| [`e8f4da4`](https://github.com/Techiebutler/freeframe/commit/e8f4da4) `honest magic-code message` | Adopted | The magic-code step now uses conditional delivery wording, shows an address-typo hint while there is no verification error, and has a prominent action to return to the email step. The API response is intentionally unchanged, preserving its account-enumeration protection; UI tests cover the wording and correction flow. |
| [`e7a34cd`](https://github.com/Techiebutler/freeframe/commit/e7a34cd) `claim before dispatch` | Partially adopted | Local completion now atomically claims `uploading -> processing` before dispatch, so concurrent requests do not launch duplicate transcodes. It still needs the lost-response and lifecycle recovery from `90fdf7d`, `f39a2de`, and `8bfded9`. |
| [`8bfded9`](https://github.com/Techiebutler/freeframe/commit/8bfded9) `processing lifecycle and recovery` | Adopted | Celery keeps a version in `processing` while a retry is scheduled, records failure only after retries are exhausted, and records failure if the retry cannot be enqueued. A separate hourly maintenance task requeues only versions beyond the configurable six-hour safety window; if processed output already exists, it marks the version ready instead. The stale-upload reaper no longer converts recoverable processing rows into failures. |
| [`7b16216`](https://github.com/Techiebutler/freeframe/commit/7b16216) `actual size and comment default` | Adopted | Completion records `HeadObject`'s actual size best-effort, and initiation rejects non-positive or multipart-impossible sizes. New public review links default consistently to commenting while downloads remain opt-in; direct authenticated shares and the validation fallback remain read-only by design. |
| [`97a29f2`](https://github.com/Techiebutler/freeframe/commit/97a29f2) `release v1.12.0` | No runtime action | Release metadata only. |
| [`ab073f7`](https://github.com/Techiebutler/freeframe/commit/ab073f7) `single-asset shares use folder review screen` | Not planned | Local single-video links intentionally open directly on the video, with a scoped root containing only that video available through Back. Upstream intentionally sends all single-asset links through the folder-share review screen. These are incompatible navigation contracts; retain the local one. |
| [`5f9b071`](https://github.com/Techiebutler/freeframe/commit/5f9b071) `themed default logo` | Deferred | Upstream extracts repeated default-logo rendering into a tested theme-aware component as part of the branding work. It is a clean refactor but has few matching local call sites until instance-level branding/asset consolidation is chosen. |

## Implementation order for compatible missing work

1. **Upload reliability and truthful processing state** — implement `90fdf7d`,
   `f39a2de`, `8bfded9`, and the storage-size part of `7b16216` as one cohesive
   change. This must cover lost completion responses, storage timeouts, abort
   races, duplicate completion, Celery retry exhaustion, broker-dispatch loss,
   redeploy recovery, and actual object-size reconciliation. Do not split the
   client recovery from the server answers it depends on.
2. **Security hardening** — complete the remaining compatible portions of
   `65e2113`. Before removing the public `processed/*` policy on a live bucket,
   verify HLS through authenticated/presigned proxy URLs and explicitly remove
   any policy already installed; merely changing startup code does not remove an
   existing public policy. Then tighten CORS, auth validation/rate limiting,
   preferences, headers, and base-path support with regression tests.
3. **Media correctness** — implement audio-only container routing from
   `8f5e299`. Consider the CPU HDR part of `c7a8853` only after adding real HDR
   fixtures; keep GPU acceleration disabled on the current ARM CPU-only VPS.
4. **Small compatible UX and cleanup** — apply `e8f4da4`, remove the three dead
   surfaces (`335e521`, `4cab0c6`, `1c2237f`), and update the NLE/architecture/
   contributor documentation (`56c9ecb`, `67e9383`, `a6bc268`).
5. **Explicit product decision, not upstream sync** — decide whether the product
   needs instance-level white-label branding. Only then implement the coherent
   branding set (`f77cce0`, `d8bc6eb`, `f8f798f`, `3e44ffa`, `a541104`,
   `43fe9ba`, `5f9b071`).

## Update workflow

```bash
git fetch upstream
git rev-list --left-right --count origin/main...upstream/main
git log --left-right --cherry-pick --oneline origin/main...upstream/main
```

`--cherry-pick` identifies identical patches only. Update this ledger in the
same change that implements, defers, or rejects an upstream behaviour; it is
the authoritative explanation for intentional divergence.
