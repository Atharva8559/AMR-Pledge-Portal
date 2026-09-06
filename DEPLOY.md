# Deploying ACT4AMR

The site is plain static files — no build step, no server code. Anything that can
serve a directory will run it.

## What ships

About 21 MB across 78 files. `.vercelignore` keeps the source photo folders, the
380 MB video master, `tools/` and the translation worksheet out of the upload;
none of them are served.

## Vercel

Two routes. Both need a Vercel account; neither needs a build command.

**A — from the CLI, no GitHub account required**

    npx vercel login
    npx vercel            # preview URL, safe to check first
    npx vercel --prod     # promote to the live URL

Run these from the project root. The first `vercel` run asks a few questions:
accept the defaults, and when it asks for a build command and output directory,
leave both empty — the files are already at the root.

**B — from a Git repository, so every push redeploys**

    git remote add origin <your-repo-url>
    git push -u origin main

Then in the Vercel dashboard: Add New → Project → import the repo. Framework
preset "Other", build command empty, output directory empty.

## About vercel.json

Two header rules only, both chosen conservatively:

- `/assets/*` is cached for one day. Deliberately **not** `immutable`, because
  the filenames are not content-hashed — an updated image reusing a name has to
  be able to reach people who already have the old one.
- Everything gets `nosniff`, a referrer policy, `SAMEORIGIN` framing and a
  permissions policy denying geolocation, microphone and camera.

There is no Content-Security-Policy. Adding one needs care: the page loads
`strings.mr.js` from its own origin, injects a `youtube-nocookie.com` iframe when
someone taps the video, and POSTs to `script.google.com` when someone pledges. A
strict default would break all three silently.

## The pledge counter

It is a Google Apps Script web app, configured in `app.js` at
`PLEDGE_COUNTER_URL`, and it works from any origin. Deploying does not change it.

If the counter should start from zero on launch, reset it before going live:
Apps Script project → Project Settings → Script Properties →
`act4amr_pledge_count`.

## After the first deploy, check on a real phone

- Sections fade and rise as you scroll. This could never be verified locally —
  headless Chrome here does not deliver IntersectionObserver callbacks at all.
- The pledge count appears after tapping Pledge. Over HTTPS the request to
  Apps Script behaves differently from `file://`, so this is worth confirming.
- The EN / मराठी toggle switches the page.
