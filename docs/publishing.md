# Publishing Jamingo

## Distribution

Repository: <https://github.com/pocky/jamingo>.

The project uses manual browser installation from GitHub release assets. It is
not published to browser extension stores. GitHub availability and the MIT
license do not establish authorization from Ultimate Guitar or YouTube.

## CI downloads

Pushes to branches, pull requests and manual workflow runs execute syntax,
unit/DOM and Chromium checks. Successful runs attach `jamingo-VERSION`, which
contains `jamingo.zip` and `SHA256SUMS`. Artifact retention is 30 days; use a
versioned release for a durable download without a GitHub login.

The workflow uses GitHub-hosted Ubuntu runners, Node.js 24, Python 3 and
Playwright-managed Chromium. Dependencies use `npm ci`; third-party actions are
pinned to reviewed commit SHAs. Only the release job receives repository write
permissions. No personal access token or payment credentials are needed.

## Create a versioned release

1. Update `manifest.json`, `package.json` and both root version fields in
   `package-lock.json` to the same numeric version. Keep `2.0.10` for the initial
   release; use a new version for subsequent releases.
2. Update user-facing documentation and run:

   ```sh
   npm ci
   npx playwright install chromium
   npm run check
   npm test
   npm run test:browser
   make zip
   python3 -m unittest discover -s tests -p 'test_package.py'
   ```

3. Commit the release contents and push the branch. For the initial version:

   ```sh
   git push origin main
   git tag v2.0.10
   git push origin v2.0.10
   ```

4. Wait for **CI and release** on the tag to succeed. It validates the tag against
   all version fields, runs the tests again, and publishes the exact tested ZIP
   with its checksum. Branch builds never publish a release.

GitHub's automatically generated source archives are not the installable asset.
The stable download URL is:

<https://github.com/pocky/jamingo/releases/latest/download/jamingo.zip>

To rerun tests after a failed tag build, use GitHub Actions' **Re-run jobs** on
that run. A manual workflow dispatch tests and builds but does not publish a
release. Existing published tags/releases must not be replaced silently; fix
the source and publish a new version instead.
