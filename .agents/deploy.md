# Deployment Rules (UPDATED)

We have disabled Google Cloud Build triggers to save on costs. Future Cloud Run deployments must be executed directly from the user's standard local hardware.

Do NOT simply execute `git push` expecting the project to go live.

## Deployment Pipeline Command

When completing tasks that require updating the live website code, execute the local PowerShell script:
`.\scripts\deploy.ps1`

This will:
1. Build the Docker container mapping.
2. Push the Docker image to the Google Container Registry.
3. Patch `trello-clone-us` and `trello-clone-eu` to run the updated container automatically.
