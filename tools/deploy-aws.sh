#!/usr/bin/env bash
#
# Deploy ACT4AMR to S3 + CloudFront.
#
#   tools/deploy-aws.sh                 # build, verify, upload, invalidate
#   tools/deploy-aws.sh --dry-run       # build and verify only, touch nothing remote
#
# Configure these two, or export them in your shell:
S3_BUCKET="${S3_BUCKET:-}"                       # e.g. act4amr-site
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"   # e.g. E1A2B3C4D5E6F7
AWS_REGION="${AWS_REGION:-ap-south-1}"           # Mumbai
#
# WHY THIS BUILDS A dist/ INSTEAD OF SYNCING THE REPO WITH --exclude:
# the first Vercel deploy shipped with all six partner logos 404ing, because an
# ignore pattern written as "Logos/" matched assets/web/logos/ as well as the
# root folder it was aimed at. Ignore patterns fail silently and only on the
# server. Assembling an explicit dist/ and then checking every path the page
# asks for is actually present removes that whole class of bug.

set -euo pipefail
cd "$(dirname "$0")/.."
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

DIST=".dist"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. assemble exactly what ships ──────────────────────────────────────────
say "Building $DIST"
rm -rf "$DIST"; mkdir -p "$DIST"
for f in index.html style.css app.js strings.mr.js; do
  [[ -f "$f" ]] || die "missing $f"
  cp "$f" "$DIST/"
done
cp -R assets "$DIST/assets"
find "$DIST" -name '.DS_Store' -delete
echo "  $(find "$DIST" -type f | wc -l | tr -d ' ') files, $(du -sh "$DIST" | cut -f1)"

# ── 2. verify every path the page requests is present ───────────────────────
say "Verifying every referenced path exists in $DIST"
python3 - "$DIST" <<'PY'
import re, os, sys
dist = sys.argv[1]
h = open('index.html').read()
refs  = set(re.findall(r'(?:src|href)="(?!https?:|data:|#|mailto:)([^"]+)"', h))
refs |= set(re.findall(r"openPosterModal\(this,\s*'([^']+)'", h))
refs |= set(re.findall(r"triggerDirectDownload\('([^']+)'", h))
refs.add('strings.mr.js')
missing = sorted(r for r in refs if not os.path.exists(os.path.join(dist, r)))
if missing:
    print("  MISSING FROM THE BUILD:")
    for m in missing: print("    " + m)
    sys.exit(1)
print(f"  all {len(refs)} referenced paths present")
PY

if $DRY_RUN; then
  say "Dry run — nothing uploaded."; echo "  Inspect $DIST, then rerun without --dry-run."; exit 0
fi

[[ -n "$S3_BUCKET" ]] || die "S3_BUCKET is not set (edit this script or export it)"
[[ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]] || die "CLOUDFRONT_DISTRIBUTION_ID is not set"

# ── 3. upload, in three passes so each type gets the right cache policy ──────
# Assets are cached for a day and deliberately NOT immutable: filenames are not
# content-hashed, so an updated image reusing a name has to be able to reach
# people who already hold the old one.
say "Uploading to s3://$S3_BUCKET"

aws s3 sync "$DIST/assets" "s3://$S3_BUCKET/assets" \
  --region "$AWS_REGION" --delete --only-show-errors \
  --cache-control "public, max-age=86400" \
  --exclude "*" --include "*.webp" --content-type "image/webp"

aws s3 sync "$DIST/assets" "s3://$S3_BUCKET/assets" \
  --region "$AWS_REGION" --only-show-errors \
  --cache-control "public, max-age=86400" \
  --exclude "*.webp"

# HTML, CSS and JS revalidate every time so a deploy is visible immediately.
# They are small — 50 KB gzipped together — so there is nothing to gain by caching them.
aws s3 cp "$DIST/index.html" "s3://$S3_BUCKET/index.html" \
  --region "$AWS_REGION" --only-show-errors \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=0, must-revalidate"

for f in style.css app.js strings.mr.js; do
  case "$f" in
    *.css) CT="text/css; charset=utf-8" ;;
    *)     CT="application/javascript; charset=utf-8" ;;
  esac
  aws s3 cp "$DIST/$f" "s3://$S3_BUCKET/$f" \
    --region "$AWS_REGION" --only-show-errors \
    --content-type "$CT" --cache-control "public, max-age=0, must-revalidate"
done
echo "  upload complete"

# ── 4. invalidate ────────────────────────────────────────────────────────────
# CloudFront gives 1,000 free invalidation paths a month. "/*" counts as one.
say "Invalidating CloudFront"
ID=$(aws cloudfront create-invalidation \
      --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
      --paths "/*" --query 'Invalidation.Id' --output text)
echo "  invalidation $ID created (takes a minute or two to complete)"

say "Done"
echo "  Hard-reload the site to confirm — browsers hold on to old assets, and"
echo "  a cached failure is what made the logos look broken after the last deploy."
