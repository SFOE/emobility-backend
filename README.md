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
npm install
```

## Development

Build the project:

```bash
npm run build
```

Watch mode for development:

```bash
npm run watch
```

Run tests:

```bash
npm test
```

Run linter:

```bash
npm run lint
```

## Deployment

Package Lambda functions:

```bash
npm run package
```

This creates a `lambda.zip` file ready for deployment. Infrastructure deployment is handled in a separate repository.
