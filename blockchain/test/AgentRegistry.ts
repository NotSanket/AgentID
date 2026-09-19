import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const TRAVEL_ID = "AGT-TRAVEL-001";
const TRAVEL_NAME = "TravelAI";
const TRAVEL_ORGANIZATION = "Wander Labs";
const TRAVEL_URI = "ipfs://agentid/travel-ai.json";

describe("AgentRegistry", function () {
  async function deployRegistry() {
    const [owner, other, third] = await ethers.getSigners();
    const registry: any = await ethers.deployContract("AgentRegistry");
    await registry.waitForDeployment();
    return { registry, owner, other, third };
  }

  async function registerTravelAgent(registry: any, owner: any) {
    const tx = await registry
      .connect(owner)
      .registerAgent(TRAVEL_ID, TRAVEL_NAME, TRAVEL_ORGANIZATION, TRAVEL_URI);
    const receipt = await tx.wait();
    return { tx, receipt };
  }

  describe("registration and lookup", function () {
    it("registers TravelAI and binds ownership to msg.sender", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      const agent = await registry.getAgent(TRAVEL_ID);
      expect(agent.agentId).to.equal(TRAVEL_ID);
      expect(agent.name).to.equal(TRAVEL_NAME);
      expect(agent.organization).to.equal(TRAVEL_ORGANIZATION);
      expect(agent.owner).to.equal(owner.address);
      expect(agent.metadataURI).to.equal(TRAVEL_URI);
      expect(agent.status).to.equal(1n);
    });

    it("emits a complete AgentRegistered event", async function () {
      const { registry, owner } = await deployRegistry();
      const { receipt } = await registerTravelAgent(registry, owner);
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const event = receipt.logs
        .map((log: any) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "AgentRegistered");

      expect(event).not.to.equal(undefined);
      expect(event.args.agentKey).to.equal(ethers.id(TRAVEL_ID));
      expect(event.args.agentId).to.equal(TRAVEL_ID);
      expect(event.args.owner).to.equal(owner.address);
      expect(event.args.timestamp).to.equal(BigInt(block!.timestamp));
    });

    it("returns all stored agent data correctly", async function () {
      const { registry, owner } = await deployRegistry();
      const { receipt } = await registerTravelAgent(registry, owner);
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const agent = await registry.getAgent(TRAVEL_ID);
      expect(agent.registeredAt).to.equal(BigInt(block!.timestamp));
      expect(agent.updatedAt).to.equal(agent.registeredAt);
      expect(agent.owner).to.equal(owner.address);
    });

    it("verifies a registered Active identity with useful details", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      const verification = await registry.verifyAgent(TRAVEL_ID);
      expect(verification.exists).to.equal(true);
      expect(verification.isActive).to.equal(true);
      expect(verification.owner).to.equal(owner.address);
      expect(verification.status).to.equal(1n);
      expect(verification.registeredAt).to.be.greaterThan(0n);
      expect(verification.updatedAt).to.equal(verification.registeredAt);
    });

    it("looks up the same record by wallet", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      const agent = await registry.getAgentByWallet(owner.address);
      expect(agent.agentId).to.equal(TRAVEL_ID);
      expect(agent.owner).to.equal(owner.address);
    });

    it("rejects a duplicate readable AgentID from another wallet", async function () {
      const { registry, owner, other } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(
        registry
          .connect(other)
          .registerAgent(TRAVEL_ID, "CopyAI", "Impostor Org", ""),
      )
        .to.be.revertedWithCustomError(registry, "AgentAlreadyExists")
        .withArgs(TRAVEL_ID);
    });

    it("rejects a second AgentID from the same wallet", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(
        registry
          .connect(owner)
          .registerAgent("AGT-SECOND-001", "SecondAI", "Wander Labs", ""),
      )
        .to.be.revertedWithCustomError(registry, "WalletAlreadyRegistered")
        .withArgs(owner.address);
    });

    for (const [field, values] of [
      ["agentId", ["", TRAVEL_NAME, TRAVEL_ORGANIZATION, TRAVEL_URI]],
      ["name", [TRAVEL_ID, "", TRAVEL_ORGANIZATION, TRAVEL_URI]],
      ["organization", [TRAVEL_ID, TRAVEL_NAME, "", TRAVEL_URI]],
    ] as const) {
      it(`rejects an empty required ${field}`, async function () {
        const { registry } = await deployRegistry();
        await expect(registry.registerAgent(...values))
          .to.be.revertedWithCustomError(registry, "EmptyField")
          .withArgs(field);
      });
    }

    it("allows metadataURI to be empty because it is optional", async function () {
      const { registry } = await deployRegistry();
      await expect(
        registry.registerAgent(TRAVEL_ID, TRAVEL_NAME, TRAVEL_ORGANIZATION, ""),
      ).not.to.revert(ethers);
    });

    it("rejects fields longer than their documented limits", async function () {
      const { registry } = await deployRegistry();
      await expect(
        registry.registerAgent(
          "A".repeat(65),
          TRAVEL_NAME,
          TRAVEL_ORGANIZATION,
          TRAVEL_URI,
        ),
      )
        .to.be.revertedWithCustomError(registry, "FieldTooLong")
        .withArgs("agentId", 64n);
    });

    it("reports an unknown ID as nonexistent without reverting", async function () {
      const { registry } = await deployRegistry();
      const verification = await registry.verifyAgent("AGT-UNKNOWN-001");

      expect(verification.exists).to.equal(false);
      expect(verification.isActive).to.equal(false);
      expect(verification.owner).to.equal(ethers.ZeroAddress);
      expect(verification.status).to.equal(0n);
    });

    it("rejects direct lookup of a nonexistent AgentID", async function () {
      const { registry } = await deployRegistry();
      await expect(registry.getAgent("AGT-UNKNOWN-001"))
        .to.be.revertedWithCustomError(registry, "AgentNotFound")
        .withArgs("AGT-UNKNOWN-001");
    });

    it("rejects reverse lookup of an unregistered wallet", async function () {
      const { registry, other } = await deployRegistry();
      await expect(registry.getAgentByWallet(other.address))
        .to.be.revertedWithCustomError(registry, "WalletNotRegistered")
        .withArgs(other.address);
    });

    it("treats AgentIDs as case-sensitive identifiers", async function () {
      const { registry, owner, other } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry
        .connect(other)
        .registerAgent("agt-travel-001", "LowercaseAI", "Case Lab", "");

      expect((await registry.getAgent(TRAVEL_ID)).owner).to.equal(owner.address);
      expect((await registry.getAgent("agt-travel-001")).owner).to.equal(other.address);
    });
  });

  describe("updates", function () {
    it("allows the owner to update mutable metadata and emits AgentUpdated", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await ethers.provider.send("evm_increaseTime", [10]);

      await expect(
        registry
          .connect(owner)
          .updateAgent(TRAVEL_ID, "TravelAI Pro", "Wander Labs Ltd", "ipfs://new"),
      ).to.emit(registry, "AgentUpdated");

      const agent = await registry.getAgent(TRAVEL_ID);
      expect(agent.name).to.equal("TravelAI Pro");
      expect(agent.organization).to.equal("Wander Labs Ltd");
      expect(agent.metadataURI).to.equal("ipfs://new");
      expect(agent.owner).to.equal(owner.address);
      expect(agent.agentId).to.equal(TRAVEL_ID);
      expect(agent.updatedAt).to.be.greaterThan(agent.registeredAt);
    });

    it("allows the owner to clear optional metadataURI", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry
        .connect(owner)
        .updateAgent(TRAVEL_ID, TRAVEL_NAME, TRAVEL_ORGANIZATION, "");
      expect((await registry.getAgent(TRAVEL_ID)).metadataURI).to.equal("");
    });

    it("rejects an update from another wallet", async function () {
      const { registry, owner, other } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(
        registry
          .connect(other)
          .updateAgent(TRAVEL_ID, "Hijacked", "Bad Org", "ipfs://bad"),
      )
        .to.be.revertedWithCustomError(registry, "NotAgentOwner")
        .withArgs(other.address, owner.address);
    });

    it("rejects invalid required fields during update", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(
        registry.connect(owner).updateAgent(TRAVEL_ID, "", TRAVEL_ORGANIZATION, ""),
      )
        .to.be.revertedWithCustomError(registry, "EmptyField")
        .withArgs("name");
    });

    it("rejects update of a nonexistent identity", async function () {
      const { registry } = await deployRegistry();
      await expect(
        registry.updateAgent("AGT-UNKNOWN-001", "Unknown", "No Org", ""),
      )
        .to.be.revertedWithCustomError(registry, "AgentNotFound")
        .withArgs("AGT-UNKNOWN-001");
    });
  });

  describe("revocation and reactivation", function () {
    it("allows the owner to revoke an Active identity", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(registry.connect(owner).revokeAgent(TRAVEL_ID)).to.emit(
        registry,
        "AgentRevoked",
      );
      expect((await registry.getAgent(TRAVEL_ID)).status).to.equal(2n);
    });

    it("makes active verification fail after revocation", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);

      const verification = await registry.verifyAgent(TRAVEL_ID);
      expect(verification.exists).to.equal(true);
      expect(verification.isActive).to.equal(false);
      expect(verification.status).to.equal(2n);
    });

    it("rejects revocation by another wallet", async function () {
      const { registry, owner, other } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(registry.connect(other).revokeAgent(TRAVEL_ID))
        .to.be.revertedWithCustomError(registry, "NotAgentOwner")
        .withArgs(other.address, owner.address);
    });

    it("allows the owner to reactivate a Revoked identity", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);

      await expect(registry.connect(owner).reactivateAgent(TRAVEL_ID)).to.emit(
        registry,
        "AgentReactivated",
      );
      expect((await registry.getAgent(TRAVEL_ID)).status).to.equal(1n);
    });

    it("verifies successfully after reactivation", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);
      await registry.connect(owner).reactivateAgent(TRAVEL_ID);

      const verification = await registry.verifyAgent(TRAVEL_ID);
      expect(verification.exists).to.equal(true);
      expect(verification.isActive).to.equal(true);
      expect(verification.status).to.equal(1n);
    });

    it("rejects reactivation by another wallet", async function () {
      const { registry, owner, other } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);

      await expect(registry.connect(other).reactivateAgent(TRAVEL_ID))
        .to.be.revertedWithCustomError(registry, "NotAgentOwner")
        .withArgs(other.address, owner.address);
    });

    it("rejects revoking an already Revoked identity", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);

      await expect(registry.connect(owner).revokeAgent(TRAVEL_ID))
        .to.be.revertedWithCustomError(registry, "InvalidStatus")
        .withArgs(2n, 1n);
    });

    it("rejects reactivating an already Active identity", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);

      await expect(registry.connect(owner).reactivateAgent(TRAVEL_ID))
        .to.be.revertedWithCustomError(registry, "InvalidStatus")
        .withArgs(1n, 2n);
    });

    it("rejects lifecycle actions for nonexistent identities", async function () {
      const { registry } = await deployRegistry();
      await expect(registry.revokeAgent("AGT-UNKNOWN-001"))
        .to.be.revertedWithCustomError(registry, "AgentNotFound")
        .withArgs("AGT-UNKNOWN-001");
      await expect(registry.reactivateAgent("AGT-UNKNOWN-001"))
        .to.be.revertedWithCustomError(registry, "AgentNotFound")
        .withArgs("AGT-UNKNOWN-001");
    });

    it("preserves identity data and owner through the full lifecycle", async function () {
      const { registry, owner } = await deployRegistry();
      await registerTravelAgent(registry, owner);
      await registry.connect(owner).revokeAgent(TRAVEL_ID);
      await registry.connect(owner).reactivateAgent(TRAVEL_ID);

      const agent = await registry.getAgent(TRAVEL_ID);
      expect(agent.agentId).to.equal(TRAVEL_ID);
      expect(agent.name).to.equal(TRAVEL_NAME);
      expect(agent.organization).to.equal(TRAVEL_ORGANIZATION);
      expect(agent.owner).to.equal(owner.address);
      expect(agent.registeredAt).to.be.lessThanOrEqual(agent.updatedAt);
    });
  });
});
