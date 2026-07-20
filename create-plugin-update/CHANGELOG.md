# Changelog

## [2.0.3](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v2.0.2...create-plugin-update/v2.0.3) (2026-07-20)


### 🐛 Bug Fixes

* **create-plugin-update:** use GitHub API for signed commits ([#243](https://github.com/grafana/plugin-actions/issues/243)) ([e7454d7](https://github.com/grafana/plugin-actions/commit/e7454d721b60af8ac7e09468ebd8f8870586fc68))


### 🔧 Chores

* **deps:** update actions/checkout action to v7 ([#270](https://github.com/grafana/plugin-actions/issues/270)) ([fe60599](https://github.com/grafana/plugin-actions/commit/fe60599bf6453cc386cde73bffc54ef6c03aeecd))
* **deps:** update actions/setup-node action to v6.4.0 ([#260](https://github.com/grafana/plugin-actions/issues/260)) ([3e30713](https://github.com/grafana/plugin-actions/commit/3e30713c15032f5f007990895f670109433ca871))
* **deps:** update pnpm/action-setup action to v4.4.0 ([#263](https://github.com/grafana/plugin-actions/issues/263)) ([eca4d6d](https://github.com/grafana/plugin-actions/commit/eca4d6dc21545900d203739eb089bd3e803abc10))

## [2.0.2](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v2.0.1...create-plugin-update/v2.0.2) (2026-03-09)


### 🐛 Bug Fixes

* only open PR if create-plugin ran migrations ([#208](https://github.com/grafana/plugin-actions/issues/208)) ([88be477](https://github.com/grafana/plugin-actions/commit/88be477d6f3d0e4f108995299d877b0495ece8e3))

## [2.0.1](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v2.0.0...create-plugin-update/v2.0.1) (2025-11-13)


### 🐛 Bug Fixes

* **cp-update:** make sure create-plugin has access to npm deps before running update ([dd34868](https://github.com/grafana/plugin-actions/commit/dd34868a33d0757cefd13d9753d31d9401d3e17b))
* make sure create-plugin has access to npm dependencies ([#183](https://github.com/grafana/plugin-actions/issues/183)) ([dd34868](https://github.com/grafana/plugin-actions/commit/dd34868a33d0757cefd13d9753d31d9401d3e17b))

## [2.0.0](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v1.1.0...create-plugin-update/v2.0.0) (2025-11-13)


### ⚠ BREAKING CHANGES

* make token required ([#180](https://github.com/grafana/plugin-actions/issues/180))

### 🎉 Features

* make token required ([#180](https://github.com/grafana/plugin-actions/issues/180)) ([d198906](https://github.com/grafana/plugin-actions/commit/d198906dcbf0b99d6f51326906d2b5e11ca57d47))


### 🔧 Chores

* **deps:** update actions/checkout action to v4.3.0 ([#143](https://github.com/grafana/plugin-actions/issues/143)) ([c99ec26](https://github.com/grafana/plugin-actions/commit/c99ec265400dbb0d095f7fb0a18463b08e38ce13))
* **deps:** update actions/checkout action to v5 ([#159](https://github.com/grafana/plugin-actions/issues/159)) ([e9255a9](https://github.com/grafana/plugin-actions/commit/e9255a9752322e5b4b097bd73d0b4cc2cee8c9f1))
* **deps:** update actions/setup-node action to v5 ([#164](https://github.com/grafana/plugin-actions/issues/164)) ([78fa21c](https://github.com/grafana/plugin-actions/commit/78fa21caec491398393602502ae28fe3184c3a13))
* **deps:** update actions/setup-node action to v6 ([#175](https://github.com/grafana/plugin-actions/issues/175)) ([8e19900](https://github.com/grafana/plugin-actions/commit/8e19900577d14a8ac66c5e8299ce51522590c219))

## [1.1.0](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v1.0.2...create-plugin-update/v1.1.0) (2025-09-30)


### 🎉 Features

* **create-plugin-update:** support create-plugin v6 commit flag ([d92dec2](https://github.com/grafana/plugin-actions/commit/d92dec26f8d15121cd63a561f9b10be706914969))
* support create-plugin commit flag ([#123](https://github.com/grafana/plugin-actions/issues/123)) ([d92dec2](https://github.com/grafana/plugin-actions/commit/d92dec26f8d15121cd63a561f9b10be706914969))


### 🐛 Bug Fixes

* Disable immutable yarn installs ([#114](https://github.com/grafana/plugin-actions/issues/114)) ([d3b5481](https://github.com/grafana/plugin-actions/commit/d3b5481e69625e28da59ea65020d5b92a9dfb43d))

## [1.0.2](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v1.0.1...create-plugin-update/v1.0.2) (2025-08-04)


### 📝 Documentation

* adding comments to tag where versions should be updated ([#103](https://github.com/grafana/plugin-actions/issues/103)) ([f04e214](https://github.com/grafana/plugin-actions/commit/f04e21488739016924156a57530ff8cb99041232))

## [1.0.1](https://github.com/grafana/plugin-actions/compare/create-plugin-update/v1.0.0...create-plugin-update/v1.0.1) (2025-07-17)


### 🐛 Bug Fixes

* **create-plugin-update:** use sed to grab version and strip all whitespace to prevent errors in ci ([f93cbca](https://github.com/grafana/plugin-actions/commit/f93cbcad931e5e35d6a6ad23275c39dffc64bbb0))


### 🔧 Chores

* replace github-actiosn with plugins platform bot ([#76](https://github.com/grafana/plugin-actions/issues/76)) ([b788be6](https://github.com/grafana/plugin-actions/commit/b788be6746403ff9bae26d5e800794f2a5620b4c))
* Update workflows ([#62](https://github.com/grafana/plugin-actions/issues/62)) ([7d3424c](https://github.com/grafana/plugin-actions/commit/7d3424c2ecf660e43bb1ca90d877754575cf2e16))
