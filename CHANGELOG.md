## [1.2.6](https://github.com/lukislp/claude-queue-platform/compare/v1.2.5...v1.2.6) (2026-09-04)


### Bug Fixes

* **deps:** bump the dev group across 3 directories, dropping the typescript major ([8dbdda5](https://github.com/lukislp/claude-queue-platform/commit/8dbdda54ca69da22577d0ce1bb5ec8b441aeb3f6)), closes [#8](https://github.com/lukislp/claude-queue-platform/issues/8)

## [1.2.5](https://github.com/lukislp/claude-queue-platform/compare/v1.2.4...v1.2.5) (2026-09-04)


### Bug Fixes

* **ci:** ignore base image major bumps in Dependabot ([828ba61](https://github.com/lukislp/claude-queue-platform/commit/828ba61310f91b605ceb1118b5b734140878d867))

## [1.2.4](https://github.com/lukislp/claude-queue-platform/compare/v1.2.3...v1.2.4) (2026-09-04)


### Bug Fixes

* **ci:** bump actions/setup-node from 5 to 7 ([b1ae643](https://github.com/lukislp/claude-queue-platform/commit/b1ae643c8f76fa4c29a4958b9697b4210640b48d))
* **ci:** bump aquasecurity/trivy-action ([7776be5](https://github.com/lukislp/claude-queue-platform/commit/7776be51ed18bdd2c49a89719c62373de33e2f99))
* **ci:** bump docker/setup-buildx-action from 4.2.0 to 4.3.0 ([df7d2cb](https://github.com/lukislp/claude-queue-platform/commit/df7d2cb65125be44c156a0144f3755313c94618f))
* **deps:** bump class-validator from 0.14.4 to 0.15.1 in /apps/api ([6bc9b8d](https://github.com/lukislp/claude-queue-platform/commit/6bc9b8d30584b197fd914da361fc48063e0204a2))

## [1.2.3](https://github.com/lukislp/claude-queue-platform/compare/v1.2.2...v1.2.3) (2026-09-03)


### Bug Fixes

* **ci:** add Dependabot for github-actions, npm, docker ([074a23b](https://github.com/lukislp/claude-queue-platform/commit/074a23b8a66ff91b19e1f80dcbdf93dbf18128d8))

## [1.2.2](https://github.com/lukislp/claude-queue-platform/compare/v1.2.1...v1.2.2) (2026-08-25)


### Bug Fixes

* migrate redis-data PVC to Longhorn for cross-node replication ([23d308d](https://github.com/lukislp/claude-queue-platform/commit/23d308d4457f94439e68c569b0932a487ff34f45))

## [1.2.1](https://github.com/lukislp/claude-queue-platform/compare/v1.2.0...v1.2.1) (2026-08-25)


### Bug Fixes

* migrate claude-queue-pg to Longhorn storage; allow CNPG inter-instance replication traffic ([c258fde](https://github.com/lukislp/claude-queue-platform/commit/c258fdec45e7788be0437e62edff724db5781ae1))

# [1.2.0](https://github.com/lukislp/claude-queue-platform/compare/v1.1.1...v1.2.0) (2026-08-25)


### Features

* task retry, project management UI, output file listing, health checks and tests ([4485d5e](https://github.com/lukislp/claude-queue-platform/commit/4485d5eb307d836a9356ca530f87ca64cc3f75c0))

## [1.1.1](https://github.com/lukislp/claude-queue-platform/compare/v1.1.0...v1.1.1) (2026-08-25)


### Bug Fixes

* make task dispatch atomic across multiple devices ([55e5a17](https://github.com/lukislp/claude-queue-platform/commit/55e5a1780b35bd9786cefae70f9c0a52a6c0a6ff))

# [1.1.0](https://github.com/lukislp/claude-queue-platform/compare/v1.0.0...v1.1.0) (2026-08-25)


### Features

* wire up Flux GitOps deployment and generate cluster secret ([c110d47](https://github.com/lukislp/claude-queue-platform/commit/c110d473c8db5836f761f1305178fa638d813d36))

# 1.0.0 (2026-08-25)


### Features

* multi-user task queue platform with local agent and k8s deployment ([682410b](https://github.com/lukislp/claude-queue-platform/commit/682410bbb677d61aaeecc90ee09cc9e65fb0f17e))
