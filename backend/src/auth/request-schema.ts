import { z } from "zod";
import type { JsonValue } from "../domain/types.js";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const agentRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  senderAgentId: z.string().trim().min(1).max(64),
  receiverAgentId: z.string().trim().min(1).max(64),
  action: z.string().trim().min(1).max(64).regex(/^[A-Z][A-Z0-9_]*$/),
  payload: jsonValueSchema,
  timestamp: z.number().int().nonnegative(),
  nonce: z.string().trim().min(1).max(128),
}).strict();

export const signedRequestSchema = z.object({
  request: agentRequestSchema,
  signature: z.string().min(1),
}).strict();
