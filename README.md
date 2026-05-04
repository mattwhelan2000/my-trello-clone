# Trello Clone

This is a [Next.js](https://nextjs.org) project built for management and productivity.

## Infrastructure

This project is deployed on **Google Cloud Platform (GCP)**. It uses:
- **Cloud Run** for containerized application hosting.
- **Cloud SQL** for PostgreSQL database.
- **Secret Manager** for environment variables and secrets.
- **Cloud Build** for automated multi-regional deployments.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

Deploying is automated via Cloud Build. To trigger a build and push to GCP:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

See [GCP_SETUP.md](./GCP_SETUP.md) for detailed multi-regional setup instructions.
