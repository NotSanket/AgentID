import { TypedDataEncoder, getAddress, keccak256, toUtf8Bytes, verifyTypedData, type TypedDataField } from "ethers";
import type { AgentRequest, JsonValue } from "../domain/types.js";

export interface Eip712Settings {
  chainId: number;
  verifyingContract: string;
}

export const AGENT_REQUEST_TYPES: Record<string, TypedDataField[]> = {
  AgentRequest: [
    { name: "requestId", type: "string" },
    { name: "senderAgentId", type: "string" },
    { name: "receiverAgentId", type: "string" },
    { name: "action", type: "string" },
    { name: "payloadHash", type: "bytes32" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "string" },
  ],
};

export function buildDomain(settings: Eip712Settings) {
  return {
    name: "AgentID",
    version: "1",
    chainId: settings.chainId,
    verifyingContract: getAddress(settings.verifyingContract),
  } as const;
}

export function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(",")}}`;
}

export function hashPayload(payload: JsonValue): string {
  return keccak256(toUtf8Bytes(canonicalizeJson(payload)));
}

export function toTypedMessage(request: AgentRequest) {
  return {
    requestId: request.requestId,
    senderAgentId: request.senderAgentId,
    receiverAgentId: request.receiverAgentId,
    action: request.action,
    payloadHash: hashPayload(request.payload),
    timestamp: request.timestamp,
    nonce: request.nonce,
  };
}

export function typedDataDigest(request: AgentRequest, settings: Eip712Settings): string {
  return TypedDataEncoder.hash(buildDomain(settings), AGENT_REQUEST_TYPES, toTypedMessage(request));
}

export function recoverRequestSigner(
  request: AgentRequest,
  signature: string,
  settings: Eip712Settings,
): string {
  return getAddress(
    verifyTypedData(buildDomain(settings), AGENT_REQUEST_TYPES, toTypedMessage(request), signature),
  );
}
