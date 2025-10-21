# Deployment Guide: Google Cloud Platform with Cloud Run

This guide will walk you through deploying the AiTA backend to Google Cloud Platform using Cloud Run.

## Prerequisites

1. **Google Cloud Account**: Ensure you have a Google Cloud account with billing enabled
2. **Google Cloud CLI**: Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
3. **Docker**: Install [Docker](https://docs.docker.com/get-docker/) (optional, for local testing)
4. **Project Setup**: Create a new Google Cloud project or use an existing one

## Step 1: Initial Setup

### 1.1 Authenticate with Google Cloud
```bash
gcloud auth login
gcloud auth application-default login
```

### 1.2 Set Your Project
```bash
# Replace YOUR_PROJECT_ID with your actual project ID
gcloud config set project YOUR_PROJECT_ID
```

### 1.3 Enable Required APIs
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 2: Environment Variables Setup

### 2.1 Set Environment Variables in Cloud Run
You'll need to set the following environment variables in Cloud Run:

**Required:**
- `GEMINI_API_KEY`: Your Google Gemini API key
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key (if using Clerk auth)
- `CLERK_SECRET_KEY`: Your Clerk secret key (if using Clerk auth)

**Optional:**
- `CORS_ORIGIN`: Set to your frontend domain (e.g., `https://your-frontend-domain.com`)
- `LOG_LEVEL`: Set to `info` for production

### 2.2 Using Google Secret Manager (Recommended)
For sensitive data like API keys, use Google Secret Manager:

```bash
# Create secrets
gcloud secrets create gemini-api-key --data-file=-
# Enter your API key when prompted

gcloud secrets create clerk-secret-key --data-file=-
# Enter your Clerk secret key when prompted
```

## Step 3: Deployment Options

### Option A: Manual Deployment (Quick Start)

#### 3.1 Build and Deploy Manually
```bash
# Navigate to the backend directory
cd backend

# Build the container image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/aita-backend

# Deploy to Cloud Run
gcloud run deploy aita-backend \
  --image gcr.io/YOUR_PROJECT_ID/aita-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars CORS_ORIGIN=* \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-secrets CLERK_SECRET_KEY=clerk-secret-key:latest
```

### Option B: Automated Deployment with Cloud Build

#### 3.1 Set up Cloud Build Trigger
```bash
# Connect your repository (GitHub/GitLab/Bitbucket)
gcloud alpha builds triggers create github \
  --repo-name=YOUR_REPO_NAME \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=backend/cloudbuild.yaml
```

#### 3.2 Push to trigger deployment
```bash
git add .
git commit -m "Deploy to Cloud Run"
git push origin main
```

## Step 4: Post-Deployment Configuration

### 4.1 Get the Service URL
```bash
gcloud run services describe aita-backend --region us-central1 --format 'value(status.url)'
```

### 4.2 Test the Deployment
```bash
# Test health endpoint
curl https://YOUR_CLOUD_RUN_URL/health

# Test Gemini health endpoint
curl https://YOUR_CLOUD_RUN_URL/health/gemini
```

### 4.3 Update Frontend Configuration
Update your frontend to point to the new Cloud Run URL:
- Update API base URL in your frontend configuration
- Update CORS settings if needed

## Step 5: Database Considerations

### Current Setup (SQLite)
The current deployment uses SQLite, which stores data in the container's filesystem. **Important limitations:**
- Data is lost when the container restarts
- Not suitable for production with multiple instances
- No data persistence across deployments

### Recommended Production Database Options

#### Option A: Cloud SQL (PostgreSQL/MySQL)
```bash
# Create Cloud SQL instance
gcloud sql instances create aita-db \
  --database-version=POSTGRES_13 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create aita_production --instance=aita-db
```

#### Option B: Cloud Firestore
- Better for document-based data
- Serverless and scales automatically
- Good for the quiz and notes structure

## Step 6: Monitoring and Logging

### 6.1 View Logs
```bash
gcloud run services logs read aita-backend --region us-central1
```

### 6.2 Monitor Performance
- Use Google Cloud Console to monitor CPU, memory, and request metrics
- Set up alerts for error rates and response times

## Step 7: Custom Domain (Optional)

### 7.1 Map Custom Domain
```bash
gcloud run domain-mappings create \
  --service aita-backend \
  --domain your-api-domain.com \
  --region us-central1
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in package.json
   - Verify Dockerfile syntax
   - Check Cloud Build logs

2. **Runtime Errors**
   - Check environment variables are set correctly
   - Verify secrets are accessible
   - Check application logs

3. **Database Issues**
   - Ensure data directory permissions are correct
   - Consider migrating to Cloud SQL for production

### Useful Commands

```bash
# View service details
gcloud run services describe aita-backend --region us-central1

# Update service with new environment variables
gcloud run services update aita-backend \
  --region us-central1 \
  --set-env-vars NEW_VAR=value

# Scale service
gcloud run services update aita-backend \
  --region us-central1 \
  --max-instances 20

# View build history
gcloud builds list

# Delete service (if needed)
gcloud run services delete aita-backend --region us-central1
```

## Security Best Practices

1. **Use Secret Manager** for sensitive data
2. **Enable IAM authentication** for production APIs
3. **Set up proper CORS** origins
4. **Use HTTPS** only (Cloud Run provides this by default)
5. **Regularly update dependencies**
6. **Monitor for vulnerabilities**

## Cost Optimization

1. **Set appropriate CPU and memory limits**
2. **Configure max instances** based on expected traffic
3. **Use minimum instances = 0** for cost savings (cold starts acceptable)
4. **Monitor usage** and adjust resources accordingly

## Next Steps

1. Set up CI/CD pipeline with automated testing
2. Implement proper database solution (Cloud SQL/Firestore)
3. Set up monitoring and alerting
4. Configure custom domain and SSL
5. Implement backup and disaster recovery

For more information, refer to the [Google Cloud Run documentation](https://cloud.google.com/run/docs).