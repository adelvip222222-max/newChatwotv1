# NewChatwot

AI-first CRM, customer support, omnichannel inbox, and SaaS platform.

## Architecture Roadmap

- [AI-first CRM roadmap](docs/AI_FIRST_CRM_ROADMAP.md)
- [Theme strategy](docs/THEME_STRATEGY.md)

## Deployment for dent-ix.app

To deploy this app on `dent-ix.app`:

1. Copy `.env.production.example` to `.env.production` and fill the required values.
2. Set `NEXTAUTH_URL=https://dent-ix.app`.
3. Run the deployment helper script:
   ```bash
   sudo bash scripts/deploy-dent-ix.sh your-email@example.com
   ```
4. Ensure your DNS for `dent-ix.app` and `www.dent-ix.app` points to this server.
