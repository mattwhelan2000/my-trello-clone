# Multi-Regional GCP Setup Guide

This guide outlines the steps to deploy your Trello-clone across **US (us-central1)** and **Europe (europe-west1)**.

## 1. Global Database (Cloud SQL)

To ensure data consistency across regions, use the **Primary/Replica** model:
1.  **Primary Instance (`us-central1`)**: Create your main PostgreSQL instance in the US.
2.  **Read Replica (`europe-west1`)**: In the Cloud SQL console, create a **Read Replica** of your primary instance in the Europe region.
3.  **Connection Strings**:
    - **US URL**: `postgresql://USER:PASS@/postgres?host=/cloudsql/trello-clone-492816:us-central1:primary-instance`
    - **EU URL**: `postgresql://USER:PASS@/postgres?host=/cloudsql/trello-clone-492816:europe-west1:replica-instance`

## 2. Regional Secrets (Secret Manager)

You must create secrets in **both** regions to allow local Cloud Run instances to connect:
- **Project: `trello-clone-492816`**
- Create `DATABASE_URL_US`: pointing to the Primary.
- Create `DATABASE_URL_EU`: pointing to the Replica.

## 3. Custom Domain & DNS (Wix)

Since your domain `goodthinc.com` is managed by **Wix**, you need to point the `trello` subdomain to your Google Cloud infrastructure.

### Steps in Google Cloud Console
1.  **Reserve Static IP**: Go to **VPC Network > IP addresses** and reserve a new **Global Static External IP**. Name it `trello-clone-ip`.
2.  **Configure Load Balancer- [ ] Global Networking
    - [ ] Reserve Global Static IP in GCP
    - [ ] Configure Global Load Balancer (GLB) with SSL
    - [ ] Add A Record in Wix for `trello.goodthinc.com`
**.
    - Set the IP address to `trello-clone-ip`.
    - Create a **Google-managed certificate** for `trello.goodthinc.com`.

### Steps in Wix Dashboard
1.  Navigate to your **Domains** page in Wix.
2.  Select **Manage DNS Records** for `goodthinc.com`.
3.  Add a new **A Record**:
    - **Host Name**: `trello`
    - **Value**: [Your Reserved GCP Static IP]
4.  Save changes and allow up to 48 hours for propagation.

## 4. Multi-Region Deployment

Deploying is now automated via Cloud Build. Run this command to build and push to both regions:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

## 5. Summary of Architecture
- **Public Entry**: Global External Application Load Balancer
- **Computing**: Cloud Run Services in US and EU
- **Data**: Cloud SQL for PostgreSQL (Primary in US, Read Replica in EU)
- **Security**: Regionalized Secrets in Secret Manager
