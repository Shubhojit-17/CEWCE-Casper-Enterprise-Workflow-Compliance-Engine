# Casper Smart Contracts

This directory contains the Casper smart contracts for CEWCE.

## Structure

```
contracts/
├── Cargo.toml              # Workspace configuration
├── workflow-contract/      # Main workflow contract
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
└── tests/                  # Contract integration tests
```

## Prerequisites

- Rust toolchain (1.70+)
- wasm32-unknown-unknown target: `rustup target add wasm32-unknown-unknown`
- casper-client CLI tool

## Building

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
```

## Testing

```bash
cargo test
```

## Deployment

See deployment scripts in `infrastructure/scripts/` directory.

Contract deployment requires:
1. Funded Casper account on testnet
2. casper-client installed
3. Account keys available

## Reference

- [Casper Smart Contract Documentation](https://docs.casper.network/developers/writing-onchain-code/)
- [casper-contract crate](https://docs.rs/casper-contract/latest/casper_contract/)
