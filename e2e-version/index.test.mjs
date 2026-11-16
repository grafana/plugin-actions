import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import mockVersions from './mocks/versions.js';

const getInput = jest.fn();
const getBooleanInput = jest.fn();
const setFailed = jest.fn();

jest.unstable_mockModule('@actions/core', () => ({
  getInput,
  getBooleanInput,
  setFailed,
  setOutput: jest.fn(),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockVersions),
  })
);

const {
  run,
  GrafanaImageInput,
  GrafanaImages,
  VersionResolverTypeInput,
  VersionResolverTypes,
  GrafanaDependencyInput,
  PluginDirectoryInput,
  LimitInput,
} = await import('./index.mjs');

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
      if (name === PluginDirectoryInput) {
        return '';
      }
      if (name === LimitInput) {
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
    expect(images[0]).toEqual({ name: 'grafana', version: 'nightly' });
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

describe('non-default plugin directory', () => {
  it('is used when plugin-directory is set', async () => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === PluginDirectoryInput) { return 'mocks'; }
      if (name === LimitInput) { return '2'; }
      return '';
    });
    getBooleanInput.mockReturnValue(true);
    const images = await run();
    expect(images.map((i) => i.version)).toEqual(['11.0.0', '10.4.3']);
  });
});

describe('grafana-image input', () => {
  const mockInputs = (grafanaImage) => {
    getInput.mockImplementation((name) => {
      if (name === GrafanaImageInput) {
        return grafanaImage;
      }
      if (name === VersionResolverTypeInput) {
        return VersionResolverTypes.PluginGrafanaDependency;
      }
      if (name === GrafanaDependencyInput) {
        return '>=10.4.0';
      }
      if (name === LimitInput) {
        return '6';
      }
      return '';
    });
    getBooleanInput.mockReturnValue(false);
  };

  beforeEach(() => {
    global.fetch.mockClear();
    setFailed.mockClear();
  });

  it('defaults to the grafana image', async () => {
    mockInputs('');
    const images = await run();
    expect(images.every((i) => i.name === GrafanaImages.Grafana)).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://grafana.com/api/grafana/versions');
  });

  it('uses grafana-enterprise for versions and nightly when set', async () => {
    mockInputs(GrafanaImages.GrafanaEnterprise);
    const images = await run();
    expect(images[0]).toEqual({ name: 'grafana-enterprise', version: 'nightly' });
    expect(images.every((i) => i.name === GrafanaImages.GrafanaEnterprise)).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://grafana.com/api/grafana-enterprise/versions');
  });

  it('fails on an unknown image', async () => {
    mockInputs('grafana-dev');
    const images = await run();
    expect(images).toBeUndefined();
    expect(setFailed).toHaveBeenCalledWith(expect.stringContaining('Invalid grafana-image'));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
