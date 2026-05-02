@echo off
echo Updating US service...
gcloud run services update trello-clone-us --region us-central1 --set-env-vars DROPBOX_APP_SECRET=a62sq1xq4p2wnq4 --quiet
gcloud run services update trello-clone-us --region us-central1 --remove-env-vars DROPBOX_ACCESS_TOKEN --quiet

echo Updating EU service...
gcloud run services update trello-clone-eu --region europe-west1 --set-env-vars DROPBOX_APP_KEY=2ns3shvcw5pvdi5 --quiet
gcloud run services update trello-clone-eu --region europe-west1 --set-env-vars DROPBOX_APP_SECRET=a62sq1xq4p2wnq4 --quiet
gcloud run services update trello-clone-eu --region europe-west1 --remove-env-vars DROPBOX_ACCESS_TOKEN --quiet

echo Done!
