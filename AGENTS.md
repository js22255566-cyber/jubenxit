# Dialogue Atelier repository workflow

## GitHub synchronization

The owner authorized uploading this project and synchronizing the source after every subsequent requested development change.

- GitHub destination: https://github.com/js22255566-cyber/jubenxit ; branch: main ; local remote: github.
- Keep the Sites hosting workflow and its source repository intact. GitHub is an additional source backup, not a replacement for Sites publishing.
- After each change, complete relevant checks, commit the final local source, and upload the same source snapshot to GitHub during that task. Prefer the connected GitHub tools when authenticated Git CLI access is unavailable. A connector-created GitHub commit may have a different SHA from the Sites commit because it preserves GitHub's existing parent history.
- Before updating GitHub, inspect its branch head and current files. Preserve unrelated remote files. Use a base tree and an expected head SHA for a normal fast-forward update; do not force-push or overwrite unrelated changes.
- For the initial upload only, the owner's chosen repository was verified empty and public. Preserve its visibility unless the owner explicitly requests a change.
- Never upload service-account JSON, API keys, environment secrets, browser storage, WhatsApp delivery records, or runtime data exports. Keep credentials in the existing protected runtime configuration.
- Verify the resulting GitHub commit/ref before reporting successful synchronization. If access fails, preserve local work and explicitly report that synchronization is incomplete.
- This workflow covers changes made in authorized development tasks. It is not a background watcher for edits made outside those tasks.
