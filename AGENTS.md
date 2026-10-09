# User preferences

- Push completed changes directly to `main`. Do not create pull requests or merge requests.
- Update and regenerate `Manifest.json` for every release. Bump `package.json` version for changed releases; the builder derives the manifest version from it.
- Run the manifest builder and relevant tests before pushing. Keep the manifest URI and resource URLs on `main`.
- Describe HTML5 support accurately: the current frame-blending prototype needs a custom Denshi build; the ordinary plugin cannot access VideoCore frames.
