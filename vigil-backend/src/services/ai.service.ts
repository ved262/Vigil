import { HydratedDocument } from 'mongoose';
import { Service } from '../models/Service.js';
import { PingModel } from '../models/Ping.js';
import { AppError } from '../types/index.js';
import { IncidentModel } from '../models/Incident.js';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import z from 'zod';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export interface DiagnosticContext {
  serviceName: string;
  serviceUrl: string;
  latestPing: {
    statusCode: number | null;
    responseTime: number;
    status: string;
    errorMessage: string | null;
    checkedAt: Date;
  };
  recentPings: Array<{
    statusCode: number | null;
    responseTime: number;
    status: string;
    checkedAt: Date;
  }>;
  baselineMs: number | null;
  pastIncidentCount: number;
  pastIncidentSummaries: string[];
}

export interface DeveloperDiagnostic {
  probableCauses: Array<{ cause: string; explanation: string }>;
  suggestedFirstSteps: string[];
  patternDetected: string | null;
  crossServiceCorrelation: string | null;
}

export interface DiagnosticResult {
  customerMessage: string;
  developerDiagnostic: DeveloperDiagnostic;
}

/**
 * Pulls together every piece of real data the AI is allowed to reason
 * over - nothing here is invented or fetched live from the internet.
 * This function is the actual enforcement of "AI reasons only over
 * data Vigil already collected" - by the time ai.service.ts's prompt-
 * building code runs, this is the only data it has access to at all.
 */
export async function gatherDiagnosticContext(
  service: HydratedDocument<Service>,
): Promise<DiagnosticContext> {
  const recentPings = await PingModel.find({ serviceId: service._id })
    .sort({ checkedAt: -1 })
    .limit(10)
    .lean();

  const latestPing = recentPings[0];
  if (!latestPing) {
    throw new AppError(
      'Cannot generate diagnostic - service has no ping history yet',
      400,
      'NO_PING_HISTORY',
    );
  }

  const successfulPings = recentPings.filter((p) => p.status === 'up');
  const baselineMs =
    successfulPings.length > 0
      ? Math.round(
          successfulPings.reduce((sum, p) => sum + p.responseTime, 0) / successfulPings.length,
        )
      : null;
  const pastIncidents = await IncidentModel.find({ serviceId: service._id, status: 'resolved' })
    .sort({ startedAt: -1 })
    .limit(5)
    .lean();

  return {
    serviceName: service.name,
    serviceUrl: service.url,
    latestPing: {
      statusCode: latestPing.statusCode ?? null,
      responseTime: latestPing.responseTime,
      status: latestPing.status,
      errorMessage: latestPing.errorMessage ?? null,
      checkedAt: latestPing.checkedAt,
    },
    recentPings: recentPings.map((p) => ({
      statusCode: p.statusCode ?? null,
      responseTime: p.responseTime,
      status: p.status,
      checkedAt: p.checkedAt,
    })),
    baselineMs,
    pastIncidentCount: pastIncidents.length,
    pastIncidentSummaries: pastIncidents.map(
      (i) => `${i.startedAt.toISOString()}: ${i.customerMessage ?? 'no sumary recorded'}`,
    ),
  };
}

function buildPrompt(context: DiagnosticContext): string {
  return `You are Vigil, an AI incident diagnostic assistant. A service has gone down. Analyze ONLY the data provided below - do not invent facts, servers, or causes not supported by this data.

Service: ${context.serviceName} (${context.serviceUrl})

Latest check:
- Status code: ${context.latestPing.statusCode ?? 'none (connection-level failure)'}
- Response time: ${context.latestPing.responseTime}ms
- Result: ${context.latestPing.status}
- Error: ${context.latestPing.errorMessage ?? 'none'}
- Time: ${context.latestPing.checkedAt.toISOString()}

Baseline response time (recent successful checks): ${context.baselineMs ?? 'no baseline yet'}ms

Last ${context.recentPings.length} checks (newest first):
${context.recentPings.map((p) => `- ${p.checkedAt.toISOString()}: ${p.status}, ${p.responseTime}ms, code ${p.statusCode ?? 'n/a'}`).join('\n')}

Past resolved incidents for this service (${context.pastIncidentCount}):
${context.pastIncidentSummaries.length > 0 ? context.pastIncidentSummaries.join('\n') : 'none'}

Respond with ONLY valid JSON in this exact shape, no markdown formatting, no code fences:
{
  "customerMessage": "calm, professional status update for end customers, 2-3 sentences, no technical jargon",
  "developerDiagnostic": {
    "probableCauses": [{ "cause": "short label", "explanation": "1-2 sentences grounded in the data above" }],
    "suggestedFirstSteps": ["concrete, actionable step"],
    "patternDetected": "description of a recurring pattern if the past incidents show one, otherwise null",
    "crossServiceCorrelation": null
  }
}`;
}

/**
 * One call produces both outputs together - cheaper than two separate
 * calls, and keeps the customer message and developer diagnostic
 * consistent with each other since they're grounded in the same
 * reasoning pass rather than two independent ones that could drift.
 */

export async function generateDiagnostic(context: DiagnosticContext): Promise<DiagnosticResult> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: buildPrompt(context) }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new AppError('AI returned an empty response', 502, 'AI_EMPTY_RESPONSE');
  }

  return parseDiagnosticResponse(raw);
}

const diagnosticResponseSchema = z.object({
  customerMessage: z.string().min(1),
  developerDiagnostic: z.object({
    probableCauses: z.array(
      z.object({
        cause: z.string(),
        explanation: z.string(),
      }),
    ),
    suggestedFirstSteps: z.array(z.string()),
    patternDetected: z.string().nullable(),
    crossServiceCorrelation: z.string().nullable(),
  }),
});

function parseDiagnosticResponse(raw: string): DiagnosticResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('AI returned invalid JSON', 502, 'AI_INVALID_JSON', { raw });
  }

  const result = diagnosticResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      'AI response did not match expected diagnostic shape',
      502,
      'AI_SCHEMA_MISMATCH',
      { errors: result.error.flatten() },
    );
  }

  return result.data;
}
