# Devin fintech internal tools — refunds review prototype

A timeboxed (≤2h) prototype built with Devin to evaluate whether a fintech team could build internal tools in code instead of on Microsoft Power Apps. It implements one workflow end to end: **refund request review**.

> **This is a prototype, not production software.** The identity switcher is **not authentication**. Data is synthetic. See [Production gaps](#production-gaps).

## Status

Work in progress — see [BUILD_LOG.md](BUILD_LOG.md).

## Requirements

- Node.js 24 (`.nvmrc`; `nvm use`)
- npm

## Setup and run

```bash
nvm use            # or install Node 24
npm install
npm run seed       # creates ./data/app.db with synthetic data (resets it)
npm run dev        # http://localhost:3000
```

## Production gaps

_TBD_
