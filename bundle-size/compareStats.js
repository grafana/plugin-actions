// @ts-check
const fs = require("fs");

/**
 * @typedef {Object} AssetSize
 * @property {number} size
 */

/**
 * @typedef {Object} Entrypoint
 * @property {string} name
 * @property {number} assetsSize
 */

/**
 * @typedef {Object} EntryDiffResult
 * @property {AssetDiff[]} entries
 * @property {AssetDiff} total
 */

/**
 * @typedef {Object} AssetDiff
 * @property {string} name
 * @property {AssetSize} new
 * @property {AssetSize} old
 * @property {number} diff
 * @property {number} diffPercentage
 */

/**
 * @typedef {Object} AssetStat
 * @property {string} name
 * @property {number} size
 */

/**
 * @typedef {AssetStat & { modules?: ModuleStat[] }} ModuleStat
 */

/**
 * @typedef {Object} DiffResult
 * @property {AssetDiff[]} added
 * @property {AssetDiff[]} removed
 * @property {AssetDiff[]} bigger
 * @property {AssetDiff[]} smaller
 * @property {AssetDiff} total
 */

/**
 * @param {Array<AssetStat>} statAssets
 * @returns {Map<string, AssetSize>}
 */
function generateAssetSizes(statAssets = []) {
  return new Map(
    statAssets.map((asset) => {
      return [
        asset.name,
        {
          size: asset.size,
        },
      ];
    })
  );
}

/**
 * @param {Array<{ modules?: ModuleStat[] }>} statChunks
 * @returns {Map<string, AssetSize>}
 */
function generateModuleSizes(statChunks = []) {
  const moduleSizeMap = new Map();

  statChunks.forEach((chunk) => {
    if (!chunk.modules) {
      return;
    }

    chunk.modules.forEach((module) => {
      if (
        module.name.startsWith("webpack/") ||
        module.name.startsWith("external ")
      ) {
        return;
      }

      if (module.modules) {
        module.modules.forEach((submodule) => {
          if (
            submodule.name &&
            !submodule.name.startsWith("webpack/") &&
            !submodule.name.startsWith("external ")
          ) {
            addModuleSize(
              moduleSizeMap,
              getPackageName(submodule.name),
              submodule.size ?? 0
            );
          }
        });
      } else {
        addModuleSize(
          moduleSizeMap,
          getPackageName(module.name),
          module.size ?? 0
        );
      }
    });
  });

  return moduleSizeMap;
}

function addModuleSize(moduleSizeMap, packageName, size) {
  if (moduleSizeMap.has(packageName)) {
    const currentSize = moduleSizeMap.get(packageName).size;
    moduleSizeMap.set(packageName, { size: currentSize + size });
  } else {
    moduleSizeMap.set(packageName, { size });
  }
}

function getPackageName(modulePath) {
  if (!modulePath.includes("node_modules")) {
    return modulePath;
  }

  const pathParts = modulePath.split("node_modules/");
  const remainingPath = pathParts[1];

  // Extract package name considering scoped packages
  if (remainingPath.startsWith("@")) {
    const [scope, packageName] = remainingPath.split("/");
    return `${scope}/${packageName}`;
  } else {
    const [packageName] = remainingPath.split("/");
    return packageName;
  }
}

/**
 * @param {Record<string, Entrypoint>} statEntryPoints
 * @returns {Map<string, AssetSize>}
 */
function generateEntriesSizes(statEntryPoints = {}) {
  return new Map(
    Object.values(statEntryPoints).map((entrypoint) => {
      return [
        entrypoint.name,
        {
          size: entrypoint.assetsSize,
        },
      ];
    })
  );
}

/**
 * @param {Map<string, AssetSize>} oldEntries
 * @param {Map<string, AssetSize>} newEntries
 * @returns {EntryDiffResult}
 */
function entryStatsDiff(oldEntries, newEntries) {
  const diffResults = [];
  let oldTotal = 0;
  let newTotal = 0;

  for (const [entryName, newEntry] of newEntries) {
    const oldEntry = oldEntries.get(entryName) || { size: 0 };
    oldTotal += oldEntry.size;
    newTotal += newEntry.size;

    const diff = getAssetDiff(entryName, oldEntry, newEntry);
    diffResults.push(diff);
  }

  return {
    entries: diffResults,
    total: getAssetDiff(
      "Entrypoints Total",
      { size: oldTotal },
      { size: newTotal }
    ),
  };
}

