$ErrorActionPreference = "Continue"

Write-Host "1. Creating US Serverless NEG..." -ForegroundColor Yellow
gcloud compute network-endpoint-groups create trello-neg-us --region=us-central1 --network-endpoint-type=serverless --cloud-run-service=trello-clone-us

Write-Host "2. Creating EU Serverless NEG..." -ForegroundColor Yellow
gcloud compute network-endpoint-groups create trello-neg-eu --region=europe-west1 --network-endpoint-type=serverless --cloud-run-service=trello-clone-eu

Write-Host "3. Creating Global Backend Service..." -ForegroundColor Yellow
gcloud compute backend-services create trello-backend-service --global

Write-Host "4. Attaching US Backend..." -ForegroundColor Yellow
gcloud compute backend-services add-backend trello-backend-service --global --network-endpoint-group=trello-neg-us --network-endpoint-group-region=us-central1

Write-Host "5. Attaching EU Backend..." -ForegroundColor Yellow
gcloud compute backend-services add-backend trello-backend-service --global --network-endpoint-group=trello-neg-eu --network-endpoint-group-region=europe-west1

Write-Host "6. Creating URL Map..." -ForegroundColor Yellow
gcloud compute url-maps create trello-url-map --default-service trello-backend-service

Write-Host "7. Creating HTTPS Proxy (Connecting SSL Cert)..." -ForegroundColor Yellow
gcloud compute target-https-proxies create trello-https-proxy --ssl-certificates=trello-cert --url-map=trello-url-map

Write-Host "8. Creating Global Forwarding Rule (Connecting IP 136.110.137.204)..." -ForegroundColor Yellow
gcloud compute forwarding-rules create trello-https-rule --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM --address=136.110.137.204 --global --target-https-proxy=trello-https-proxy --ports=443

Write-Host "✅ LOAD BALANCER SUCCESSFULLY CREATED!" -ForegroundColor Green
