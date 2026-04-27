# Build the local Docker image
docker build -t gcr.io/trello-clone-492816/trello-clone .

# Push the Docker image to Google Container Registry
docker push gcr.io/trello-clone-492816/trello-clone

# Deploy the image to Trello Clone US East Cloud Run service
gcloud run deploy trello-clone-us --image gcr.io/trello-clone-492816/trello-clone --region us-central1 --quiet

# Deploy the image to Trello Clone EU Cloud Run service
gcloud run deploy trello-clone-eu --image gcr.io/trello-clone-492816/trello-clone --region europe-west1 --quiet

Write-Host "Deployment Pipeline Completed Successfully."
