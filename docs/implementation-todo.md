# Implementation Todo

This is the execution checklist for the local FreeFrame fork. Work on one
checkbox at a time. A box is checked only after the implementation has been
reviewed against existing behaviour and verified by relevant automated tests.

## Implementation rules

Before changing an item:

1. Inspect the current local implementation, its callers, schemas, migrations,
   background jobs, and tests.
2. Compare the relevant upstream design without assuming that a cherry-pick is
   correct for this fork.
3. Reuse an existing local abstraction when it is already correct; do not
   create a parallel implementation.
4. Preserve intentional local product behaviour, especially scoped single-asset
   sharing and project/share branding.
5. Add regression coverage for the failure mode being fixed, run the focused
   tests, and run broader checks proportionate to the change.
6. Mark the item complete in the same change only after those checks pass.

## Uploads and processing

- [x] Recover an upload when multipart completion succeeds but its HTTP response is lost.
- [x] Return the real version state for a retried upload completion.
- [x] Treat temporary object-storage failures as retryable without aborting valid uploads.
- [x] Keep a version in `processing` while Celery retries are pending.
- [x] Requeue genuinely stranded processing jobs after a safe timeout.
- [x] Reconcile the recorded media size with the actual object size after completion.
- [x] Reject invalid or structurally impossible multipart upload sizes.
- [x] Default new share links to comments enabled and downloads disabled.
- [x] Add regression coverage for lost responses, abort races, retries, redeploys, and broker loss.

## Security

- [x] Verify HLS works through authenticated or presigned URLs before changing bucket access.
- [x] Remove public `processed/*` bucket access, including any already-installed production policy.
- [x] Restrict CORS to the actual frontend origin, required methods, and required headers.
- [x] Enforce bcrypt's 72 UTF-8-byte password limit correctly.
- [x] Rate-limit refresh-token requests.
- [x] Validate and bound stored user preferences.
- [x] Generate safe RFC 6266 download content-disposition headers.
- [x] Support deployments mounted under a frontend base path.
- [x] Warn when OpenAPI documentation is exposed on a public production origin.

## Media and real-time UX

- [x] Route audio-only video containers through the audio processing pipeline.
- [x] Make magic-code login copy truthful without disclosing account existence.
- [x] Centralize watermark SSE publishing on the shared event service.
- [x] Verify comment, approval, and transcode SSE contracts remain consistent.

## Cleanup and documentation

- [x] Remove unused tabs and helpers from the legacy review share dialog.
- [x] Remove the unreachable dashboard root page.
- [x] Remove the unused soft-delete middleware.
- [x] Correct `AGENTS.md` for actual soft-delete and retention behaviour.
- [x] Reconcile architecture documentation with local behaviour.
- [x] Document NLE comment export for Resolve, Final Cut, Premiere, and CSV.

## Global instance branding

- [x] Define the instance-branding data model and migration.
- [x] Add administrator APIs to read, update, and reset global branding.
- [x] Support organisation name, light/dark logos, icons, favicon, accent colour, and powered-by visibility.
- [x] Validate, store, and serve branding uploads safely.
- [x] Build the administrative branding settings and preview experience.
- [x] Apply global branding to auth, navigation, dashboard, document title, and favicon.
- [x] Apply global branding to public shares.
- [x] Apply global branding to transactional email templates.
- [x] Define reliable default/fallback branding across themes.
- [x] Preserve project/share branding as an intentional optional override.
- [x] Add API, email, theme/fallback, and public-share regression tests.

## Explicitly out of this cycle

- GPU acceleration and advanced HDR work: the current ARM Coolify VPS has no
  compatible GPU. Reconsider only with supported hardware and representative
  HDR source material.
- Upstream single-asset share navigation: local direct-to-video navigation with
  a scoped Back root is an intentional product decision.
