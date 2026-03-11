#!/bin/bash
set -e

source .env

VERSION=$(node -p "require('./package.json').version")
echo "Deploying kf-browser-sdk v$VERSION..."

npm run build
npm run push

if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "No CLOUDFRONT_DISTRIBUTION_ID set. Creating a new CloudFront distribution..."

  DISTRIBUTION=$(aws cloudfront create-distribution \
    --region "$AWS_REGION" \
    --distribution-config "{
      \"CallerReference\": \"kf-browser-sdk-$(date +%s)\",
      \"Origins\": {
        \"Quantity\": 1,
        \"Items\": [
          {
            \"Id\": \"S3-$S3_BUCKET\",
            \"DomainName\": \"$S3_BUCKET.s3.$AWS_REGION.amazonaws.com\",
            \"S3OriginConfig\": {
              \"OriginAccessIdentity\": \"\"
            }
          }
        ]
      },
      \"DefaultCacheBehavior\": {
        \"TargetOriginId\": \"S3-$S3_BUCKET\",
        \"ViewerProtocolPolicy\": \"redirect-to-https\",
        \"AllowedMethods\": {
          \"Quantity\": 2,
          \"Items\": [\"HEAD\", \"GET\"]
        },
        \"ForwardedValues\": {
          \"QueryString\": false,
          \"Cookies\": { \"Forward\": \"none\" }
        },
        \"MinTTL\": 0,
        \"DefaultTTL\": 86400,
        \"MaxTTL\": 31536000
      },
      \"Comment\": \"kf-browser-sdk CDN\",
      \"Enabled\": true
    }" \
    --query 'Distribution.[Id,DomainName]' \
    --output text)

  DIST_ID=$(echo "$DISTRIBUTION" | awk '{print $1}')
  DOMAIN=$(echo "$DISTRIBUTION" | awk '{print $2}')

  echo ""
  echo "CloudFront distribution created!"
  echo "  Distribution ID: $DIST_ID"
  echo "  Domain: $DOMAIN"
  echo ""
  echo "Add this to your .env file:"
  echo "  CLOUDFRONT_DISTRIBUTION_ID=$DIST_ID"
else
  echo "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/browser-sdk/kf-browser-sdk-v$VERSION.min.js" "/browser-sdk/kf-browser-sdk.min.js" \
    --region "$AWS_REGION"
fi

echo "Deploy complete."
