// Private API publisher protocol. Instagram sessions and passwords stay on the runner.
import { entitlement, isOwner } from './plans.js';
const MAX_MEDIA_BYTES = 6 * 1024 * 1024;
export const MAX_STORY_REQUEST_BYTES = Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 32 * 1024;
const MEDIA_TTL_SECONDS = 48 * 60 * 60;
const ACTIVE = ["claimed", "preparing", "publishing"];
const RETIRED_ACTIONS = new Set(["registerStoryAgent", "getAgentRelease", "getNextStoryJob", "updateStoryJob", "getStoryMedia"]);
const ACTIONS = new Set(["registerInstagramPublisher", "bindInstagramAccount", "getStoryPublishingConfig", "createStoryJob", "getStoryJob", "getNextInstagramStoryJob", "updateInstagramStoryJob", "getInstagramStoryMedia", "getInstagramPublisherJob"]);
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" };

function response(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: HEADERS }); }
function fail(code, status = 400) { const error = new Error(code); error.status = status; throw error; }
function now() { return new Date().toISOString(); }
function id(value, maximum = 160) {
  const text = String(value || "").trim();
  if (!text || text.length > maximum || !/^[a-zA-Z0-9._:-]+$/.test(text)) fail("invalid_identifier");
  return text;
}
function bearer(request) { return String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); }
async function sha256(value) {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function equalSecret(left, right) {
  // Hash to fixed length before timing-safe comparison; never log credentials.
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(left))));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(right))));
  if (typeof crypto.subtle.timingSafeEqual === "function") return crypto.subtle.timingSafeEqual(a, b);
  let diff = 0; for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}
