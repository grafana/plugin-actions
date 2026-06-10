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
// The payload is an array of { name, enabledToggles, grafanaDependency, runInRepositories }.
const FeatureToggleVariantsUrl =
  'https://raw.githubusercontent.com/grafana/plugin-actions/main/e2e-version/feature-toggle-variants.json';

async function run() {
  try {
    // skip-grafana-dev-image is a deprecated alias for skip-grafana-nightly-image
    const skipGrafanaNightlyImage =
      core.getBooleanInput(SkipGrafanaNightlyImageInput) || core.getBooleanInput(SkipGrafanaDevImageInput);

    // GITHUB_REPOSITORY is in format "owner/repo"; used to match runInRepositories patterns
    const githubRepository = process.env.GITHUB_REPOSITORY || '';

    // Deprecated: variant targeting is now controlled centrally via runInRepositories in
    // feature-toggle-variants.json. The input is still honored as an explicit kill-switch.
    const skipReact19InputValue = core.getInput(SkipGrafanaReact19PreviewImageInput);
    let skipFeatureToggleVariants = false;
    if (skipReact19InputValue !== '') {
      skipFeatureToggleVariants = core.getBooleanInput(SkipGrafanaReact19PreviewImageInput);
      console.warn(
        `${SkipGrafanaReact19PreviewImageInput} is deprecated; variant targeting is now controlled via ` +
          `runInRepositories in feature-toggle-variants.json`
      );
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

    if (!skipFeatureToggleVariants) {
      // Append feature-toggle variants (e.g. React 19) resolved to real Grafana releases
      images.push(...(await resolveFeatureToggleVariants(availableGrafanaVersions, githubRepository)));
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
 * and an empty array is returned so variants are simply skipped (not fatal).
 *
 * @returns {Promise<{ name: string, enabledToggles: string, grafanaDependency: string, runInRepositories?: string[] }[]>}
 **/
async function fetchFeatureToggleVariants() {
  try {
    const response = await fetch(FeatureToggleVariantsUrl);
    if (!response.ok) {
      console.warn(`Could not fetch feature toggle variants (HTTP ${response.status}); skipping variants`);
      return [];
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      console.warn('Feature toggle variants payload is not an array; skipping variants');
      return [];
    }
    return json;
  } catch (error) {
    console.warn(`Could not fetch feature toggle variants: ${error.message}; skipping variants`);
    return [];
  }
}

/**
 * @param {unknown} value
 * @returns {boolean} true when value is a non-empty (after trim) string
 **/
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Determines whether a variant applies to the given repository based on its
 * runInRepositories regex patterns. An omitted or empty list means "run everywhere".
 * A present-but-non-array value is a misconfiguration: it is logged and treated as
 * non-matching (rather than running everywhere). Invalid patterns are logged and
 * ignored (treated as non-matching). None of these cases are fatal.
 *
 * @param {string[]|undefined} runInRepositories regex strings; omitted/empty = match all
 * @param {string} repository the GITHUB_REPOSITORY value ("owner/repo")
 * @returns {boolean}
 **/
function matchesRepository(runInRepositories, repository) {
  if (runInRepositories === undefined || runInRepositories === null) {
    return true; // field omitted → run everywhere
  }
  if (!Array.isArray(runInRepositories)) {
    console.warn('Invalid runInRepositories (expected an array of patterns); treating variant as non-matching');
    return false;
  }
  if (runInRepositories.length === 0) {
    return true; // empty list → run everywhere
  }
  return runInRepositories.some((pattern) => {
    try {
      return new RegExp(pattern).test(repository);
    } catch (error) {
      console.warn(`Invalid runInRepositories pattern "${pattern}": ${error.message}; ignoring`);
      return false;
    }
  });
}

/**
 * Resolves the feature-toggle matrix variants fetched from {@link FeatureToggleVariantsUrl}.
 * For each variant, applies its feature toggles to every available Grafana version that
 * satisfies the variant's grafanaDependency semver range. Variants are filtered by their
 * runInRepositories patterns against the current repository. Variants with an invalid range
 * or no satisfying release are skipped (logged, not fatal).
 *
 * @param {semver.SemVer[]} availableGrafanaVersions latest patch per minor
 * @param {string} repository the GITHUB_REPOSITORY value ("owner/repo")
 * @returns {Promise<{ name: string, version: string, enabledToggles: string }[]>}
 **/
async function resolveFeatureToggleVariants(availableGrafanaVersions, repository) {
  const definitions = await fetchFeatureToggleVariants();
  const variants = [];
  for (const entry of definitions) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      console.warn(`Skipping feature-toggle variant: entry is not an object (${JSON.stringify(entry)})`);
      continue;
    }
    const { name, enabledToggles, grafanaDependency, runInRepositories } = entry;
    if (!isNonEmptyString(name) || !isNonEmptyString(enabledToggles)) {
      console.warn('Skipping feature-toggle variant: "name" and "enabledToggles" must be non-empty strings');
      continue;
    }
    if (!matchesRepository(runInRepositories, repository)) {
      console.log(`Skipping feature-toggle variant "${enabledToggles}": not enabled for repository ${repository}`);
      continue;
    }
    if (!grafanaDependency || semver.validRange(grafanaDependency) === null) {
      console.warn(
        `Skipping feature-toggle variant "${enabledToggles}": invalid grafanaDependency range "${grafanaDependency}"`
      );
      continue;
    }
    const matching = availableGrafanaVersions.filter((v) => semver.satisfies(v.version, grafanaDependency));
    if (matching.length === 0) {
      console.log(
        `Skipping feature-toggle variant "${enabledToggles}": no stable release satisfies ${grafanaDependency}`
      );
      continue;
    }
    for (const v of matching) {
      variants.push({ name, version: v.version, enabledToggles });
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