/**
 * @param {string} name
 * @param {AssetSize} oldSize
 * @param {AssetSize} newSize
 * @returns {AssetDiff}
 */
function getAssetDiff(name, oldSize, newSize) {
  return {
    name,
    new: {
      size: newSize.size,
    },
    old: {
      size: oldSize.size,
    },
    diff: newSize.size - oldSize.size,
    diffPercentage: +((1 - newSize.size / oldSize.size) * -100).toFixed(2) || 0,
  };
}

/**
 * @param {Array<AssetDiff>} items
 * @returns {Array<AssetDiff>}
 */
function sortDiffDescending(items) {
  return items.sort(
    (diff1, diff2) => Math.abs(diff2.diff) - Math.abs(diff1.diff)
  );
}

/**
 * @param {Map<string, AssetSize>} oldAssets
 * @param {Map<string, AssetSize>} newAssets
 * @returns {DiffResult}
 */
function statsDiff(oldAssets, newAssets) {
  let oldTotal = 0;
  let newTotal = 0;
  const added = [];
  const removed = [];
  const bigger = [];
  const smaller = [];

  for (const [name, oldAssetSizes] of oldAssets) {
    oldTotal += oldAssetSizes.size;
    const newAsset = newAssets.get(name);
    if (!newAsset) {
      removed.push(getAssetDiff(name, oldAssetSizes, { size: 0 }));
    } else {
      const diff = getAssetDiff(name, oldAssetSizes, newAsset);

      if (diff.diffPercentage > 0) {
        bigger.push(diff);
      } else if (diff.diffPercentage < 0) {
        smaller.push(diff);
      }
    }
  }

  for (const [name, newAssetSizes] of newAssets) {
    newTotal += newAssetSizes.size;
    const oldAsset = oldAssets.get(name);
    if (!oldAsset) {
      added.push(getAssetDiff(name, { size: 0 }, newAssetSizes));
    }
  }

  const oldFilesCount = oldAssets.size;
  const newFilesCount = newAssets.size;

  return {
    added: sortDiffDescending(added),
    removed: sortDiffDescending(removed),
    bigger: sortDiffDescending(bigger),
    smaller: sortDiffDescending(smaller),
    total: getAssetDiff(
      oldFilesCount === newFilesCount
        ? `${newFilesCount}`
        : `${oldFilesCount} → ${newFilesCount}`,
      { size: oldTotal },
      { size: newTotal }
    ),
  };
}

/**
 * @param {string} mainStatsFile
 * @param {string} prStatsFile
 * @returns {{ assetsDiff: DiffResult, modulesDiff: DiffResult, entriesDiff: EntryDiffResult }}
 */
function compareStats(mainStatsFile, prStatsFile) {
  try {
    if (!fs.existsSync(mainStatsFile)) {
      throw new Error(`Main stats file not found: ${mainStatsFile}`);
    }
    if (!fs.existsSync(prStatsFile)) {
      throw new Error(`PR stats file not found: ${prStatsFile}`);
    }

    const mainStats = JSON.parse(fs.readFileSync(mainStatsFile).toString());
    const prStats = JSON.parse(fs.readFileSync(prStatsFile).toString());

    if (!mainStats.assets || !prStats.assets) {
      throw new Error("Invalid stats file format: Missing assets property.");
    }

    const mainAssets = generateAssetSizes(mainStats.assets);
    const prAssets = generateAssetSizes(prStats.assets);
    const mainModules = generateModuleSizes(mainStats.chunks);
    const prModules = generateModuleSizes(prStats.chunks);
    const mainEntries = generateEntriesSizes(mainStats.entrypoints);
    const prEntries = generateEntriesSizes(prStats.entrypoints);
    const assetsDiff = statsDiff(mainAssets, prAssets);
    const modulesDiff = statsDiff(mainModules, prModules);
    const entriesDiff = entryStatsDiff(mainEntries, prEntries);

    return {
      assetsDiff,
      modulesDiff,
      entriesDiff,
    };
  } catch (error) {
    throw new Error(`Error comparing stats: ${error.message}`);
  }
}

module.exports = {
  compareStats,
};
