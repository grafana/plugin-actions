const fs = require('fs');
const path = require('path');

// Ensure we are in the right directory
const reportsDir = 'all-reports';
if (!fs.existsSync(reportsDir) || !fs.statSync(reportsDir).isDirectory()) {
  console.error('Failed to enter directory all-reports');
  process.exit(1);
}

// Initialize the table variable
let table = '### Playwright test results';

// Check if any summary.txt has a PLUGIN_NAME value
const summaryFiles = fs
  .readdirSync(reportsDir)
  .map((dir) => path.join(reportsDir, dir, 'summary.txt'))
  .filter((file) => fs.existsSync(file));

const usePluginName = summaryFiles.some((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/^PLUGIN_NAME=(.+)$/m);
  return match && match[1].trim() !== '';
});

if (usePluginName) {
  table +=
    '\n| Plugin Name | Image Name | Version | Result | Report |\n|:----------- |:---------- |:------- |:------: |:------: |';
} else {
  table += '\n| Image Name | Version | Result | Report |\n|:---------- |:------- |:------: |:------: |';
}

// Initialize an array to store rows
let rows = [];

// Iterate through subdirectories
fs.readdirSync(reportsDir).forEach((dir) => {
  const dirPath = path.join(reportsDir, dir);
  if (!fs.statSync(dirPath).isDirectory()) return;

  const summaryFile = path.join(dirPath, 'summary.txt');
  if (!fs.existsSync(summaryFile)) {
    console.warn(`Warning: summary.txt not found in ${dir}`);
    return;
  }

  // Read data from summary.txt
  const content = fs.readFileSync(summaryFile, 'utf8');
  const getValue = (key) => (content.match(new RegExp(`${key}=(.*)`)) || [])[1]?.trim() || '';

  const grafanaImage = getValue('GRAFANA_IMAGE');
  const grafanaVersion = getValue('GRAFANA_VERSION');
  const testOutput = getValue('OUTPUT');
  const pluginName = getValue('PLUGIN_NAME');

  // Construct report link
  const repoOwner = process.env.GITHUB_REPOSITORY_OWNER;
  const repoName = process.env.GITHUB_REPOSITORY_NAME;
  const timestamp = process.env.TIMESTAMP;
  const eventNumber = process.env.GITHUB_EVENT_NUMBER;

  const reportLink = pluginName
    ? `https://${repoOwner}.github.io/${repoName}/${timestamp}/${eventNumber}/${pluginName}-${grafanaImage}-${grafanaVersion}/`
    : `https://${repoOwner}.github.io/${repoName}/${timestamp}/${eventNumber}/${grafanaImage}-${grafanaVersion}/`;

  // Map result to emoji
  const resultEmoji = testOutput === 'success' ? '✅' : '❌';

  // Check for index.html
  const hasReport = fs.existsSync(path.join(dirPath, 'index.html'));
  const reportCell = hasReport ? `[View report](${reportLink})` : ' ';

  if (!hasReport) {
    console.warn(`Warning: index.html not found in ${dir}`);
  }

  // Add row to table
  if (usePluginName) {
    rows.push(`| ${pluginName} | ${grafanaImage} | ${grafanaVersion} | ${resultEmoji} | ${reportCell} |`);
  } else {
    rows.push(`| ${grafanaImage} | ${grafanaVersion} | ${resultEmoji} | ${reportCell} |`);
  }
});

// Sort rows by version (assuming <major>.<minor>.<patch> format)
rows.sort((a, b) => {
  const getVersion = (row) => row.split('|')[usePluginName ? 3 : 2].trim();
  return getVersion(b).localeCompare(getVersion(a), undefined, { numeric: true });
});

// Add sorted rows to table
table += '\n' + rows.join('\n');

console.log(table);
