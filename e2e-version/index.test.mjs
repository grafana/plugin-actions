import { jest, describe, it, expect } from '@jest/globals';
import mockVersions from './mocks/versions.js';

const getInput = jest.fn();
const getBooleanInput = jest.fn();

jest.unstable_mockModule('@actions/core', () => ({
  getInput,
  getBooleanInput,
  setFailed: jest.fn(),
  setOutput: jest.fn(),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockVersions),
  })
);

const { run, VersionResolverTypeInput, VersionResolverTypes, GrafanaDependencyInput } = await import('./index.mjs');

describe('plugin-grafana-dependency mode', () => {
  it.each([
    {
      grafanaDependency: '>=10.2.0',
      expectedVersions: ['11.0.0', '10.4.3', '10.3.6', '10.2.7'],
    },
    {
      grafanaDependency: '>=10.4.0',
      expectedVersions: ['11.0.0', '10.4.3'],
    },
    {
      grafanaDependency: '>=10.4.4',
      expectedVersions: ['11.0.0'],
    },
    {
      grafanaDependency: '10.1.0 - 10.5.0',
      expectedVersions: ['10.4.3', '10.3.6', '10.2.7', '10.1.10'],
    },
    {
      grafanaDependency: '>=8.2.0 <9.1.5',
      expectedVersions: ['9.0.8', '8.5.27', '8.4.11', '8.3.11', '8.2.7'],
    },
    {
      grafanaDependency: '8.4.11 || 10.3.6',
      expectedVersions: ['10.3.6', '8.4.11'],
    },
  ])('expecting range $expectedVersions when grafanaDependency is $grafanaDependency', async (t) => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) {
        return VersionResolverTypes.PluginGrafanaDependency;
      }
      if (name === GrafanaDependencyInput) {
        return t.grafanaDependency;
      }
      if (name === 'limit') {
        return '6';
      }
      if (name === 'skip-grafana-nightly-image') {
        return 'true';
      }
      return '';
    });
    getBooleanInput.mockReturnValue(true);
    const images = await run();
    expect(images.map((i) => i.version)).toEqual(t.expectedVersions);
  });
});

describe('nightly image', () => {
  it('is included by default', async () => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === GrafanaDependencyInput) { return '>=10.4.4'; }
      if (name === 'limit') { return '6'; }
      return '';
    });
    getBooleanInput.mockReturnValue(false);
    const images = await run();
    expect(images[0]).toEqual({ name: 'grafana-enterprise', version: 'nightly' });
  });

  it('is skipped when skip-grafana-nightly-image is true', async () => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === GrafanaDependencyInput) { return '>=10.4.4'; }
      if (name === 'limit') { return '6'; }
      return '';
    });
    getBooleanInput.mockImplementation((name) => name === 'skip-grafana-nightly-image');
    const images = await run();
    expect(images.every((i) => i.version !== 'nightly')).toBe(true);
  });

  it('is skipped when deprecated skip-grafana-dev-image is true', async () => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === GrafanaDependencyInput) { return '>=10.4.4'; }
      if (name === 'limit') { return '6'; }
      return '';
    });
    getBooleanInput.mockImplementation((name) => name === 'skip-grafana-dev-image');
    const images = await run();
    expect(images.every((i) => i.version !== 'nightly')).toBe(true);
  });
});
