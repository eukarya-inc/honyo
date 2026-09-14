# Deploying Honyo settings with MDM

Honyo can take provider API keys and gateway endpoints from the organisation instead of
from each user. On macOS this is done with a configuration profile delivered by any MDM
that is connected to Apple Business Manager (Jamf Pro, Kandji, Mosyle, Microsoft Intune,
…). Apple Business Manager itself only enrols devices into your MDM; the settings travel
in the MDM's profile.

## What Honyo reads

| Platform | Source |
|----------|--------|
| macOS | Managed preferences for domain `com.rot1024.honyo` → `/Library/Managed Preferences/com.rot1024.honyo.plist` (or the per-user file under `/Library/Managed Preferences/<user>/`) |
| Windows | Registry policy `HKLM\SOFTWARE\Policies\Honyo` (then `HKCU`) |
| Any | `managed.json` — macOS `/Library/Application Support/Honyo/`, Windows `%ProgramData%\Honyo\`, Linux `/etc/honyo/` |

Later sources override earlier ones field by field. Values are enforced for every profile
on the machine and shown read-only in Settings → API Keys.

Schema (every key optional):

```json
{
  "providers": {
    "anthropic": { "apiKey": "…", "baseUrl": "https://llm-gateway.example.com/anthropic" },
    "openai":    { "baseUrl": "https://llm-gateway.example.com/openai" },
    "google":    { "apiKey": "…" },
    "xai":       { "baseUrl": "https://llm-gateway.example.com/xai" }
  }
}
```

## macOS: files in this folder

- `honyo-managed.mobileconfig` — a complete custom profile. Upload it as-is to Kandji
  (Library → Custom Profile), Mosyle (Profiles → Custom), or Jamf (Configuration Profiles →
  Upload). Edit the values first and regenerate the two `PayloadUUID`s with `uuidgen`.
- `com.rot1024.honyo.plist` — the bare preference plist for tools that ask for a domain plus
  a plist: Jamf "Application & Custom Settings → Upload" (domain `com.rot1024.honyo`) or
  Intune "Preference file" (macOS → Configuration profiles → Templates → Preference file).

Scope the profile to the device (`PayloadScope` = System) so it applies before login and to
every user.

## Verifying on a Mac

```sh
# Is the managed preference present?
defaults read /Library/Managed\ Preferences/com.rot1024.honyo
# What Honyo will see (same parser it uses):
plutil -convert json -o - /Library/Managed\ Preferences/com.rot1024.honyo.plist
```

Then launch Honyo: the log prints `Managed configuration active for providers: […]` and
Settings → API Keys shows the managed fields locked.

## Keys on disk vs. a gateway

A profile is readable by local administrators, and `/Library/Managed Preferences/*.plist`
is world-readable on many setups, so an API key delivered this way is not secret from the
person using the Mac. The recommended shape is therefore:

- run an LLM gateway (LiteLLM, Portkey, Cloudflare AI Gateway, …) that holds the real
  provider keys,
- push only `baseUrl` values pointing at it (plus, if the gateway needs one, a per-device or
  per-user gateway token as `apiKey`),
- rotate and revoke centrally at the gateway.

## Windows equivalent

```
reg add "HKLM\SOFTWARE\Policies\Honyo\providers\anthropic" /v baseUrl /t REG_SZ /d "https://llm-gateway.example.com/anthropic" /f
reg add "HKLM\SOFTWARE\Policies\Honyo\providers\anthropic" /v apiKey  /t REG_SZ /d "sk-ant-…" /f
```

Deliver these with Intune (Custom OMA-URI / PowerShell script) or Group Policy Preferences.
