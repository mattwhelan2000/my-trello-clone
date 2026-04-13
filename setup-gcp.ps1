# Automated GCP Infrastructure Setup for Trello-Clone
# Project: trello-clone-492816
# Regions: us-central1 (Primary), europe-west1 (Replica)

$PROJECT_ID = "trello-clone-492816"
$REGION_US = "us-central1"
$REGION_EU = "europe-west1"
$INSTANCE_TYPE = "db-f1-micro"

Write-Host "--- Starting Multi-Regional GCP Setup for $PROJECT_ID ---" -ForegroundColor Cyan

# 1. Ensure project is set
gcloud config set project $PROJECT_ID

# 2. Enable APIs
Write-Host "[1/5] Enabling necessary APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com `
                       sqladmin.googleapis.com `
                       secretmanager.googleapis.com `
                       compute.googleapis.com `
                       artifactregistry.googleapis.com `
                       cloudbuild.googleapis.com

# 3. Provision Database
Write-Host "[2/5] Provisioning Databases (This can take 10-15 minutes)..." -ForegroundColor Yellow
# Create Primary in US
gcloud sql instances create primary-instance `
    --database-version=POSTGRES_15 `
    --tier=$INSTANCE_TYPE `
    --region=$REGION_US `
    --root-password="REPLACE_WITH_YOUR_DB_PASSWORD"

# Create Replica in EU
gcloud sql instances create replica-instance `
    --master-instance-name=primary-instance `
    --region=$REGION_EU `
    --tier=$INSTANCE_TYPE

# 4. Networking & Static IP
Write-Host "[3/5] Reserving Global Static IP..." -ForegroundColor Yellow
gcloud compute addresses create trello-clone-ip --global

$STATIC_IP = gcloud compute addresses describe trello-clone-ip --global --format="value(address)"
Write-Host "DONE! Your Static IP is: $STATIC_IP" -ForegroundColor Green

# 5. Secret Manager Setup
Write-Host "[4/5] Setting up Secret Manager..." -ForegroundColor Yellow

# Create DATABASE_URL secrets (User will need to update values with actual password)
gcloud secrets create DATABASE_URL_US --replication-policy="automatic"
gcloud secrets create DATABASE_URL_EU --replication-policy="automatic"

Write-Host "NOTE: You will need to manually add the connection strings to Secret Manager." -ForegroundColor Gray

# 6. Global Load Balancer Prep
Write-Host "[5/5] Initializing Networking Frontends..." -ForegroundColor Yellow

# Create Health Check
gcloud compute health-checks create http trello-health-check --port 3000

# Create SSL Cert
gcloud compute ssl-certificates create trello-cert `
    --domains="trello.goodthinc.com" `
    --global

Write-Host "--- INFRASTRUCTURE READY ---" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Gray
Write-Host "1. Update Wix DNS A record to: $STATIC_IP"
Write-Host "2. Add your DB password to Secret Manager (DATABASE_URL_US/EU)"
Write-Host "3. Run 'gcloud builds submit --config cloudbuild.yaml .' to deploy code."
