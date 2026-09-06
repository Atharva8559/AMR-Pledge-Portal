# Hosting ACT4AMR on S3 + CloudFront

One-time console setup, then `tools/deploy-aws.sh` for every deploy after.

The site is 21 MB of static files across 75 objects, and about 2 MB per visitor.
At that size the whole bill is CloudFront traffic — S3 storage works out under a
cent a month.

---

## 1. Create the bucket

S3 → Create bucket.

- **Name** — must be globally unique, e.g. `act4amr-site`
- **Region** — `ap-south-1` (Mumbai), closest to the audience
- **Block all public access** — **leave every box ticked**

That last one looks wrong and is not. The bucket stays completely private;
CloudFront reads it through an Origin Access Control, which is both safer and
cheaper than exposing the bucket, because nobody can bypass the CDN and bill you
for direct S3 egress.

Leave versioning off unless you want rollback history. Everything is in git.

## 2. Create the CloudFront distribution

CloudFront → Create distribution.

| Setting | Value |
|---|---|
| Origin domain | your bucket, chosen from the S3 list |
| Origin access | **Origin access control settings (recommended)** → Create new OAC → accept defaults |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | GET, HEAD |
| **Compress objects automatically** | **Yes** |
| Cache policy | **CachingOptimized** |
| **Default root object** | **`index.html`** |
| Price class | *Use all edge locations* keeps Indian POPs in play |

Two of those are easy to miss and both break the site:

- **Default root object.** Without it, `https://yourdomain/` returns an error
  instead of the page. Only `/index.html` would work.
- **Compress objects automatically.** Without it the HTML, CSS and JS ship
  uncompressed — roughly 206 KB instead of 50 KB, four times the bytes on
  exactly the slow connections this page was built for.

After it is created CloudFront shows a banner offering to **copy the bucket
policy**. Copy it, go to your bucket → Permissions → Bucket policy, and paste it.
Until you do, every request returns AccessDenied.

## 3. Deploy

Take the **Distribution ID** (looks like `E1A2B3C4D5E6F7`) from the CloudFront
console, then:

```bash
export S3_BUCKET=act4amr-site
export CLOUDFRONT_DISTRIBUTION_ID=E1A2B3C4D5E6F7

tools/deploy-aws.sh --dry-run   # builds and verifies, uploads nothing
tools/deploy-aws.sh             # for real
```

The script assembles a `.dist/` of exactly what ships, **checks that all 67 paths
the page references are actually in it**, uploads with the right Content-Type and
Cache-Control per file type, then invalidates the distribution.

That verification step is there for a reason: the first Vercel deploy went out
with all six partner logos 404ing, because an ignore pattern written `Logos/`
also matched `assets/web/logos/`. The files were present locally and the failure
appeared only on the server. The check would have caught it before upload.

Your site is then at `https://<distribution-id>.cloudfront.net`.

## 4. Custom domain, if you want one

1. Request a certificate in **ACM — and it must be in `us-east-1`**, not Mumbai.
   CloudFront only reads certificates from N. Virginia regardless of where your
   bucket lives. This catches almost everyone once.
2. Validate it by DNS (ACM gives you a CNAME to add).
3. CloudFront → your distribution → Settings → Edit → add your domain under
   **Alternate domain names (CNAMEs)** and select the certificate.
4. At your DNS provider, point the domain at the CloudFront domain name — an
   ALIAS/ANAME record at the apex, or a CNAME on `www`.

## Cost

| Line | At 100,000 visits/month |
|---|---|
| S3 storage, 21 MB | under $0.01 |
| S3 requests | pennies |
| S3 → CloudFront transfer | free |
| CloudFront, ~200 GB and ~2.1M requests | within the free allowance |

CloudFront's free allowance has long been 1 TB transfer and 10 million requests
per month — confirm the current inclusions on the CloudFront pricing page, since
the plan structure changed recently. You would stay on the $0 plan until roughly
half a million visits a month, and every plan is billed with **no overage
charges**, so a traffic spike cannot produce a surprise invoice.

## What this does not change

The pledge counter is a Google Apps Script web app configured in `app.js` at
`PLEDGE_COUNTER_URL`. It works from any origin and is unaffected by hosting.

If you want it AWS-native later, the equivalent is **Lambda + DynamoDB** behind a
Function URL — not an EC2 instance, which would sit idle between taps.

## After the first deploy

Check on a real phone:

- Sections fade and rise as you scroll. This has never been verifiable locally —
  headless Chrome here does not deliver IntersectionObserver callbacks at all.
- The pledge count appears after tapping Pledge.
- The EN / मराठी toggle switches the page.

And hard-reload before deciding something is broken. A cached failure is exactly
what made the logos look wrong after the last deploy, minutes after they were
fixed on the server.
