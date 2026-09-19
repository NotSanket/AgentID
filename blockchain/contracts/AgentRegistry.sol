// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title AgentRegistry
/// @notice Wallet-bound identity registry for collaborative AI agents.
/// @dev Registration proves an identity-to-wallet link and lifecycle state only;
///      it does not certify an agent's safety, honesty, or intelligence.
contract AgentRegistry {
    enum AgentStatus {
        None,
        Active,
        Revoked
    }

    struct Agent {
        string agentId;
        string name;
        string organization;
        address owner;
        string metadataURI;
        uint256 registeredAt;
        uint256 updatedAt;
        AgentStatus status;
    }

    uint256 public constant MAX_AGENT_ID_LENGTH = 64;
    uint256 public constant MAX_NAME_LENGTH = 128;
    uint256 public constant MAX_ORGANIZATION_LENGTH = 128;
    uint256 public constant MAX_METADATA_URI_LENGTH = 512;

    mapping(bytes32 agentKey => Agent agent) private agents;
    mapping(address wallet => bytes32 agentKey) private agentKeyByWallet;
    mapping(address wallet => bool registered) private walletHasAgent;

    error EmptyField(string field);
    error FieldTooLong(string field, uint256 maximumLength);
    error AgentAlreadyExists(string agentId);
    error WalletAlreadyRegistered(address wallet);
    error AgentNotFound(string agentId);
    error WalletNotRegistered(address wallet);
    error NotAgentOwner(address caller, address owner);
    error InvalidStatus(AgentStatus currentStatus, AgentStatus requiredStatus);

    event AgentRegistered(
        bytes32 indexed agentKey,
        string agentId,
        address indexed owner,
        uint256 timestamp
    );
    event AgentUpdated(
        bytes32 indexed agentKey,
        string agentId,
        address indexed owner,
        uint256 timestamp
    );
    event AgentRevoked(
        bytes32 indexed agentKey,
        string agentId,
        address indexed owner,
        uint256 timestamp
    );
    event AgentReactivated(
        bytes32 indexed agentKey,
        string agentId,
        address indexed owner,
        uint256 timestamp
    );

    /// @notice Registers exactly one identity for the transaction sender.
    function registerAgent(
        string calldata agentId,
        string calldata name,
        string calldata organization,
        string calldata metadataURI
    ) external {
        _validateIdentityFields(agentId, name, organization, metadataURI);

        bytes32 agentKey = _agentKey(agentId);
        if (agents[agentKey].status != AgentStatus.None) {
            revert AgentAlreadyExists(agentId);
        }
        if (walletHasAgent[msg.sender]) {
            revert WalletAlreadyRegistered(msg.sender);
        }

        uint256 timestamp = block.timestamp;
        agents[agentKey] = Agent({
            agentId: agentId,
            name: name,
            organization: organization,
            owner: msg.sender,
            metadataURI: metadataURI,
            registeredAt: timestamp,
            updatedAt: timestamp,
            status: AgentStatus.Active
        });
        agentKeyByWallet[msg.sender] = agentKey;
        walletHasAgent[msg.sender] = true;

        emit AgentRegistered(agentKey, agentId, msg.sender, timestamp);
    }

    /// @notice Returns a registered identity by its readable AgentID.
    function getAgent(string calldata agentId) external view returns (Agent memory) {
        return _getExistingAgent(agentId);
    }

    /// @notice Returns the single identity registered by a wallet.
    function getAgentByWallet(address wallet) external view returns (Agent memory) {
        if (!walletHasAgent[wallet]) {
            revert WalletNotRegistered(wallet);
        }
        return agents[agentKeyByWallet[wallet]];
    }

    /// @notice Reports existence and active status without reverting for an unknown ID.
    function verifyAgent(
        string calldata agentId
    )
        external
        view
        returns (
            bool exists,
            bool isActive,
            address owner,
            AgentStatus status,
            uint256 registeredAt,
            uint256 updatedAt
        )
    {
        Agent storage agent = agents[_agentKey(agentId)];
        exists = agent.status != AgentStatus.None;
        isActive = agent.status == AgentStatus.Active;
        owner = agent.owner;
        status = agent.status;
        registeredAt = agent.registeredAt;
        updatedAt = agent.updatedAt;
    }

    /// @notice Updates mutable profile fields while preserving AgentID and ownership.
    function updateAgent(
        string calldata agentId,
        string calldata name,
        string calldata organization,
        string calldata metadataURI
    ) external {
        _validateText(name, "name", MAX_NAME_LENGTH, false);
        _validateText(organization, "organization", MAX_ORGANIZATION_LENGTH, false);
        _validateText(metadataURI, "metadataURI", MAX_METADATA_URI_LENGTH, true);

        bytes32 agentKey = _agentKey(agentId);
        Agent storage agent = agents[agentKey];
        _requireOwner(agent, agentId);

        agent.name = name;
        agent.organization = organization;
        agent.metadataURI = metadataURI;
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(agentKey, agentId, msg.sender, block.timestamp);
    }

    /// @notice Changes an Active identity to Revoked. Data remains auditable.
    function revokeAgent(string calldata agentId) external {
        bytes32 agentKey = _agentKey(agentId);
        Agent storage agent = agents[agentKey];
        _requireOwner(agent, agentId);
        if (agent.status != AgentStatus.Active) {
            revert InvalidStatus(agent.status, AgentStatus.Active);
        }

        agent.status = AgentStatus.Revoked;
        agent.updatedAt = block.timestamp;

        emit AgentRevoked(agentKey, agentId, msg.sender, block.timestamp);
    }

    /// @notice Changes a Revoked identity back to Active.
    function reactivateAgent(string calldata agentId) external {
        bytes32 agentKey = _agentKey(agentId);
        Agent storage agent = agents[agentKey];
        _requireOwner(agent, agentId);
        if (agent.status != AgentStatus.Revoked) {
            revert InvalidStatus(agent.status, AgentStatus.Revoked);
        }

        agent.status = AgentStatus.Active;
        agent.updatedAt = block.timestamp;

        emit AgentReactivated(agentKey, agentId, msg.sender, block.timestamp);
    }

    function _getExistingAgent(string calldata agentId) private view returns (Agent memory agent) {
        agent = agents[_agentKey(agentId)];
        if (agent.status == AgentStatus.None) {
            revert AgentNotFound(agentId);
        }
    }

    function _requireOwner(Agent storage agent, string calldata agentId) private view {
        if (agent.status == AgentStatus.None) {
            revert AgentNotFound(agentId);
        }
        if (agent.owner != msg.sender) {
            revert NotAgentOwner(msg.sender, agent.owner);
        }
    }

    function _validateIdentityFields(
        string calldata agentId,
        string calldata name,
        string calldata organization,
        string calldata metadataURI
    ) private pure {
        _validateText(agentId, "agentId", MAX_AGENT_ID_LENGTH, false);
        _validateText(name, "name", MAX_NAME_LENGTH, false);
        _validateText(organization, "organization", MAX_ORGANIZATION_LENGTH, false);
        _validateText(metadataURI, "metadataURI", MAX_METADATA_URI_LENGTH, true);
    }

    function _validateText(
        string calldata value,
        string memory field,
        uint256 maximumLength,
        bool allowEmpty
    ) private pure {
        uint256 length = bytes(value).length;
        if (!allowEmpty && length == 0) {
            revert EmptyField(field);
        }
        if (length > maximumLength) {
            revert FieldTooLong(field, maximumLength);
        }
    }

    function _agentKey(string calldata agentId) private pure returns (bytes32) {
        return keccak256(bytes(agentId));
    }
}

