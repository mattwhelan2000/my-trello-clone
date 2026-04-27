$ErrorActionPreference = "Stop"

# Build the local Docker image
Write-Host "Building Docker image..."
docker build -t gcr.io/trello-clone-492816/trello-clone .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build FAILED. Aborting deployment." -ForegroundColor Red
    exit 1
}

# Push the Docker image to Google Container Registry
Write-Host "Pushing image to GCR..."
docker push gcr.io/trello-clone-492816/trello-clone
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker push FAILED. Aborting deployment." -ForegroundColor Red
    exit 1
}

# Deploy the image to Trello Clone US East Cloud Run service
Write-Host "Deploying to US region..."
gcloud run deploy trello-clone-us --image gcr.io/trello-clone-492816/trello-clone --region us-central1 --quiet

# Deploy the image to Trello Clone EU Cloud Run service
Write-Host "Deploying to EU region..."
gcloud run deploy trello-clone-eu --image gcr.io/trello-clone-492816/trello-clone --region europe-west1 --quiet

Write-Host "Deployment Pipeline Completed Successfully." -ForegroundColor Green
