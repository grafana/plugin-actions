const { httpGet } = require('./dockerhub-api');

const DOCKERHUB_API_URL = 'https://registry.hub.docker.com/v2/repositories/grafana/grafana-dev/tags?page_size=25';
const GRAFANA_DEV_TAG_REGEX = /^(\d+\.\d+\.\d+)-(\d+)$/;

/**
 * Main entry point
 */
module.exports = async ({ core }) => {
  try {
    console.log('Getting latest Grafana dev tag from DockerHub...');

    const latestTag = await getLatestGrafanaDevTag();

    if (!latestTag) {
      core.setFailed('Could not find any Grafana dev tags on DockerHub');
      return;
    }

    core.info(`Found grafana/grafana-dev:${latestTag}`);
    return latestTag;
  } catch (error) {
    core.setFailed(error.message);
  }
};

/**
 * Fetches and returns the latest Grafana dev tag from DockerHub
 * @returns {Promise<string|null>} Latest tag name or null if not found
 */
async function getLatestGrafanaDevTag() {
  try {
    console.log('Fetching latest 25 tags from DockerHub...');
    const response = await httpGet(DOCKERHUB_API_URL);

    if (!response?.results?.length) {
      console.log('No tags found');
      return null;
    }

    console.log(`Found ${response.results.length} tags`);

    const validTags = response.results
      .map((item) => item.name)
      .map(parseGrafanaDevTag)
      .filter(Boolean)
      .sort((a, b) => b.buildNumber - a.buildNumber);

    if (validTags.length === 0) {
      console.log('No valid Grafana dev tags found');
      return null;
    }

    const latestTag = validTags[0];
    console.log(`Latest tag: ${latestTag.tag} (build ${latestTag.buildNumber}, from ${validTags.length} valid tags)`);
    return latestTag.tag;
  } catch (error) {
    console.log(`Error getting latest tag: ${error.message}`);
    return null;
  }
}

/**
 * Parses a Grafana dev tag string and extracts version and build information
 * @param {string} tagName - Tag name to parse (e.g., "12.3.0-17948569556")
 * @returns {Object|null} Parsed tag info or null if invalid
 */
function parseGrafanaDevTag(tagName) {
  const match = tagName.match(GRAFANA_DEV_TAG_REGEX);
  if (!match) {
    return null;
  }

  return {
    tag: tagName,
    version: match[1],
    buildNumber: parseInt(match[2], 10),
  };
}
