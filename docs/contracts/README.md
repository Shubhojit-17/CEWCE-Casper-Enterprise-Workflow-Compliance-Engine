# Smart Contract Documentation

This directory contains documentation for CEWCE Casper smart contracts.

## Contracts Overview

### WorkflowContract

The main contract managing workflow state transitions and audit events.

#### Entry Points

- `create_workflow` - Initialize a new workflow instance
- `transition_state` - Execute a state transition (approve, reject, escalate)
- `get_workflow_state` - Query current workflow state
- `get_workflow_history` - Query state transition history

#### Events Emitted

All events are recorded on-chain for audit purposes:
- `WorkflowCreated`
- `StateTransitioned`
- `WorkflowCompleted`

## Deployment

Contracts are deployed to Casper Testnet during development.
Mainnet deployment requires security audit completion.

## Security Model

- No administrative backdoors
- Role-based access enforced at contract level
- All state changes require valid signatures
- Upgrade patterns follow Casper best practices
