# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2026-06-10

### Added
- add `tsconfig.build.json` for optimized build configuration, separating it from development settings.

### Changed
- update `getWaybackItemsWithLocalChanges` to skip duplicate wayback items based on zoom level.
- update `getWaybackItemsWithLocalChanges` for improved performance by reducing redundant wayback tile retrievals during deduplication.
- update `tsconfig.json` to include `jest` types for better test type checking.
- update `tsconfig.json` to enable strict mode and improve type safety across the codebase

## 2025-10-03

### Added
- add validation functions to enhance wayback configuration retrieval
- add unit tests for `getWaybackConfigFileURL` and `getWaybackSubDomains` functions        
- add `setCustomWaybackConfig` to API Documentation

### Fixed
- update import paths for wayback item retrieval in change detector and metadata modules

### Changed
- upgrade devDependencies in `package.json`
- replace `setDefaultWaybackOptions` with `setCustomWaybackConfig` for improved configuration handling
- reorganize wayback item helpers and tests


## 2024-09-09
### Added
- add `getWaybackSubDomains` to return an array of subDomain names where tiles are served to speed up tile retrieval.

### Fixed

### Changed
- update `getWaybackServiceBaseURL` to return URLs with different sub domains.
- update `getTileImageURL` to return URLs with different sub domains.

### Removed
