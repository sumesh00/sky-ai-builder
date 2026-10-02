# Deploy SKY AI Builder on Render

This repository includes `render.yaml`, which creates two Render services:

- `sky-ai-builder` — the public React frontend at `https://sky-ai-builder.onrender.com` when that name is available.
- `sky-ai-builder-api` — the private application backend exposed at its own Render URL.

## Deploy

1. Create a GitHub repository and push this project to it.
2. In Render, select **New → Blueprint** and connect that GitHub repository.
3. Render reads `render.yaml` from the repository root.
4. Enter `OPENAI_API_KEY` and `OPENAI_MODEL` in Render when it asks for them. Do not commit either value.
5. Create the Blueprint and wait for both services to deploy.

The frontend is configured to call `https://sky-ai-builder-api.onrender.com`.
If Render reports that either service name is already in use, rename both the
service and the matching URL values in `render.yaml` before creating the
Blueprint.

## Important limits

The public Builder can use only the AI provider credentials configured in the
Render backend service. Generated project previews, Git versioning, and file
storage use the Render service filesystem, which is not a replacement for a
durable project workspace. Use the Builder export feature to download projects.
