# eMobility Backend

AWS Lambda functions for the E-Mobility platform, written in TypeScript.

## Project Structure

```
src/
├── functions/       # Lambda function handlers
└── common/          # Utility functions
```

## Setup

Install dependencies:

```bash
yarn install
```

## Development

Build the project:

```bash
yarn build
```

Run tests:

```bash
yarn test
```

Run linter:

```bash
yarn lint
```

## Packaging for Publish Artifacts

Package Lambda functions & common modules:

```bash
yarn package
```

This creates a `emobility-backand.zip` file ready for deployment. Infrastructure deployment is handled in a separate repository.
