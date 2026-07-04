const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Network Security Layer 2 — Android.
//
// Blocks cleartext (HTTP) traffic specifically to the production API domain,
// while leaving the app's existing `usesCleartextTraffic: true` (in app.json)
// in place for everything else. That flag is what lets local dev keep talking
// to a plain-HTTP LAN IP backend — Android has no equivalent of iOS's
// "allow local networking" exception, so this domain-scoped override is the
// closest match: once deployed, if anything tries to downgrade a request to
// the real API to HTTP, Android refuses it; local dev is untouched.
//
// IMPORTANT: replace `productionDomain` (passed as this plugin's config in
// app.json) with your real API domain once you have one. The placeholder
// below does nothing until it matches where the app actually points.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILENAME = 'network_security_config.xml';

const buildXml = (domain) => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">${domain}</domain>
  </domain-config>
  <debug-overrides>
    <trust-anchors>
      <certificates src="user"/>
    </trust-anchors>
  </debug-overrides>
</network-security-config>
`;

function withAndroidNetworkSecurityConfig(config, { productionDomain = 'api.vpay.in' } = {}) {
  // 1) Write the XML resource file during prebuild
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, CONFIG_FILENAME), buildXml(productionDomain));
      return cfg;
    },
  ]);

  // 2) Point the <application> tag at it
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return cfg;
  });

  return config;
}

module.exports = withAndroidNetworkSecurityConfig;
