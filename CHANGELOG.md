## [1.2.29](https://github.com/lukislp/claude-queue-platform/compare/v1.2.28...v1.2.29) (2026-09-13)


### Bug Fixes

* **k8s:** back up claude-queue-pg to R2 with WAL archiving ([#68](https://github.com/lukislp/claude-queue-platform/issues/68)) ([7423bf8](https://github.com/lukislp/claude-queue-platform/commit/7423bf809355f860ec49478bcc77ecb0831a7664))

## [1.2.28](https://github.com/lukislp/claude-queue-platform/compare/v1.2.27...v1.2.28) (2026-09-13)


### Bug Fixes

* **k8s:** give probes a 5s timeout so load spikes stop killing pods ([#67](https://github.com/lukislp/claude-queue-platform/issues/67)) ([0dad4fa](https://github.com/lukislp/claude-queue-platform/commit/0dad4faa882e0e2eb0e21c32fea8ee01e0bfa2c7))

## [1.2.27](https://github.com/lukislp/claude-queue-platform/compare/v1.2.26...v1.2.27) (2026-09-13)


### Bug Fixes

* **k8s:** read-only root filesystem for api and web ([#66](https://github.com/lukislp/claude-queue-platform/issues/66)) ([6cd94af](https://github.com/lukislp/claude-queue-platform/commit/6cd94af6c0ce962950c38b65be17116e37f642e3))

## [1.2.26](https://github.com/lukislp/claude-queue-platform/compare/v1.2.25...v1.2.26) (2026-09-13)


### Bug Fixes

* **k8s:** disable the CNPG PodDisruptionBudget for the single-instance postgres ([#65](https://github.com/lukislp/claude-queue-platform/issues/65)) ([51fc339](https://github.com/lukislp/claude-queue-platform/commit/51fc339a8159a69c6ae7a66f1c82e83dc6f66604))
* **k8s:** enforce Pod Security Standards "restricted" on the claude-queue namespace ([#64](https://github.com/lukislp/claude-queue-platform/issues/64)) ([addd8c3](https://github.com/lukislp/claude-queue-platform/commit/addd8c3244fe2862bf8fc0ec86ad8b265d11b9b1))

## [1.2.25](https://github.com/lukislp/claude-queue-platform/compare/v1.2.24...v1.2.25) (2026-09-13)


### Bug Fixes

* **k8s:** pin the redis image by digest ([#63](https://github.com/lukislp/claude-queue-platform/issues/63)) ([012801c](https://github.com/lukislp/claude-queue-platform/commit/012801c04851a2db3ca715a13f3e0f87e1535069))

## [1.2.24](https://github.com/lukislp/claude-queue-platform/compare/v1.2.23...v1.2.24) (2026-09-13)


### Bug Fixes

* **deps:** bump react-dom and @types/react-dom in /apps/web ([8d648f8](https://github.com/lukislp/claude-queue-platform/commit/8d648f8f4d8a6a3bc6d19c4056f3b8da4dc35e9d))

## [1.2.23](https://github.com/lukislp/claude-queue-platform/compare/v1.2.22...v1.2.23) (2026-09-13)


### Bug Fixes

* **deps:** bump react and @types/react in /apps/web ([f4d19b9](https://github.com/lukislp/claude-queue-platform/commit/f4d19b960967c319b6939a5e60d0a691c1682ae2))
* **deps:** bump the dev group across 3 directories with 1 update ([82f0df1](https://github.com/lukislp/claude-queue-platform/commit/82f0df1c56978afa36327d1f48d1c692877f2321))

## [1.2.22](https://github.com/lukislp/claude-queue-platform/compare/v1.2.21...v1.2.22) (2026-09-13)


### Bug Fixes

* **web:** lint in CI on eslint 9, effects load state through promise callbacks ([#58](https://github.com/lukislp/claude-queue-platform/issues/58)) ([a8880fa](https://github.com/lukislp/claude-queue-platform/commit/a8880fa80615b07873285e96ca46834b9cf8915b))

## [1.2.21](https://github.com/lukislp/claude-queue-platform/compare/v1.2.20...v1.2.21) (2026-09-12)


### Bug Fixes

* **ci:** retry semantic-release on the out-of-band-push race and audit every app ([#53](https://github.com/lukislp/claude-queue-platform/issues/53)) ([58ee1b0](https://github.com/lukislp/claude-queue-platform/commit/58ee1b05c74d7a0e8e35fd43f7edd086a59da25f))

## [1.2.20](https://github.com/lukislp/claude-queue-platform/compare/v1.2.19...v1.2.20) (2026-09-12)


### Bug Fixes

* **deps:** bump the dev group across 1 directory with 2 updates ([975f8ea](https://github.com/lukislp/claude-queue-platform/commit/975f8ea957b3041a1ac0d6f861fcef06b555cac9))

## [1.2.19](https://github.com/lukislp/claude-queue-platform/compare/v1.2.18...v1.2.19) (2026-09-12)


### Bug Fixes

* **deps:** bump @anthropic-ai/sdk from 0.123.0 to 0.124.0 in /apps/api ([25658c0](https://github.com/lukislp/claude-queue-platform/commit/25658c0900d696013939c23a9f66a741682d0624))

## [1.2.18](https://github.com/lukislp/claude-queue-platform/compare/v1.2.17...v1.2.18) (2026-09-12)


### Bug Fixes

* **ci:** bump the deployment image tag from the pipeline instead of Flux ([#44](https://github.com/lukislp/claude-queue-platform/issues/44)) ([02cfe9c](https://github.com/lukislp/claude-queue-platform/commit/02cfe9ca0e6e38af830ed159b6fdf0d218f1af75))

## [1.2.17](https://github.com/lukislp/claude-queue-platform/compare/v1.2.16...v1.2.17) (2026-09-11)


### Bug Fixes

* **ci:** read-only GITHUB_TOKEN in the Dependabot auto-merge workflow ([20b38c9](https://github.com/lukislp/claude-queue-platform/commit/20b38c95a94517dcbdbde73e17ac4719dd224d0b))

## [1.2.16](https://github.com/lukislp/claude-queue-platform/compare/v1.2.15...v1.2.16) (2026-09-11)


### Bug Fixes

* resolve CodeQL findings ([#39](https://github.com/lukislp/claude-queue-platform/issues/39)) ([a9051c3](https://github.com/lukislp/claude-queue-platform/commit/a9051c3dc5f4e6d4de44a7af8bc96a43c99e51cf))

## [1.2.15](https://github.com/lukislp/claude-queue-platform/compare/v1.2.14...v1.2.15) (2026-09-11)


### Bug Fixes

* **ci:** push release commits as a deploy key so the default branch can be ruleset-protected ([6594b75](https://github.com/lukislp/claude-queue-platform/commit/6594b75dbd690fabc0fffd803141f6ed31aaa284))

## [1.2.14](https://github.com/lukislp/claude-queue-platform/compare/v1.2.13...v1.2.14) (2026-09-04)


### Bug Fixes

* **deps:** bump next from 16.3.2 to 16.3.4 in /apps/web ([40ffaa4](https://github.com/lukislp/claude-queue-platform/commit/40ffaa4cd36ad0ded044038db630d794201c5c05))

## [1.2.13](https://github.com/lukislp/claude-queue-platform/compare/v1.2.12...v1.2.13) (2026-09-04)


### Bug Fixes

* **deps:** bump @anthropic-ai/sdk from 0.120.0 to 0.123.0 in /apps/api ([bb69c07](https://github.com/lukislp/claude-queue-platform/commit/bb69c07e6865200415066f95b735fcb891b90973))
* **deps:** bump bullmq from 5.81.4 to 6.3.4 in /apps/api ([1fd3f31](https://github.com/lukislp/claude-queue-platform/commit/1fd3f31844d83ea59d252305b2479ee886a9561f))
* **deps:** bump eslint-config-next ([8f55a25](https://github.com/lukislp/claude-queue-platform/commit/8f55a25c5f920389981b6ebdf2c2c647519fdec2))
* **deps:** bump uuid from 10.0.0 to 14.0.2 in /apps/api ([48721a2](https://github.com/lukislp/claude-queue-platform/commit/48721a269632f58525dfe9071ac5a4fd7d8b4f59))

## [1.2.12](https://github.com/lukislp/claude-queue-platform/compare/v1.2.11...v1.2.12) (2026-09-04)


### Bug Fixes

* **ci:** ignore typescript major bumps in Dependabot ([f1b0043](https://github.com/lukislp/claude-queue-platform/commit/f1b004382150a8b9cea3b6218ec6e18c5a6d26c7))

## [1.2.11](https://github.com/lukislp/claude-queue-platform/compare/v1.2.10...v1.2.11) (2026-09-04)


### Bug Fixes

* **deps:** upgrade apps/api to NestJS 12 ([1f286b5](https://github.com/lukislp/claude-queue-platform/commit/1f286b51c4c9603a4c09a7bf8244e5ccc4544d6d))

## [1.2.10](https://github.com/lukislp/claude-queue-platform/compare/v1.2.9...v1.2.10) (2026-09-04)


### Bug Fixes

* **ci:** bump Node to 24 to unblock the NestJS 12 ESM requirement ([c7ca110](https://github.com/lukislp/claude-queue-platform/commit/c7ca110096ea2cc3013f11eb9176176f7bd18424))

## [1.2.9](https://github.com/lukislp/claude-queue-platform/compare/v1.2.8...v1.2.9) (2026-09-04)


### Bug Fixes

* **deps:** bump ioredis from 5.11.1 to 6.0.0 in /apps/api ([4cdee11](https://github.com/lukislp/claude-queue-platform/commit/4cdee11dcc3cf7d1f3efb2e502720e5f7c93beea))

## [1.2.8](https://github.com/lukislp/claude-queue-platform/compare/v1.2.7...v1.2.8) (2026-09-04)


### Bug Fixes

* **deps:** use the built-in fetch in the agent ([b0abd8d](https://github.com/lukislp/claude-queue-platform/commit/b0abd8d91ff7a7dff3130e249be47853e9f595eb))
* **deps:** use the built-in fetch in the agent ([aa16be7](https://github.com/lukislp/claude-queue-platform/commit/aa16be734571c4c686e0227d56a2fe8aba80cf30))

## [1.2.7](https://github.com/lukislp/claude-queue-platform/compare/v1.2.6...v1.2.7) (2026-09-04)


### Bug Fixes

* **deps:** bump bcryptjs and @types/bcryptjs in /apps/api ([de9533a](https://github.com/lukislp/claude-queue-platform/commit/de9533a7566adb1600ac642dfe25b44e4e87ad22))

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