async function owner(env, request, payload) {
  const supplied = payload.owner_key || bearer(request);
  if (!await isOwner(env, request, supplied)) fail("unauthorized", 401);
}
async function restaurant(env, slugValue, token) {
  const slug = id(slugValue, 100).toLowerCase();
  const row = await env.DB.prepare("SELECT id, slug, admin_token, story_link FROM restaurants WHERE slug = ? LIMIT 1").bind(slug).first();
  if (!row || !row.admin_token || !token || !(await equalSecret(token, row.admin_token))) fail("unauthorized", 401);
  return row;
}
async function publisher(env, request, publisherId) {
  const identifier = id(publisherId, 100);
  const row = await env.DB.prepare("SELECT * FROM instagram_publishers WHERE publisher_id = ? AND is_active = 1 LIMIT 1").bind(identifier).first();
  const token = bearer(request);
  if (!row || !token || !(await equalSecret(await sha256(token), row.token_hash))) fail("unauthorized_publisher", 401);
  return row;
}
async function bindingFor(env, restaurantId) {
  return env.DB.prepare(`SELECT b.*, p.is_active AS publisher_active FROM instagram_account_bindings b
    JOIN instagram_publishers p ON p.publisher_id = b.publisher_id WHERE b.restaurant_id = ? LIMIT 1`).bind(restaurantId).first();
}
async function configuration(env, restaurantId) {
  const binding = await bindingFor(env, restaurantId);
  const access = await entitlement(env, restaurantId);
  const unknown = binding && await env.DB.prepare("SELECT id FROM instagram_story_jobs WHERE restaurant_id = ? AND status = 'outcome_unknown' LIMIT 1").bind(restaurantId).first();
  const state = unknown ? "outcome_unknown" : !access.features.autopublish ? "plan_required" : !binding ? "unconfigured" : !binding.publisher_active ? "publisher_inactive"
    : !binding.enabled || env.INSTAGRAM_PUBLISHING_ENABLED === "false" ? "disabled" : "ready";
  return { provider: "private_api", enabled: state === "ready", state,
    publisher_id: binding?.publisher_id || null, instagram_username: binding?.instagram_username || null, instagram_user_id: binding?.instagram_user_id || null };
}
function publicJob(job) {
  if (!job) return null;
  const { claim_token, media_key, request_sha256, ...safe } = job;
  return { ...safe, provider: "private_api" };
}
async function jobById(env, jobId) { return env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE id = ? LIMIT 1").bind(jobId).first(); }
async function assignedJob(env, request, params, payload = {}) {
  const agent = await publisher(env, request, payload.publisher_id || params.get("publisher_id"));
  const jobId = id(payload.job_id || params.get("job_id") || params.get("job"));
  const job = await jobById(env, jobId);
  const token = payload.claim_token || request.headers.get("x-claim-token");
  if (!job || job.publisher_id !== agent.publisher_id || !token || !job.claim_token || !(await equalSecret(token, job.claim_token))) fail("story_job_not_assigned", 409);
  return job;
}
function matchesBinding(job, config) {
  return config.publisher_id === job.publisher_id && config.instagram_username === job.instagram_username && config.instagram_user_id === job.instagram_user_id;
}
async function privateJobResult(env, request, job) {
  const publishing = await configuration(env, job.restaurant_id);
  const mediaUrl = new URL(request.url);
  mediaUrl.search = "";
  mediaUrl.searchParams.set("action", "getInstagramStoryMedia");
  mediaUrl.searchParams.set("publisher_id", job.publisher_id);
  mediaUrl.searchParams.set("job_id", job.id);
  return { job: { ...publicJob(job), claim_token: job.claim_token, media_url: mediaUrl.toString() }, publishing,
    can_publish: publishing.enabled && matchesBinding(job, publishing) && ACTIVE.includes(job.status) };
}
async function register(env, request, payload) {
  await owner(env, request, payload);
  const publisherId = id(payload.publisher_id, 100);
  const token = String(payload.publisher_token || "");
  if (token.length < 32 || token.length > 512) fail("invalid_publisher_credentials");
  const label = String(payload.label || "Publicador QrStack").trim().slice(0, 120);
  const version = String(payload.version || "").trim().slice(0, 40);
  const timestamp = now();
  await env.DB.prepare(`INSERT INTO instagram_publishers(publisher_id, token_hash, label, version, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(publisher_id) DO UPDATE SET token_hash = excluded.token_hash,
    label = excluded.label, version = excluded.version, is_active = 1, updated_at = excluded.updated_at`)
    .bind(publisherId, await sha256(token), label, version, timestamp, timestamp).run();
  return { publisher: { publisher_id: publisherId, label, version, provider: "private_api" } };
}
async function bindAccount(env, request, payload) {
  await owner(env, request, payload);
  const slug = id(payload.slug, 100).toLowerCase();
  const tenant = await env.DB.prepare("SELECT id, slug FROM restaurants WHERE slug = ? LIMIT 1").bind(slug).first();
  if (!tenant) fail("restaurant_not_found", 404);
  const publisherId = id(payload.publisher_id, 100);
  const agent = await env.DB.prepare("SELECT publisher_id FROM instagram_publishers WHERE publisher_id = ? AND is_active = 1 LIMIT 1").bind(publisherId).first();
  if (!agent) fail("publisher_not_registered", 409);
  const username = String(payload.instagram_username || "").trim().replace(/^@/, "").toLowerCase();
  const userId = String(payload.instagram_user_id || "").trim();
  if (!/^[a-z0-9._]{1,30}$/.test(username) || !/^[1-9][0-9]{0,30}$/.test(userId)) fail("invalid_instagram_account");
  if (typeof payload.enabled !== "boolean") fail("enabled_boolean_required");
  const previous = await bindingFor(env, tenant.id);
  const changed = previous && (previous.publisher_id !== publisherId || previous.instagram_user_id !== userId || previous.instagram_username !== username);
  const unresolved = await env.DB.prepare(`SELECT id FROM instagram_story_jobs WHERE restaurant_id = ? AND status IN ('pending','claimed','preparing','publishing','outcome_unknown') LIMIT 1`).bind(tenant.id).first();
  if (changed && unresolved) fail("account_has_unresolved_jobs", 409);
  const other = await env.DB.prepare("SELECT restaurant_id FROM instagram_account_bindings WHERE instagram_user_id = ? AND restaurant_id <> ? LIMIT 1").bind(userId, tenant.id).first();
  if (other) fail("instagram_account_already_bound", 409);
  const timestamp = now();
  try {
    const result = await env.DB.prepare(`INSERT INTO instagram_account_bindings(restaurant_id, restaurant_slug, publisher_id, instagram_username, instagram_user_id, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(restaurant_id) DO UPDATE SET publisher_id = excluded.publisher_id,
      instagram_username = excluded.instagram_username, instagram_user_id = excluded.instagram_user_id, enabled = excluded.enabled, updated_at = excluded.updated_at
      WHERE (instagram_account_bindings.publisher_id = excluded.publisher_id AND instagram_account_bindings.instagram_username = excluded.instagram_username
        AND instagram_account_bindings.instagram_user_id = excluded.instagram_user_id)
      OR NOT EXISTS(SELECT 1 FROM instagram_story_jobs j WHERE j.restaurant_id = excluded.restaurant_id
        AND j.status IN ('pending','claimed','preparing','publishing','outcome_unknown'))`)
      .bind(tenant.id, slug, publisherId, username, userId, payload.enabled ? 1 : 0, timestamp, timestamp).run();
    if (!Number(result.meta?.changes)) fail("account_has_unresolved_jobs", 409);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed: instagram_account_bindings.instagram_user_id")) fail("instagram_account_already_bound", 409);
    throw error;
  }
  return { publishing: await configuration(env, tenant.id) };
}
function decodeImage(payload) {
  const source = String(payload.image_base64 || "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!source || source.length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4) fail("invalid_story_media_size", 413);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(source) || source.length % 4 !== 0) fail("invalid_story_media");
  let binary;
  try { binary = atob(source); } catch { fail("invalid_story_media"); }
  if (!binary.length || binary.length > MAX_MEDIA_BYTES) fail("invalid_story_media_size", 413);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const type = String(payload.content_type || "image/png").toLowerCase();
  const png = bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) && binary.slice(12, 16) === "IHDR";
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  const webp = bytes.length >= 20 && binary.slice(0, 4) === "RIFF" && binary.slice(8, 12) === "WEBP";
  if (!(new Map([["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]])).get(type)) fail("invalid_story_media_type", 415);
  return { bytes, type };
}
async function enqueue(env, payload) {
  const tenant = await restaurant(env, payload.slug, payload.token);
  const clientId = id(payload.client_request_id);
  const config = await configuration(env, tenant.id);
  let link;
  try { link = new URL(String(payload.story_link || tenant.story_link || "")); } catch { fail("invalid_story_link"); }
  if (link.protocol !== "https:" || link.username || link.password || link.href.length > 2000) fail("invalid_story_link");
  const { bytes, type } = decodeImage(payload);
  const mediaHash = await sha256(bytes);
  const menuDayId = String(payload.menu_day_id || "").slice(0, 160);
  const requestHash = await sha256(JSON.stringify([menuDayId, link.href, mediaHash, type]));
  const existing = await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE restaurant_id = ? AND client_request_id = ? LIMIT 1").bind(tenant.id, clientId).first();
  if (existing) {
    if (existing.request_sha256 !== requestHash) fail("idempotency_key_conflict", 409);
    return { job: publicJob(existing), duplicate: true };
  }
  if (!config.enabled) fail(config.state === "outcome_unknown" ? "instagram_outcome_unknown" : "instagram_account_not_ready", 409);
  const jobId = `ig_story_${crypto.randomUUID()}`;
  const mediaKey = `instagram-stories/${tenant.slug}/${jobId}`;
  const timestamp = now();
  const imageSource = ["upload", "auto", "generated"].includes(payload.image_source) ? payload.image_source : null;
  await env.INSIGHTS_CACHE.put(mediaKey, bytes, { expirationTtl: MEDIA_TTL_SECONDS, metadata: { contentType: type, sha256: mediaHash } });
  try {
    // Recheck binding in INSERT to close the enqueue/configuration race.
    const statements = [env.DB.prepare(`INSERT INTO instagram_story_jobs(
      id, restaurant_id, restaurant_slug, publisher_id, instagram_username, instagram_user_id, menu_day_id,
      story_link, media_key, media_sha256, content_type, media_bytes, image_source, client_request_id, request_sha256,
      status, checkpoint, queued_at, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'queued', ?, ?, ?
      WHERE EXISTS(SELECT 1 FROM instagram_account_bindings b JOIN instagram_publishers p ON p.publisher_id = b.publisher_id
        WHERE b.restaurant_id = ? AND b.publisher_id = ? AND b.instagram_username = ? AND b.instagram_user_id = ? AND b.enabled = 1 AND p.is_active = 1)
      AND NOT EXISTS(SELECT 1 FROM instagram_story_jobs WHERE restaurant_id = ? AND status = 'outcome_unknown')
      AND EXISTS(SELECT 1 FROM restaurant_plans WHERE restaurant_id = ? AND plan = 'performance')
      ON CONFLICT(restaurant_id, client_request_id) DO NOTHING`)
      .bind(jobId, tenant.id, tenant.slug, config.publisher_id, config.instagram_username, config.instagram_user_id, menuDayId || null,
        link.href, mediaKey, mediaHash, type, bytes.length, imageSource, clientId, requestHash, timestamp, timestamp, timestamp,
        tenant.id, config.publisher_id, config.instagram_username, config.instagram_user_id, tenant.id, tenant.id),
      env.DB.prepare(`INSERT INTO instagram_story_job_events(id, job_id, publisher_id, status, checkpoint, created_at)
        SELECT ?, ?, ?, 'pending', 'queued', ? WHERE changes() > 0`)
        .bind(`ig_event_${crypto.randomUUID()}`, jobId, config.publisher_id, timestamp)];
    const [inserted] = await env.DB.batch(statements);
    if (!Number(inserted.meta?.changes)) {
      const duplicate = await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE restaurant_id = ? AND client_request_id = ? LIMIT 1").bind(tenant.id, clientId).first();
      if (!duplicate) fail("instagram_account_not_ready", 409);
      if (duplicate.request_sha256 !== requestHash) fail("idempotency_key_conflict", 409);
      await env.INSIGHTS_CACHE.delete(mediaKey);
      return { job: publicJob(duplicate), duplicate: true };
    }
  } catch (error) { await env.INSIGHTS_CACHE.delete(mediaKey); throw error; }
  const job = await jobById(env, jobId);
  return { job: publicJob(job), duplicate: false };
}
async function claim(env, request, params) {
  const agent = await publisher(env, request, params.get("publisher_id"));
  const timestamp = now();
  await env.DB.prepare("UPDATE instagram_publishers SET last_seen_at = ?, updated_at = ? WHERE publisher_id = ?").bind(timestamp, timestamp, agent.publisher_id).run();
  let job = await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE publisher_id = ? AND status IN ('claimed','preparing','publishing') ORDER BY claimed_at LIMIT 1").bind(agent.publisher_id).first();
  if (!job && env.INSTAGRAM_PUBLISHING_ENABLED !== "false") {
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const statements = [env.DB.prepare(`UPDATE instagram_story_jobs SET status = 'claimed', checkpoint = 'claimed', claim_token = ?, claimed_at = ?, updated_at = ?
      WHERE id = (SELECT j.id FROM instagram_story_jobs j JOIN instagram_account_bindings b ON b.restaurant_id = j.restaurant_id
        WHERE j.publisher_id = ? AND j.status = 'pending' AND b.enabled = 1 AND b.publisher_id = j.publisher_id
          AND b.instagram_user_id = j.instagram_user_id AND b.instagram_username = j.instagram_username
          AND EXISTS(SELECT 1 FROM restaurant_plans WHERE restaurant_id = j.restaurant_id AND plan = 'performance')
          AND NOT EXISTS(SELECT 1 FROM instagram_story_jobs uncertain WHERE uncertain.restaurant_id = j.restaurant_id AND uncertain.status = 'outcome_unknown')
        ORDER BY j.queued_at, j.id LIMIT 1)
      AND status = 'pending'
      AND NOT EXISTS(SELECT 1 FROM instagram_story_jobs active WHERE active.publisher_id = ? AND active.status IN ('claimed','preparing','publishing'))`)
      .bind(token, timestamp, timestamp, agent.publisher_id, agent.publisher_id),
      env.DB.prepare(`INSERT INTO instagram_story_job_events(id, job_id, publisher_id, status, checkpoint, created_at)
        SELECT ?, id, publisher_id, 'claimed', 'claimed', ? FROM instagram_story_jobs WHERE claim_token = ? AND changes() > 0`)
        .bind(`ig_event_${crypto.randomUUID()}`, timestamp, token)];
    const [result] = await env.DB.batch(statements);
    if (Number(result.meta?.changes)) {
      job = await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE publisher_id = ? AND claim_token = ? LIMIT 1").bind(agent.publisher_id, token).first();
    } else {
      job = await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE publisher_id = ? AND status IN ('claimed','preparing','publishing') LIMIT 1").bind(agent.publisher_id).first();
    }
  }
  return job ? { ...(await privateJobResult(env, request, job)), poll_after_seconds: 3 } : { job: null, poll_after_seconds: 15 };
}

async function update(env, request, params, payload) {
  const job = await assignedJob(env, request, params, payload);
  const status = String(payload.status || "");
  const checkpoint = id(payload.checkpoint || status, 100);
  const errorCode = payload.error_code ? id(payload.error_code, 160) : null;
  const mediaId = payload.media_id ? id(payload.media_id, 160) : null;
  const transitions = { preparing: ["claimed", "preparing"], publishing: ["claimed", "preparing"], completed: ["publishing", "outcome_unknown"],
    failed_attention: ["claimed", "preparing"], outcome_unknown: ["claimed", "preparing", "publishing", "outcome_unknown"], cancelled: ["claimed", "preparing"] };
  if (!Object.hasOwn(transitions, status)) fail("invalid_story_job_update");
  if (status === "completed" && !mediaId) fail("media_id_required");
  if (job.status === "completed" && status === "completed" && job.media_id === mediaId) return { job: publicJob(job), duplicate: true };
  if (status === "failed_attention" && job.status === "failed_attention") return { job: publicJob(job), duplicate: true };
  if (!transitions[status].includes(job.status)) fail("invalid_story_job_transition", 409);
  if (status === "publishing" || status === "preparing") {
    const config = await configuration(env, job.restaurant_id);
    if (!config.enabled || !matchesBinding(job, config)) fail("instagram_account_not_ready", 409);
  }
  const timestamp = now();
  const placeholders = transitions[status].map(() => "?").join(",");
  const guarded = ["preparing", "publishing"].includes(status);
  // The status change and audit event commit atomically. Publishing is NEVER an idempotent grant.
  const statements = [env.DB.prepare(`UPDATE instagram_story_jobs SET status = ?, checkpoint = ?, error_code = ?,
    media_id = COALESCE(?, media_id), started_at = CASE WHEN ? = 'publishing' THEN COALESCE(started_at, ?) ELSE started_at END,
    completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE completed_at END, updated_at = ?
    WHERE id = ? AND publisher_id = ? AND claim_token = ? AND status IN (${placeholders})
    ${guarded ? `AND EXISTS(SELECT 1 FROM instagram_account_bindings b JOIN instagram_publishers p ON p.publisher_id = b.publisher_id
      WHERE b.restaurant_id = instagram_story_jobs.restaurant_id AND b.publisher_id = instagram_story_jobs.publisher_id
      AND b.instagram_username = instagram_story_jobs.instagram_username AND b.instagram_user_id = instagram_story_jobs.instagram_user_id AND b.enabled = 1 AND p.is_active = 1)
      AND EXISTS(SELECT 1 FROM restaurant_plans WHERE restaurant_id = instagram_story_jobs.restaurant_id AND plan = 'performance')
      AND NOT EXISTS(SELECT 1 FROM instagram_story_jobs uncertain WHERE uncertain.restaurant_id = instagram_story_jobs.restaurant_id AND uncertain.status = 'outcome_unknown')` : ""}`)
    .bind(status, checkpoint, errorCode, mediaId, status, timestamp, status, timestamp, timestamp, job.id, job.publisher_id, job.claim_token, ...transitions[status]),
    env.DB.prepare(`INSERT INTO instagram_story_job_events(id, job_id, publisher_id, status, checkpoint, error_code, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`)
      .bind(`ig_event_${crypto.randomUUID()}`, job.id, job.publisher_id, status, checkpoint, errorCode, timestamp)];
  const results = await env.DB.batch(statements);
  if (!Number(results[0]?.meta?.changes)) {
    const latest = await jobById(env, job.id);
    if (status === "completed" && latest.status === "completed" && latest.media_id === mediaId) return { job: publicJob(latest), duplicate: true };
    if (status === "failed_attention" && latest.status === "failed_attention") return { job: publicJob(latest), duplicate: true };
    fail("invalid_story_job_transition", 409);
  }
  return { job: publicJob(await jobById(env, job.id)), duplicate: false };
}

export async function handleInstagramStories(request, env, payload, action) {
  if (RETIRED_ACTIONS.has(action)) return response({ ok: false, error: "android_story_agent_retired", provider: "private_api" }, 410);
  if (!ACTIONS.has(action)) return null;
  try {
    const write = ["registerInstagramPublisher", "bindInstagramAccount", "createStoryJob", "updateInstagramStoryJob"].includes(action);
    if (request.method !== (write ? "POST" : "GET")) fail("method_not_allowed", 405);
    const params = new URL(request.url).searchParams;
    let result;
    if (action === "registerInstagramPublisher") result = await register(env, request, payload);
    if (action === "bindInstagramAccount") result = await bindAccount(env, request, payload);
    if (action === "createStoryJob") result = await enqueue(env, payload);
    if (action === "getStoryPublishingConfig" || action === "getStoryJob") {
      const tenant = await restaurant(env, params.get("slug"), params.get("token") || bearer(request));
      if (action === "getStoryPublishingConfig") result = { publishing: await configuration(env, tenant.id) };
      else {
        const jobId = params.get("job") || params.get("job_id");
        const row = jobId
          ? await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE restaurant_id = ? AND id = ? LIMIT 1").bind(tenant.id, id(jobId)).first()
          : await env.DB.prepare("SELECT * FROM instagram_story_jobs WHERE restaurant_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").bind(tenant.id).first();
        result = { job: publicJob(row) };
      }
    }
    if (action === "getNextInstagramStoryJob") result = await claim(env, request, params);
    if (action === "updateInstagramStoryJob") result = await update(env, request, params, payload);
    if (action === "getInstagramPublisherJob" || action === "getInstagramStoryMedia") {
      const job = await assignedJob(env, request, params);
      if (action === "getInstagramPublisherJob") result = await privateJobResult(env, request, job);
      else {
        const object = await env.INSIGHTS_CACHE.getWithMetadata(job.media_key, "arrayBuffer");
        if (!object?.value) fail("story_media_expired", 410);
        return new Response(object.value, { headers: { "content-type": job.content_type, "cache-control": "no-store", "x-content-type-options": "nosniff", "x-media-sha256": job.media_sha256 } });
      }
    }
    return response({ ok: true, ...result }, action === "createStoryJob" && !result.duplicate ? 201 : 200);
  } catch (error) {
    // Do not return SQL, credentials, or arbitrary backend errors to callers.
    return response({ ok: false, error: error.status ? error.message : "instagram_story_internal_error" }, error.status || 500);
  }
}
