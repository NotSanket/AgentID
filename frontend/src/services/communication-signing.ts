import { BrowserProvider, getAddress } from "ethers";
import type { PreparedCommunication } from "../types/api";

interface EthereumProvider { request(args: { method: string; params?: unknown[] }): Promise<unknown> }

declare global { interface Window { ethereum?: EthereumProvider } }

export async function signPreparedCommunication(prepared: PreparedCommunication, expectedWallet: string) {
  if (!window.ethereum) throw new Error("No browser wallet is available. Install or unlock a compatible wallet.");
  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== prepared.typedData.domain.chainId) {
    throw new Error(`Switch the wallet to chain ${prepared.typedData.domain.chainId} before signing.`);
  }
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (getAddress(address) !== getAddress(expectedWallet)) {
    throw new Error("The connected wallet does not control the selected sender AgentID.");
  }
  try {
    return await signer.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature request rejected.";
    if (/reject|denied|cancel/i.test(message)) throw new Error("The wallet signature request was rejected.");
    throw new Error("The browser wallet could not sign this request.");
  }
}
