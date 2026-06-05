const core = require('@actions/core');
const semver = require('semver');
const fs = require('fs/promises');
const path = require('path');

const SkipGrafanaNightlyImageInput = 'skip-grafana-nightly-image';
const SkipGrafanaDevImageInput = 'skip-grafana-dev-image';
const SkipGrafanaReact19PreviewImageInput = 'skip-grafana-react-19-preview-image';
const VersionResolverTypeInput = 'version-resolver-type';
const GrafanaDependencyInput = 'grafana-dependency';
const LimitInput = 'limit';
const MatrixOutput = 'matrix';

const VersionResolverTypes = {
  PluginGrafanaDependency: 'plugin-grafana-dependency',
  VersionSupportPolicy: 'version-support-policy',
};

// The feature-toggle variant definitions are fetched at runtime from this URL so they
// can be updated (adding/removing variants) by merging a PR to main, without requiring
// consumers to bump the pinned action version. See feature-toggle-variants.json.
// Each key is a Grafana minor version (major.minor) mapping to { name, enabledToggles }.
const FeatureToggleVariantsUrl =
  'https://raw.githubusercontent.com/grafana/plugin-actions/main/e2e-version/feature-toggle-variants.json';

async function run() {
  try {
    // skip-grafana-dev-image is a deprecated alias for skip-grafana-nightly-image
    const skipGrafanaNightlyImage =
      core.getBooleanInput(SkipGrafanaNightlyImageInput) || core.getBooleanInput(SkipGrafanaDevImageInput);

    // Determine default for React image based on repository owner
    // Include by default for Grafana org repositories, skip for others
    // GITHUB_REPOSITORY is in format "owner/repo", GITHUB_REPOSITORY_OWNER might not be available
    const githubRepository = process.env.GITHUB_REPOSITORY || '';
    const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER || githubRepository.split('/')[0] || '';
    const isGrafanaOrg = repositoryOwner.toLowerCase() === 'grafana';

    // Check if input was explicitly provided by checking if getInput returns non-empty string
    // core.getInput() returns empty string when input is not provided
    const reactImageInputValue = core.getInput(SkipGrafanaReact19PreviewImageInput);
    const isExplicitlyProvided = reactImageInputValue !== '';

    // If input is not explicitly provided, use org-based defaults
    // If input is explicitly provided, always honor it using getBooleanInput
    let skipGrafanaReact19PreviewImage;
    if (!isExplicitlyProvided) {
      // Input not provided: use defaults based on org
      skipGrafanaReact19PreviewImage = !isGrafanaOrg; // false for Grafana org (include), true for external (skip)
    } else {
      // Input explicitly provided: always honor it
      skipGrafanaReact19PreviewImage = core.getBooleanInput(SkipGrafanaReact19PreviewImageInput);
    }

    const grafanaDependency = core.getInput(GrafanaDependencyInput);
    const versionResolverType = core.getInput(VersionResolverTypeInput) || VersionResolverTypes.PluginGrafanaDependency;
    const limit = parseInt(core.getInput(LimitInput));
    const availableGrafanaVersions = await getGrafanaStableMinorVersions();
    if (availableGrafanaVersions.length === 0) {
      core.setFailed('Could not find any stable Grafana versions');
      return;
    }

    let versions = [];
    switch (versionResolverType) {
      case VersionResolverTypes.VersionSupportPolicy:
        const currentMajorVersion = availableGrafanaVersions[0].major;
        const previousMajorVersion = currentMajorVersion - 1;
        for (const grafanaVersion of availableGrafanaVersions) {
          if (previousMajorVersion > grafanaVersion.major) {
            break;
          }
          if (currentMajorVersion === grafanaVersion.major) {
            versions.push(grafanaVersion.version);
          }
          if (previousMajorVersion === grafanaVersion.major) {
            versions.push(grafanaVersion.version);
            break;
          }
        }
        break;
      default:
        const pluginDependency =
          grafanaDependency === '' ? await getPluginGrafanaDependencyFromPluginJson() : grafanaDependency;
        console.log(`Found version requirement ${pluginDependency}`);
        for (const grafanaVersion of availableGrafanaVersions) {
          if (semver.satisfies(grafanaVersion.version, pluginDependency)) {
            versions.push(grafanaVersion.version);
          }
        }
    }

    if (limit !== 0 && versionResolverType === VersionResolverTypes.PluginGrafanaDependency && versions.length !== 0) {
      // limit the number of versions to avoid starting too many jobs
      const stableVersionLimit = Math.max(0, skipGrafanaNightlyImage ? limit : limit - 1);
      versions = evenlyPickVersions(versions, stableVersionLimit);
    }

    // official grafana-enterprise image
    const images = versions.map((version) => ({
      name: 'grafana-enterprise',
      version,
      enabledToggles: '',
    }));

    if (!skipGrafanaNightlyImage) {
      images.unshift({ name: 'grafana-enterprise', version: 'nightly', enabledToggles: '' });
    }

    if (!skipGrafanaReact19PreviewImage) {
      // Append feature-toggle variants (e.g. React 19) resolved to real Grafana releases
      images.push(...(await resolveFeatureToggleVariants(availableGrafanaVersions)));
    }

    console.log('Resolved images: ', images);
    core.setOutput(MatrixOutput, JSON.stringify(images));
    return images;
  } catch (error) {
    core.setFailed(error.message);
  }
}

