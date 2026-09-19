import { getAddress } from "ethers";
import type { AgentRequest, RegistryReader } from "../domain/types.js";
import type { AuditEventType, AuditStore } from "../stores/audit-store.js";
import type { ReplayStore } from "../stores/replay-store.js";
import { recoverRequestSigner, type Eip712Settings } from "./eip712.js";
import { agentRequestSchema } from "./request-schema.js";

export type AuthenticationCode =
  | "VERIFIED"
  | "INVALID_REQUEST"
  | "INVALID_SIGNATURE"
  | "UNKNOWN_WALLET"
  | "UNKNOWN_AGENT"
  | "UNKNOWN_RECEIVER"
  | "RECEIVER_REVOKED"
  | "WALLET_MISMATCH"
  | "AGENT_REVOKED"
  | "REQUEST_EXPIRED"
  | "NONCE_REUSED"
  | "SERVICE_UNAVAILABLE";

export interface AuthenticationChecks {
  signatureValid: boolean;
  senderExists: boolean;
  receiverExists: boolean;
  receiverActive: boolean;
  walletMatches: boolean;
  identityActive: boolean;
  timestampValid: boolean;
  nonceUnused: boolean;
}

export interface AuthenticationResult {
  verified: boolean;
  code: AuthenticationCode;
  reason: string;
  senderAgentId?: string;
  receiverAgentId?: string;
  recoveredWallet?: string;
  registeredWallet?: string;
  operationalWarnings?: string[];
  checks: AuthenticationChecks;
}

export interface AuthenticationOptions extends Eip712Settings {
  maxAgeSeconds: number;
  clockSkewSeconds: number;
  now?: () => number;
}

const emptyChecks = (): AuthenticationChecks => ({
  signatureValid: false,
  senderExists: false,
  receiverExists: false,
  receiverActive: false,
  walletMatches: false,
  identityActive: false,
  timestampValid: false,
  nonceUnused: false,
});

export class AuthenticationService {
  constructor(
    private readonly registry: RegistryReader,
    private readonly replayStore: ReplayStore,
    private readonly auditStore: AuditStore,
    private readonly options: AuthenticationOptions,
  ) {}

  async authenticate(input: unknown, signature: string): Promise<AuthenticationResult> {
    const parsed = agentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return this.finish(undefined, this.reject("INVALID_REQUEST", "Request schema validation failed."));
    }
    const request = parsed.data;
    const checks = emptyChecks();

