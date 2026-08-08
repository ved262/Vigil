import { PingModel } from '../models/Ping.js';
import { ServiceModel } from '../models/Service.js';
import { AppError } from '../types/index.js';

const CHECK_TIMEOUT_MS = 10000;
const DEGRADED_THRESHOLD_MULTIPLIER = 3;
const MAX_PINGS_PER_SERVICE = 20;

export interface CheckOutcome {
  statusCode: number | null;
  responseTime: number;
  status: 'up' | 'down' | 'timeout' | 'error';
  errorMessage: string | null;
}

export interface CheckServiceResult {
  outcome: CheckOutcome;
  serviceStatus: 'operational' | 'degraded' | 'down';
  baselineMs: number | null;
}

/**
 * Sends one real HTTP GET to the target URL and classifies the result.
 * This is the only function in the whole app that actually reaches out
 * to the internet on the service's behalf - everything downstream
 * (status derivation, AI diagnostics later) reasons over what this
 * function recorded, never touches the network itself.
 */

export async function performCheck(url: string): Promise<CheckOutcome> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    const responseTime = Date.now() - startedAt;
    return {
      statusCode: response.status,
      responseTime,
      status: response.ok ? 'up' : 'down',
      errorMessage: response.ok ? null : `HTTP: ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startedAt;
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return {
      statusCode: null,
      responseTime,
      status: isAbort ? 'timeout' : 'error',
      errorMessage: isAbort ? `Timed out after ${CHECK_TIMEOUT_MS}ms` : (error as Error).message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A service is "down" if the check itself failed outright - no
 * ambiguity there. If it succeeded, we compare against the baseline:
 * a service responding 3x+ slower than its own historical normal is
 * meaningfully unhealthy even though it technically returned 200 -
 * this is what lets us flag degradation before a service fully dies.
 */

export function deriveServiceStatus(
  outcome: CheckOutcome,
  baselineMs: number | null,
): 'operational' | 'degraded' | 'down' {
  if (outcome.status !== 'up') {
    return 'down';
  }
  if (baselineMs !== null && outcome.responseTime > baselineMs * DEGRADED_THRESHOLD_MULTIPLIER) {
    return 'degraded';
  }
  return 'operational';
}

/**
 * Baseline = average response time of the last 20 successful pings.
 * Only successful pings count - averaging in failed/timeout attempts
 * would corrupt the "normal" number we're comparing against. Returns
 * null when there's no history yet (brand new service), which
 * deriveServiceStatus already handles by skipping the degraded check
 * entirely rather than comparing against a meaningless baseline of 0.
 */

export async function calculateBaseline(serviceId: string): Promise<number | null> {
  const recentSuccessful = await PingModel.find({ serviceId, status: 'up' })
    .sort({ checkedAt: -1 })
    .limit(20)
    .select('responseTime')
    .lean();

  if (recentSuccessful.length === 0) return null;
  const sum = recentSuccessful.reduce((acc, ping) => acc + ping.responseTime, 0);
  return Math.round(sum / recentSuccessful.length);
}

/**
 * Full check lifecycle for one service: perform the HTTP check, record
 * it, recalculate the baseline, update the service's status, and trim
 * history back to the last 20 pings. Scoped by workspaceId throughout -
 * a workspace can only check/see its own services, never another
 * workspace's, even if they somehow guessed a valid serviceId.
 */

export async function checkService(
  serviceId: string,
  workspaceId: string,
): Promise<CheckServiceResult> {
  const service = await ServiceModel.findOne({ _id: serviceId, workspaceId });
  if (!service) {
    throw new AppError('Service Not found', 404, 'SERVICE_NOT_FOUND');
  }

  const outcome = await performCheck(service.url);
  const checkedAt = new Date();

  await PingModel.create({
    serviceId: service._id,
    workspaceId,
    statusCode: outcome.statusCode,
    responseTime: outcome.responseTime,
    status: outcome.status,
    errorMessage: outcome.errorMessage,
    checkedAt,
  });

  const baselineMs = await calculateBaseline(serviceId);
  const serviceStatus = deriveServiceStatus(outcome, baselineMs);

  service.status = serviceStatus;
  service.lastCheckedAt = checkedAt;
  await service.save();

  await trimPingHistory(serviceId);
  return { outcome, serviceStatus, baselineMs };
}

/**
 * Keeps only the most recent MAX_PINGS_PER_SERVICE pings per service.
 * Runs after every check rather than as a separate cleanup job - at
 * v1's scale (manual checks only, no cron yet) this is cheap enough to
 * do inline. Worth revisiting if/when automated 5-minute pings (v2)
 * make this run far more often.
 */

async function trimPingHistory(serviceId: string): Promise<void> {
  const pingsToKeep = await PingModel.find({ serviceId })
    .sort({ checkedAt: -1 })
    .limit(MAX_PINGS_PER_SERVICE)
    .select('_id')
    .lean();

  const idsToKeep = pingsToKeep.map((p) => p._id);
  await PingModel.deleteMany({
    serviceId,
    _id: { $nin: idsToKeep },
  });
}