/**
 * Limits the number of versions to the given @param {number} limit
 * The first and the last versions are always included. The rest of the versions are picked evenly.
 *
 * @param {string[]} allItems
 * @param {number} limit
 **/
function evenlyPickVersions(allItems, limit) {
  if (limit >= allItems.length) {
    return allItems;
  }

  const result = limit > 1 ? [allItems.shift(), allItems.pop()] : [allItems.shift()];
  limit -= result.length;
  const interval = allItems.length / limit;

  for (let i = 0; i < limit; i++) {
    const evenIndex = Math.floor(i * interval + interval / 2);
    result.push(allItems[evenIndex]);
  }

  return semver.rsort(result);
}

/**
 * Fetches the feature-toggle variant definitions from {@link FeatureToggleVariantsUrl}.
 * On any failure (network error, non-2xx response, malformed payload) a warning is logged
 * and an empty object is returned so variants are simply skipped (not fatal).
 *
 * @returns {Promise<Record<string, { name: string, enabledToggles: string }>>}
 **/
async function fetchFeatureToggleVariants() {
  try {
    const response = await fetch(FeatureToggleVariantsUrl);
    if (!response.ok) {
      console.warn(`Could not fetch feature toggle variants (HTTP ${response.status}); skipping variants`);
      return {};
    }
    const json = await response.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      console.warn('Feature toggle variants payload is not an object; skipping variants');
      return {};
    }
    return json;
  } catch (error) {
    console.warn(`Could not fetch feature toggle variants: ${error.message}; skipping variants`);
    return {};
  }
}

/**
 * Resolves the feature-toggle matrix variants fetched from {@link FeatureToggleVariantsUrl}.
 * For each registered minor version, finds its latest stable patch from the available
 * versions and returns a matrix item with the configured feature toggles enabled.
 * Minors with no matching stable release are skipped (logged, not fatal).
 *
 * @param {semver.SemVer[]} availableGrafanaVersions latest patch per minor
 * @returns {Promise<{ name: string, version: string, enabledToggles: string }[]>}
 **/
async function resolveFeatureToggleVariants(availableGrafanaVersions) {
  const definitions = await fetchFeatureToggleVariants();
  const variants = [];
  for (const [minor, { name, enabledToggles }] of Object.entries(definitions)) {
    const match = availableGrafanaVersions.find((v) => `${v.major}.${v.minor}` === minor);
    if (match) {
      variants.push({ name, version: match.version, enabledToggles });
    } else {
      console.log(`Skipping feature-toggle variant for ${minor}: no stable release found`);
    }
  }
  return variants;
}

async function getGrafanaStableMinorVersions() {
  const latestMinorVersions = new Map();

  const response = await fetch('https://grafana.com/api/grafana-enterprise/versions');
  const json = await response.json();
  const grafanaVersions = json.items;

  for (const grafanaVersion of grafanaVersions) {
    // ignore pre-releases
    if (grafanaVersion.channels.stable !== true) {
      continue;
    }
    const v = semver.parse(grafanaVersion.version);

    const baseVersion = new semver.SemVer(`${v.major}.${v.minor}.0`).toString();
    if (!latestMinorVersions.has(baseVersion)) {
      latestMinorVersions.set(baseVersion, v);
    }

    const maxVersion = latestMinorVersions.get(baseVersion);
    const cc = maxVersion.compare(v);
    if (cc < 0) {
      latestMinorVersions.set(baseVersion, v);
    }
  }

  return Array.from(latestMinorVersions).map(([_, semver]) => semver);
}

async function getPluginGrafanaDependencyFromPluginJson() {
  const file = await fs.readFile(path.resolve(path.join(process.cwd(), 'src'), 'plugin.json'), 'utf8');
  const json = JSON.parse(file);
  if (!json.dependencies.grafanaDependency) {
    throw new Error('Could not find plugin grafanaDependency');
  }

  return json.dependencies.grafanaDependency;
}
run();

module.exports = {
  run,
  VersionResolverTypeInput,
  VersionResolverTypes,
  GrafanaDependencyInput,
};
