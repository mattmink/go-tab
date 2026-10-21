# Dev fixtures

Sample configs for trying layouts. Not part of the packaged extension (`scripts/package.sh` leaves `dev/` out).

The easy way: **Settings → Backup → Import…** and pick `sample-22.json` or `sample-61.json`.

Or from the new tab page's DevTools console (works when the extension is loaded unpacked from this folder):

```js
await GT.store.set(await (await fetch('dev/sample-22.json')).json())   // 22 links in 4 groups
await GT.store.set(await (await fetch('dev/sample-61.json')).json())   // 61 links in 6 groups (XS)
await GT.store.set(GT.store.defaults())                                // back to the empty first-run state
```
