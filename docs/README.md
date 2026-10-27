# Documentation — Open CLI Builder

Index of the technical documentation for the project. For an overview (what it is, features, usage), see the root [README.md](../README.md).

| Document | Contents |
|---|---|
| [architecture.md](architecture.md) | Code structure, data flow, state, catalog, and AI assistant. |
| [catalog-generation-aws.md](catalog-generation-aws.md) | Regenerating `public/catalog-aws.json` (`npm run catalog:aws`). |
| [catalog-generation-azure.md](catalog-generation-azure.md) | Regenerating `public/catalog-azure.json` (`npm run catalog:azure`). |
| [deployment-vercel.md](deployment-vercel.md) | Publishing as a static site on Vercel (dashboard, Git integration, domains). |
| [deployment-vercel-cli.md](deployment-vercel-cli.md) | Deploying from the terminal with the Vercel CLI. |
| [deployment-docker-local.md](deployment-docker-local.md) | Building and running the Docker image on your machine. |
| [deployment-aws-ec2-docker.md](deployment-aws-ec2-docker.md) | Deploying to an EC2 instance with Docker. |

## Deployment summary

| Goal | Document | What you need |
|---|---|---|
| Run the app in development | Root README, section 3 | Node 26, `npm run dev` |
| Publish to the public web without maintaining servers | [deployment-vercel.md](deployment-vercel.md) | Vercel account and a connected repository |
| Test the container on your PC | [deployment-docker-local.md](deployment-docker-local.md) | Docker |
| Publish on your own AWS server | [deployment-aws-ec2-docker.md](deployment-aws-ec2-docker.md) | AWS account, EC2 instance, Docker |

> **Note:** the app is a **100% static** site. It has no backend, no database, and no required environment variables, and it does not need AWS credentials to work. Any static file hosting can serve it.
