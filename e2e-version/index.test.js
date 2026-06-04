const { run, VersionResolverTypeInput, VersionResolverTypes, GrafanaDependencyInput } = require('./index');
const mockVersions = require('./mocks/versions');
const { getInput, getBooleanInput } = require('@actions/core');

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve(mockVersions),
  })
);

jest.mock('@actions/core', () => ({
  ...jest.requireActual('@actions/core'),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
}));

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
    expect(images[0]).toEqual({ name: 'grafana-enterprise', version: 'nightly', enabledToggles: '' });
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

describe('feature toggle variants (react19)', () => {
  const stable = (version) => ({ version, channels: { stable: true, preview: false, beta: false, nightly: false } });
  // Includes two 13.1 patches to prove the latest patch wins.
  const versionsWith13 = {
    items: [stable('11.0.0'), stable('13.0.5'), stable('13.1.2'), stable('13.1.5'), stable('13.2.1')],
  };

  const mockFetchOnce = (payload) =>
    global.fetch.mockResolvedValueOnce({ json: () => Promise.resolve(payload) });

  // Resolver inputs that keep the matrix focused: nightly skipped, react19 explicitly enabled.
  const inputs = ({ dependency, skipReact19 }) => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === GrafanaDependencyInput) { return dependency; }
      if (name === 'limit') { return '6'; }
      if (name === 'skip-grafana-react-19-preview-image') { return skipReact19 ? 'true' : 'false'; }
      return '';
    });
    getBooleanInput.mockImplementation((name) => {
      if (name === 'skip-grafana-nightly-image') { return true; }
      if (name === 'skip-grafana-react-19-preview-image') { return skipReact19; }
      return false;
    });
  };

  it('appends the latest 13.1 patch with react19 enabled, alongside the baseline 13.1 entry', async () => {
    mockFetchOnce(versionsWith13);
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' });
    // baseline 13.1.5 still present (no dedup)
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: '' });
    // no legacy preview tag
    expect(images.every((i) => i.version !== 'dev-preview-react19')).toBe(true);
    // every non-variant item has an empty toggle string
    expect(images.filter((i) => i.enabledToggles !== 'react19').every((i) => i.enabledToggles === '')).toBe(true);
  });

  it('skips the react19 variant when no 13.1 release exists', async () => {
    inputs({ dependency: '>=10.4.4', skipReact19: false }); // default mock tops out at 11.x
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('skips the react19 variant when skip-grafana-react-19-preview-image is true', async () => {
    mockFetchOnce(versionsWith13);
    inputs({ dependency: '>=13.0.0', skipReact19: true });
    const images = await run();

    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });
});
