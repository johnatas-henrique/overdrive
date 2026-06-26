# Changelog

## [0.3.0](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.2.0...overdrive-v0.3.0) (2026-06-26)


### Features

* **config:** add access logging, getDebugState, setLogAllAccess ([2ff4d29](https://github.com/johnatas-henrique/overdrive/commit/2ff4d294ec730819c8b37791dfb4c25eba9cf7da))
* **config:** add env var override to ConfigManager ([f6a9b0f](https://github.com/johnatas-henrique/overdrive/commit/f6a9b0fbd5d739fb308388e1ef5032330357c7bc))
* **config:** add HMR Vite wiring (wireConfigHmr) ([a439287](https://github.com/johnatas-henrique/overdrive/commit/a43928701afa71a7171d89fb27519d94c4b29cdd))
* **config:** add invalidateNamespace with raw/resolved cache ([864fcfa](https://github.com/johnatas-henrique/overdrive/commit/864fcfae67d831a626ae595bd41645d49e2e42e5))
* **config:** implement ConfigManager core with init guard ([3549e67](https://github.com/johnatas-henrique/overdrive/commit/3549e6722cf4ce3d0b84087e210ecfc1e9d1c808))
* **determinism:** accumulator — fixed timestep, spiral-of-death protection ([3360c01](https://github.com/johnatas-henrique/overdrive/commit/3360c019fbdc27fb82332ae8a1c9188a68d67819))
* **determinism:** dev-guard — determinism enforcement, tree-shakeable ([80086c8](https://github.com/johnatas-henrique/overdrive/commit/80086c8350e9eec1ac48f8814cb9a048d3342ddb))
* **determinism:** fixed-update-pipeline — 8-slot FSM, error isolation ([7d3e5c3](https://github.com/johnatas-henrique/overdrive/commit/7d3e5c3735f5a544c977130acc9b959da18d39fb))
* **determinism:** input-buffer — double-buffer pattern, InputState ([a316da7](https://github.com/johnatas-henrique/overdrive/commit/a316da7a33774d8ddd397dce288d76b3c728f87d))
* **determinism:** pipeline-runtime — engine integration, Havok suppression ([3eb2769](https://github.com/johnatas-henrique/overdrive/commit/3eb27697589570747107e3c48ecdaf34d0a8f4b8))
* **determinism:** seeded-random LCG — Numerical Recipes constants ([161be5a](https://github.com/johnatas-henrique/overdrive/commit/161be5ad9437c0de8ee74ab821d330e58a116d34))
* **event-bus:** core event bus — runtime implementation ([cac46e0](https://github.com/johnatas-henrique/overdrive/commit/cac46e091efc4a6035c537eb5856341952fea431))
* **event-bus:** edge cases — once, circular emit, leak detection ([15dcd9f](https://github.com/johnatas-henrique/overdrive/commit/15dcd9f22c910b50a949043c83fd9adf55df9696))
* **event-bus:** event types and contracts — types, errors, barrel export ([754ac0d](https://github.com/johnatas-henrique/overdrive/commit/754ac0d7cea691b0e74ab45f55e5f7f68789d2c7))
* **gsm:** core FSM — State type, error, transition table ([480137b](https://github.com/johnatas-henrique/overdrive/commit/480137ba036b22273bf4177bedffb28e87ba6f3d))
* **gsm:** dispose safety — complete cleanup, mid-transition abort ([884086d](https://github.com/johnatas-henrique/overdrive/commit/884086d980f16b6a5d81c44744e71807c5443beb))
* **gsm:** event bus integration — emit exited/entered on transition ([1fa6b99](https://github.com/johnatas-henrique/overdrive/commit/1fa6b9994a3454960437c166c103fa9dd71fd788))
* **gsm:** game state machine — flat FSM with transition table ([ad371b3](https://github.com/johnatas-henrique/overdrive/commit/ad371b338fd6409ab0ec41a316004def49dd21c7))
* **gsm:** lifecycle hooks — onEnter/onExit with async rollback ([f742253](https://github.com/johnatas-henrique/overdrive/commit/f742253ccfcabb5656ac76ec7abed66111322da0))
* **gsm:** state history ring buffer — TransitionRecord, getHistory ([9c1d8b4](https://github.com/johnatas-henrique/overdrive/commit/9c1d8b45297aa12192d2e86ff7e96d33cc8f08bd))
* **gsm:** transition throttling — tick(), queue, dispose ([938ba9a](https://github.com/johnatas-henrique/overdrive/commit/938ba9a971c64d26a1bec19aa6db092527e21e56))
* **persistence:** degraded mode — write queue, FIFO, retry flush ([f954ede](https://github.com/johnatas-henrique/overdrive/commit/f954ede1d9e657dfdac8f44f09ec06f02831aa56))
* **persistence:** error isolation — console.warn for corrupted data, save serialization failure ([bd3b08e](https://github.com/johnatas-henrique/overdrive/commit/bd3b08e95032cdf4a3f569b92e3a26fba6906eb4))
* **persistence:** migration chain — registerMigration, _runMigrations, MigrationError ([2aad09d](https://github.com/johnatas-henrique/overdrive/commit/2aad09d02f34a95aef962664914d7e8995b1a945))
* **persistence:** save/load/delete — PersistedEntry, key prefix, error isolation ([33a3652](https://github.com/johnatas-henrique/overdrive/commit/33a36525c83f88c73a6eb6cd69f258b1ce55d0b0))
* **persistence:** state-machine + init — probe, async-first, degraded mode ([19e7be7](https://github.com/johnatas-henrique/overdrive/commit/19e7be7e6b51bb03f88531d54de699ad1704b39f))
* **snapshot:** error isolation — duplicate guard + deserialize try/catch ([12d5f5d](https://github.com/johnatas-henrique/overdrive/commit/12d5f5d71a84a9a5c830b19cafbd78ffc60a1aa7))
* **snapshot:** isnapshotable interface + fnv1a 64-bit hashing ([6bd3702](https://github.com/johnatas-henrique/overdrive/commit/6bd3702618b10d920a3d5f26c9b0e0edc1a4b8d6))
* **snapshot:** orchestrator lifecycle — init, register, takeSnapshot, dispose ([c1bc805](https://github.com/johnatas-henrique/overdrive/commit/c1bc8059c6917764cf2bb60fdc2c2dfa6fbdd69a))
* **snapshot:** sha-256 hashing + restoreSnapshot — two-tier determinism ([6c049ed](https://github.com/johnatas-henrique/overdrive/commit/6c049ed46d30e6bd39ba521d55efbd53a3cd054e))
* Sprint 1 — Foundation layer complete ([e129288](https://github.com/johnatas-henrique/overdrive/commit/e129288dc79bb9b85a064865faeb7ef431be462d))


### Bug Fixes

* **config,determinism:** crash guards for invalid config and seeds ([7058e07](https://github.com/johnatas-henrique/overdrive/commit/7058e07f87a6775cdfd1ca42ceed19d093c29b17))
* **foundation:** remove non-null assertions and dead code ([eacf9a0](https://github.com/johnatas-henrique/overdrive/commit/eacf9a0a74401fef1f772fa2390f6afb1aefc69f))

## [0.2.0](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.1.0...overdrive-v0.2.0) (2026-06-24)


### Features

* Technical Setup — architecture, epics/stories, UX specs, gate pass ([3807c1b](https://github.com/johnatas-henrique/overdrive/commit/3807c1bcb20f33e1c0a766527952eb73a0303bb8))


### Bug Fixes

* **art:** correct palette.json lastUpdated ([ad599f1](https://github.com/johnatas-henrique/overdrive/commit/ad599f1b70efd51c96210122ffd528778705e680))
* **ci:** update Node to 24 and remove empty FUNDING.yml ([f6476cf](https://github.com/johnatas-henrique/overdrive/commit/f6476cf272d2f3b1bd4af23f9ff76cc2a0fdcabb))
* **config:** add node: protocol to builtin imports ([6f730bd](https://github.com/johnatas-henrique/overdrive/commit/6f730bd6ad3155a086dcafdde69c5e9c0f62e53c))

## [0.1.0](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.0.1...overdrive-v0.1.0) (2026-06-21)


### Features

* **design:** add game concept document ([00cde89](https://github.com/johnatas-henrique/overdrive/commit/00cde89eeb8745df9910270aedf95ea4ae3ae042))
* **docs:** add 4PGP visual reference images ([7bb52a4](https://github.com/johnatas-henrique/overdrive/commit/7bb52a4501d110c312156dd6c08ba3aba6e281cb))
* **docs:** add art bible, palette, anchor prompt, and car references ([71e9665](https://github.com/johnatas-henrique/overdrive/commit/71e966506cdde8c602b418eac7e84576532f285c))
* **docs:** add final HUD layout ([1ceac03](https://github.com/johnatas-henrique/overdrive/commit/1ceac030a7f70155ddf180c46aed357e02672312))
* **docs:** add Horizon Chase visual reference image ([9252584](https://github.com/johnatas-henrique/overdrive/commit/9252584005c40ed77e5ca940a86b89e641b9ba53))
* **docs:** add systems index with 31 systems, 3 tiers, 5 build phases ([eade304](https://github.com/johnatas-henrique/overdrive/commit/eade3041bb65e01d089f18bb21e15bef129fc139))
* **gdd:** alpha stubs — Full Menu, Paddock 3D Hub ([6f924fd](https://github.com/johnatas-henrique/overdrive/commit/6f924fd112adde39f151eb33cd100399e7a69eac))
* **gdd:** core racing — Physics/Handling, Collision, Camera, Input ([33dc556](https://github.com/johnatas-henrique/overdrive/commit/33dc5564a5460ff6321c9c04e8623100b5e6cdaa))
* **gdd:** foundation boot — Data & Config, Event Bus, GSM, Persistence ([a46a40f](https://github.com/johnatas-henrique/overdrive/commit/a46a40f701f2fb04fcf2a0035c211b4b95aaa69d))
* **gdd:** player experience — Audio, HUD, Menu LITE, Telemetry Recorder ([6b9f53f](https://github.com/johnatas-henrique/overdrive/commit/6b9f53ff7282be0db6c6354e0700d3ae602caa10))
* **gdd:** race systems — Asset Manager, AI Driver, Pit Stop, Race Management ([6baf70b](https://github.com/johnatas-henrique/overdrive/commit/6baf70bac82f90322a2690da04c2210c7ba64bc7))
* **gdd:** runtime integrity — Entity lifecycle, Determinism, Snapshot, Dev Tools ([4ab77b6](https://github.com/johnatas-henrique/overdrive/commit/4ab77b68dd1adfc791343a5be2fdeea345330861))
* **gdd:** strategy resources — Track/Environment, Fuel, Tire Wear ([6c188be](https://github.com/johnatas-henrique/overdrive/commit/6c188beccdfb8239f4fc998b1e1b33cb15426b89))
* **hud:** final zone-based HUD layout ([e5cca06](https://github.com/johnatas-henrique/overdrive/commit/e5cca06466566c7f560b279db8595332f83d8aa9))
* **scaffold:** add build and project config files ([ea81c5b](https://github.com/johnatas-henrique/overdrive/commit/ea81c5b5869cc7e1dc23b4a6fcfab59809d68d83))
* **scaffold:** add core bootstrap and template config ([20ae850](https://github.com/johnatas-henrique/overdrive/commit/20ae8505aecc8acfd7996a6e95eb6fa1083d3442))
* **scaffold:** add playground scene and GUI ([073f28b](https://github.com/johnatas-henrique/overdrive/commit/073f28bb10a11faecd13e908b85c9cb619bd86f2))
* **tools:** add CORS proxy for Babylon.js GUI Editor MCP ([4ab1d86](https://github.com/johnatas-henrique/overdrive/commit/4ab1d86bf9717f00d5f011bc69bdb52e03d857d6))


### Bug Fixes

* **gdd:** add missing Race Management dependencies to systems-index ([2517092](https://github.com/johnatas-henrique/overdrive/commit/25170929a5bb75166b816c2aeb437ffe459c895c))
* **gdd:** remove AI Driver from Race Management dependencies ([f6938ba](https://github.com/johnatas-henrique/overdrive/commit/f6938ba9b838d17915630b6a834b58d718395ded))
* **gdd:** replace stale TrackConfig.maxFuel/trackAbrasion refs ([ccefb25](https://github.com/johnatas-henrique/overdrive/commit/ccefb25b220ab76461d8a59d4637c4f9f2131927))
