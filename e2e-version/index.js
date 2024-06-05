const core = require('@actions/core');
const semver = require('semver');
const npmToDockerImage = require('./npm-to-docker-image');
const fs = require('fs/promises');
const path = require('path');

const SkipGrafanaDevImageInput = 'skip-grafana-dev-image';
const VersionResolverTypeInput = 'version-resolver-type';
const GrafanaDependencyInput = 'grafana-dependency';
const MatrixOutput = 'matrix';
const VERSIONS_LIMIT = 5;

const VersionResolverTypes = {
  PluginGrafanaDependency: 'plugin-grafana-dependency',
  VersionSupportPolicy: 'version-support-policy',
};

async function run() {
  try {
    const skipGrafanaDevImage = core.getBooleanInput(SkipGrafanaDevImageInput);
    const grafanaDependency = core.getInput(GrafanaDependencyInput);
    const versionResolverType = core.getInput(VersionResolverTypeInput) || VersionResolverTypes.PluginGrafanaDependency;
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
        const pluginDependency = grafanaDependency === '' ? (await getPluginGrafanaDependencyFromPluginJson()) : grafanaDependency;
        console.log(`Found version requirement ${pluginDependency}`);
        for (const grafanaVersion of availableGrafanaVersions) {
          if (semver.satisfies(grafanaVersion.version, pluginDependency)) {
            versions.push(grafanaVersion.version);
          }
        }
    }

    if (versionResolverType === VersionResolverTypes.PluginGrafanaDependency) {
      // limit the number of versions to avoid starting too many jobs
      versions = evenlyPickVersions(versions, VERSIONS_LIMIT);
    }

    // official grafana-enterprise image
    const images = versions.map((version) => ({
      name: 'grafana-enterprise',
      version,
    }));

    if (!skipGrafanaDevImage) {
      // get the most recent grafana-dev image
      const tag = await npmToDockerImage({ core });
      if (tag) {
        images.unshift({ name: 'grafana-dev', version: tag });
      }
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

  const result = [allItems.shift(), allItems.pop()];
  limit -= 2;
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
