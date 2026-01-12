const core = require('@actions/core');
const semver = require('semver');
const getDevImageTag = require('./get-dev-image-tag');
const fs = require('fs/promises');
const path = require('path');

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

async function run() {
  try {
    const skipGrafanaDevImage = core.getBooleanInput(SkipGrafanaDevImageInput);

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
      versions = evenlyPickVersions(versions, skipGrafanaDevImage ? limit : limit - 1);
    }

    // official grafana-enterprise image
    const images = versions.map((version) => ({
      name: 'grafana-enterprise',
      version,
    }));

    if (!skipGrafanaDevImage) {
      // get the most recent grafana-dev image
      const tag = await getDevImageTag({ core });
      if (tag) {
        images.unshift({ name: 'grafana-dev', version: tag });
      }
    }

    if (!skipGrafanaReact19PreviewImage) {
      // Add hardcoded Grafana React 19 preview image
      images.push({ name: 'grafana', version: 'dev-preview-react19' });
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