    try {
      const receiver = await this.registry.getAgent(request.receiverAgentId);
      if (!receiver) {
        return this.finish(request, this.reject("UNKNOWN_RECEIVER", "Receiver AgentID is not registered.", checks));
      }
      checks.receiverExists = true;
      checks.receiverActive = receiver.status === "Active";
      if (!checks.receiverActive) {
        return this.finish(request, this.reject("RECEIVER_REVOKED", "Receiver identity is revoked on-chain.", checks));
      }

      let recoveredWallet: string;
      try {
        recoveredWallet = recoverRequestSigner(request, signature, this.options);
        checks.signatureValid = true;
      } catch {
        return this.finish(request, this.reject("INVALID_SIGNATURE", "Signature is malformed or invalid.", checks));
      }

      const signerAgent = await this.registry.getAgentByWallet(recoveredWallet);
      if (!signerAgent) {
        return this.finish(request, this.reject("UNKNOWN_WALLET", "Recovered signer wallet is not registered.", checks, recoveredWallet));
      }

      const sender = await this.registry.getAgent(request.senderAgentId);
      if (!sender) {
        return this.finish(request, this.reject("UNKNOWN_AGENT", "Sender AgentID is not registered.", checks, recoveredWallet));
      }
      checks.senderExists = true;
      checks.identityActive = sender.status === "Active";
      if (!checks.identityActive) {
        return this.finish(request, this.reject("AGENT_REVOKED", "Sender identity is revoked on-chain.", checks, recoveredWallet, sender.owner));
      }

      checks.walletMatches = getAddress(recoveredWallet) === getAddress(sender.owner);
      if (!checks.walletMatches) {
        return this.finish(request, this.reject("WALLET_MISMATCH", "Recovered signer does not control the claimed AgentID.", checks, recoveredWallet, sender.owner));
      }

      const now = this.options.now?.() ?? Math.floor(Date.now() / 1000);
      checks.timestampValid =
        request.timestamp >= now - this.options.maxAgeSeconds &&
        request.timestamp <= now + this.options.clockSkewSeconds;
      if (!checks.timestampValid) {
        return this.finish(request, this.reject("REQUEST_EXPIRED", "Request timestamp is outside the allowed freshness window.", checks, recoveredWallet, sender.owner));
      }

      checks.nonceUnused = await this.replayStore.consume({
        senderAgentId: request.senderAgentId,
        nonce: request.nonce,
        requestId: request.requestId,
      });
      if (!checks.nonceUnused) {
        return this.finish(request, this.reject("NONCE_REUSED", "Request nonce has already been accepted.", checks, recoveredWallet, sender.owner));
      }

      return this.finish(request, {
        verified: true,
        code: "VERIFIED",
        reason: "Agent identity and EIP-712 signature verified.",
        senderAgentId: request.senderAgentId,
        receiverAgentId: request.receiverAgentId,
        recoveredWallet,
        registeredWallet: sender.owner,
        checks,
      });
    } catch (error) {
      return this.finish(request, this.reject(
        "SERVICE_UNAVAILABLE",
        error instanceof Error ? error.message : "Blockchain service unavailable.",
        checks,
      ));
    }
  }

  private reject(
    code: Exclude<AuthenticationCode, "VERIFIED">,
    reason: string,
    checks = emptyChecks(),
    recoveredWallet?: string,
    registeredWallet?: string,
  ): AuthenticationResult {
    return { verified: false, code, reason, recoveredWallet, registeredWallet, checks };
  }

  private async finish(request: AgentRequest | undefined, result: AuthenticationResult): Promise<AuthenticationResult> {
    if (request) {
      result.senderAgentId = request.senderAgentId;
      result.receiverAgentId = request.receiverAgentId;
    }
    const typeByCode: Partial<Record<AuthenticationCode, AuditEventType>> = {
      VERIFIED: "REQUEST_VERIFIED",
      UNKNOWN_WALLET: "UNKNOWN_WALLET_BLOCKED",
      UNKNOWN_AGENT: "UNKNOWN_AGENT_BLOCKED",
      UNKNOWN_RECEIVER: "UNKNOWN_RECEIVER_BLOCKED",
      RECEIVER_REVOKED: "RECEIVER_REVOKED_BLOCKED",
      WALLET_MISMATCH: "IMPERSONATION_BLOCKED",
      AGENT_REVOKED: "REVOKED_AGENT_BLOCKED",
      NONCE_REUSED: "REPLAY_BLOCKED",
      REQUEST_EXPIRED: "EXPIRED_REQUEST_BLOCKED",
      INVALID_SIGNATURE: "INVALID_SIGNATURE_BLOCKED",
    };
    try {
      await this.auditStore.record(typeByCode[result.code] ?? "REQUEST_BLOCKED", {
        requestId: request?.requestId,
        senderAgentId: request?.senderAgentId,
        receiverAgentId: request?.receiverAgentId,
        action: request?.action,
        result: result.verified ? "VERIFIED" : "BLOCKED",
        code: result.code,
        reason: result.reason,
        recoveredWallet: result.recoveredWallet,
        registeredWallet: result.registeredWallet,
      });
    } catch {
      console.error("Audit persistence failed; the authentication decision was preserved.");
      result.operationalWarnings = [
        ...(result.operationalWarnings ?? []),
        "AUDIT_PERSISTENCE_FAILED",
      ];
    }
    return result;
  }
}
