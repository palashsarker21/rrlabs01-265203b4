# Android APK / TWA branding

The Play Store / installed-app labels for this PWA come from **three** sources.
All three must show RRLabs branding — otherwise Android falls back to "base.apk".

## 1. Web App Manifest — `public/manifest.webmanifest`

Canonical source. Read by Chrome, PWABuilder, and Bubblewrap.

| Field        | Value                   |
| ------------ | ----------------------- |
| `id`         | `/`                     |
| `name`       | `Revenue Recovery Labs` |
| `short_name` | `RRLabs`                |

- Android install dialog → `name` → **Revenue Recovery Labs**
- Home Screen / App Drawer → `short_name` → **RRLabs**

## 2. Bubblewrap / PWABuilder — `twa-manifest.json`

Committed at repo root. Regenerate the Android project with:

```bash
npx @bubblewrap/cli init --manifest ./twa-manifest.json
npx @bubblewrap/cli build
```

| Field          | Value                   | Surfaces as                 |
| -------------- | ----------------------- | --------------------------- |
| `name`         | `Revenue Recovery Labs` | Settings → Apps, Play Store |
| `launcherName` | `RRLabs`                | Home Screen, App Drawer     |
| `packageId`    | `online.rrlabs.twa`     | Android application ID      |

`launcherName` must be ≤ 12 chars to avoid launcher truncation — `RRLabs` fits.

## 3. Generated `AndroidManifest.xml` (do not hand-edit)

Bubblewrap writes:

```xml
<application
    android:label="@string/appName"           <!-- Revenue Recovery Labs -->
    android:name="LauncherActivity">
  <activity
      android:label="@string/launcherName"    <!-- RRLabs -->
      ...>
```

Strings come from `app/src/main/res/values/strings.xml` which Bubblewrap
populates from `twa-manifest.json`. If you ever see `android:label="base"` or
`base.apk` on device, the generator was run before this file existed —
delete `/app` and re-run `bubblewrap init`.

## Verification checklist

After building & installing the APK:

- [ ] Install dialog title → **Revenue Recovery Labs**
- [ ] Home Screen icon label → **RRLabs**
- [ ] App Drawer label → **RRLabs**
- [ ] Settings → Apps entry → **Revenue Recovery Labs**
- [ ] `aapt dump badging app-release.apk | grep application-label`
      → `application-label:'Revenue Recovery Labs'`
- [ ] `aapt dump badging app-release.apk | grep launchable-activity`
      → `label='RRLabs'`

The APK file itself is still named `base.apk` inside the AAB bundle — that is
the internal split name and is invisible to end users. Only the labels above
are user-facing.
