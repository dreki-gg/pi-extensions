---
'@dreki-gg/pi-context7': patch
---

Fix Context7 config loading to read from Pi's global extension directory (`~/.pi/agent/extensions/context7`) instead of the installed npm package directory. This restores `apiKey` detection from `config.json`, ensures authenticated requests include the Authorization header, and prevents unexpected rate limiting when a key is already configured.
