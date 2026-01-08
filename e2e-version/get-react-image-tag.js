const semver = require('semver');
const { httpGet } = require('./dockerhub-api');

const DOCKERHUB_API_URL = 'https://registry.hub.docker.com/v2/repositories/grafana/grafana/tags?page_size=100';
const GRAFANA_REACT_TAG_REGEX = /^(\d+\.\d+\.\d+)-react(\d+)$/;

/**
 * Main entry point
 */
module.exports = async ({ core }) => {
  try {
    console.log('Getting latest Grafana React tag from DockerHub...');

    const latestTag = await getLatestGrafanaReactTag();

    if (!latestTag) {
      core.warning('Could not find any Grafana React tags on DockerHub');
      return null;
    }

    core.info(`Found grafana/grafana:${latestTag}`);
    return latestTag;
  } catch (error) {
    core.warning(`Error getting React image tag: ${error.message}`);
    return null;
  }
};

/**
 * Fetches and returns the latest Grafana React tag from DockerHub
 * @returns {Promise<string|null>} Latest tag name or null if not found
 */
async function getLatestGrafanaReactTag() {
  try {
    console.log('Fetching tags from DockerHub...');
    const response = await httpGet(DOCKERHUB_API_URL);

    if (!response?.results?.length) {
      console.log('No tags found');
      return null;
    }

    console.log(`Found ${response.results.length} tags`);

    const reactTags = response.results
      .map((item) => item.name)
      .filter((tag) => tag.includes('-react'))
      .map(parseGrafanaReactTag)
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by Grafana version first (newest first)
        const versionCompare = semver.rcompare(a.version, b.version);
        if (versionCompare !== 0) return versionCompare;
        // Then by React version (highest first)
        return b.reactVersion - a.reactVersion;
      });

    if (reactTags.length === 0) {
      console.log('No valid Grafana React tags found');
      return null;
    }

    const latestTag = reactTags[0];
    console.log(
      `Latest React tag: ${latestTag.tag} (Grafana ${latestTag.version}, React ${latestTag.reactVersion}, from ${reactTags.length} valid tags)`
    );
    return latestTag.tag;
  } catch (error) {
    console.log(`Error getting latest React tag: ${error.message}`);
    return null;
  }
}

/**
 * Parses a Grafana React tag string and extracts version and React version information
 * @param {string} tagName - Tag name to parse (e.g., "12.4.0-react19")
 * @returns {Object|null} Parsed tag info or null if invalid
 */
function parseGrafanaReactTag(tagName) {
  const match = tagName.match(GRAFANA_REACT_TAG_REGEX);
  if (!match) {
    return null;
  }

  return {
    tag: tagName,
    version: match[1],
    reactVersion: parseInt(match[2], 10),
  };
}
