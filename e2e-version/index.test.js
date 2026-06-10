const { run, VersionResolverTypeInput, VersionResolverTypes, GrafanaDependencyInput } = require('./index');
const mockVersions = require('./mocks/versions');
const { getInput, getBooleanInput } = require('@actions/core');

// The action makes two fetch calls: the Grafana versions API and the feature-toggle
// variants JSON. Route by URL so each can be controlled independently per test.
let versionsPayload = mockVersions;
let variantsPayload = [];
let variantsResponseOk = true;

global.fetch = jest.fn((url) => {
  if (typeof url === 'string' && url.includes('feature-toggle-variants')) {
    return Promise.resolve({
      ok: variantsResponseOk,
      status: variantsResponseOk ? 200 : 500,
      json: () => Promise.resolve(variantsPayload),
    });
  }
  return Promise.resolve({ json: () => Promise.resolve(versionsPayload) });
});

beforeEach(() => {
  versionsPayload = mockVersions;
  variantsPayload = [];
  variantsResponseOk = true;
});

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
  // Latest patch per minor resolves to: 11.0.0, 13.0.5, 13.1.5, 13.2.1.
  const versionsWith13 = {
    items: [stable('11.0.0'), stable('13.0.5'), stable('13.1.2'), stable('13.1.5'), stable('13.2.1')],
  };
  // The remotely-fetched variant definitions (an array, matching feature-toggle-variants.json).
  // No runInRepositories → runs everywhere (used by the version-resolution tests).
  const variant = (overrides = {}) => ({
    name: 'grafana-enterprise',
    enabledToggles: 'react19',
    grafanaDependency: '>=13.1.0 <13.2.0',
    ...overrides,
  });

  const originalRepo = process.env.GITHUB_REPOSITORY;
  afterEach(() => {
    if (originalRepo === undefined) {
      delete process.env.GITHUB_REPOSITORY;
    } else {
      process.env.GITHUB_REPOSITORY = originalRepo;
    }
  });

  // Resolver inputs that keep the matrix focused: nightly skipped, react19 explicitly enabled.
  const inputs = ({ dependency, skipReact19 }) => {
    getInput.mockImplementation((name) => {
      if (name === VersionResolverTypeInput) { return VersionResolverTypes.PluginGrafanaDependency; }
      if (name === GrafanaDependencyInput) { return dependency; }
      if (name === 'limit') { return '6'; }
      // Omit the deprecated input unless using it as a kill-switch; a non-empty value
      // would mark it "explicitly provided" and trigger a deprecation warning.
      if (name === 'skip-grafana-react-19-preview-image') { return skipReact19 ? 'true' : ''; }
      return '';
    });
    getBooleanInput.mockImplementation((name) => {
      if (name === 'skip-grafana-nightly-image') { return true; }
      if (name === 'skip-grafana-react-19-preview-image') { return skipReact19; }
      return false;
    });
  };

  it('applies react19 to the version satisfying the grafanaDependency range, alongside the baseline', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ grafanaDependency: '>=13.1.0 <13.2.0' })]; // only 13.1.5 satisfies
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' });
    // baseline 13.1.5 still present (no dedup)
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: '' });
    // no react19 on a version outside the range
    expect(images).not.toContainEqual({ name: 'grafana-enterprise', version: '13.2.1', enabledToggles: 'react19' });
    // no legacy preview tag
    expect(images.every((i) => i.version !== 'dev-preview-react19')).toBe(true);
    // every non-variant item has an empty toggle string
    expect(images.filter((i) => i.enabledToggles !== 'react19').every((i) => i.enabledToggles === '')).toBe(true);
  });

  it('applies react19 to every available version satisfying a broader range', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ grafanaDependency: '>=13.0.0' })]; // 13.0.5, 13.1.5, 13.2.1 satisfy
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.0.5', enabledToggles: 'react19' });
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' });
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.2.1', enabledToggles: 'react19' });
    // 11.0.0 does not satisfy the range → no react19 for it
    expect(images).not.toContainEqual({ name: 'grafana-enterprise', version: '11.0.0', enabledToggles: 'react19' });
  });

  it('skips the variant when no available version satisfies the range', async () => {
    // default versionsPayload (mockVersions) tops out at 11.x, so nothing satisfies >=13.1.0
    variantsPayload = [variant({ grafanaDependency: '>=13.1.0 <13.2.0' })];
    inputs({ dependency: '>=10.4.4', skipReact19: false });
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('skips the variant when grafanaDependency is an invalid range', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ grafanaDependency: 'not-a-valid-range' })];
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('skips the variant when skip-grafana-react-19-preview-image is true', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = [variant()];
    inputs({ dependency: '>=13.0.0', skipReact19: true });
    const images = await run();

    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('skips variants but still builds the matrix when the variants fetch fails', async () => {
    versionsPayload = versionsWith13;
    variantsResponseOk = false; // simulate a non-2xx response from the remote list
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
    // baseline entries are unaffected by the variants fetch failing
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: '' });
  });

  it('skips variants when the payload is not an array', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = { '13.1': { enabledToggles: 'react19' } }; // wrong shape (object, not array)
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('skips malformed entries without failing and still resolves valid ones', async () => {
    versionsPayload = versionsWith13;
    variantsPayload = [
      null,
      'oops',
      { enabledToggles: 'react19', grafanaDependency: '>=13.1.0 <13.2.0' }, // missing name
      { name: 'grafana-enterprise', grafanaDependency: '>=13.1.0 <13.2.0' }, // missing enabledToggles
      { name: '', enabledToggles: 'react19', grafanaDependency: '>=13.1.0 <13.2.0' }, // empty name
      variant(), // the one valid entry
    ];
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    // only the valid entry resolves; malformed entries are skipped, not fatal
    expect(images.filter((i) => i.enabledToggles === 'react19')).toEqual([
      { name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' },
    ]);
  });

  it('includes the variant when runInRepositories matches the current repository', async () => {
    process.env.GITHUB_REPOSITORY = 'grafana/some-plugin';
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ runInRepositories: ['^grafana/'] })];
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' });
  });

  it('excludes the variant when runInRepositories does not match the current repository', async () => {
    process.env.GITHUB_REPOSITORY = 'external-org/some-plugin';
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ runInRepositories: ['^grafana/'] })];
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
    // baseline entries are still present
    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: '' });
  });

  it('ignores invalid runInRepositories patterns without failing', async () => {
    process.env.GITHUB_REPOSITORY = 'grafana/some-plugin';
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ runInRepositories: ['['] })]; // invalid regex
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(Array.isArray(images)).toBe(true);
    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });

  it('runs everywhere when runInRepositories is omitted', async () => {
    process.env.GITHUB_REPOSITORY = 'external-org/some-plugin';
    versionsPayload = versionsWith13;
    variantsPayload = [variant()]; // no runInRepositories
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images).toContainEqual({ name: 'grafana-enterprise', version: '13.1.5', enabledToggles: 'react19' });
  });

  it('excludes the variant when runInRepositories is present but not an array', async () => {
    process.env.GITHUB_REPOSITORY = 'grafana/some-plugin';
    versionsPayload = versionsWith13;
    variantsPayload = [variant({ runInRepositories: 'grafana' })]; // misconfigured (string, not array)
    inputs({ dependency: '>=13.0.0', skipReact19: false });
    const images = await run();

    expect(images.every((i) => i.enabledToggles !== 'react19')).toBe(true);
  });
});
