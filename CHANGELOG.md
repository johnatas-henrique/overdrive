# Changelog

## [0.5.0](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.4.1...overdrive-v0.5.0) (2026-06-30)


### Features

* **asset-manager:** add AssetManager with two-scene architecture (TR-AM-001–004) ([8001681](https://github.com/johnatas-henrique/overdrive/commit/80016817b4ba48b040a08517162666dc7ec44377))
* **asset-manager:** add car manifest IDs config for preload pipeline ([2d02435](https://github.com/johnatas-henrique/overdrive/commit/2d02435f3a502f2044be6ec3a0a8d9cdced9f0c7))
* **asset-manager:** add GSM orchestration with lifecycle handlers ([fa1daa0](https://github.com/johnatas-henrique/overdrive/commit/fa1daa0a58b9cc6e03326485964151848c70c9c8))
* **asset-manager:** add lifecycle methods (unloadAll, dispose, disposeContainer) ([6518530](https://github.com/johnatas-henrique/overdrive/commit/6518530b21d8cbf7edfdafc86e34afe360812672))
* **asset-manager:** add loading events to EventMap and AssetManager ([295ec0a](https://github.com/johnatas-henrique/overdrive/commit/295ec0a26fc108b591b677281a883fa26f32a504))
* **asset-manager:** add preload with concurrent loading and _loadToCache refactor ([09651ed](https://github.com/johnatas-henrique/overdrive/commit/09651ed1bc5feeec1327506cacbde7331885f29c))
* **asset-manager:** complete Asset Manager epic — 6 stories, 28 commits ([92aece8](https://github.com/johnatas-henrique/overdrive/commit/92aece8e891c3fff3334d70c8e3162c735e78749))
* **asset-manager:** implement load/cache with registerManifest, load, and get ([a3e2c80](https://github.com/johnatas-henrique/overdrive/commit/a3e2c809ce2a0303769cf1076636b23d6fe89c8e))
* **input:** complete Input system — 7 stories, 22 files, 6247 lines ([f0bac70](https://github.com/johnatas-henrique/overdrive/commit/f0bac7089820061d8b7e21775cc62a5b2f27d2a2))
* **input:** dead zone formula (TR-INP-003) ([bdc3c5a](https://github.com/johnatas-henrique/overdrive/commit/bdc3c5a3b0e5eace35eff7ad03e7ed806b32d898))
* **input:** debounce + digital edge cases (TR-INP-007) ([95d7cbf](https://github.com/johnatas-henrique/overdrive/commit/95d7cbf97b707029d2de5f7d6668952456ee0833))
* **input:** device detection + onDeviceChanged observable (TR-INP-008) ([a3bdf25](https://github.com/johnatas-henrique/overdrive/commit/a3bdf252b910461b29db72dc848234bf40c81e53))
* **input:** gsm state integration + pulse routing (TR-INP-006) ([3f9be3a](https://github.com/johnatas-henrique/overdrive/commit/3f9be3a26ec2d3a94b6b6a094f482eae07061d02))
* **input:** iinput interface + inputstate type definitions (TR-INP-001) ([9038ac3](https://github.com/johnatas-henrique/overdrive/commit/9038ac35996868b553fc85ff98e364250a013279))
* **input:** player input keyboard + gamepad polling (TR-INP-002, TR-INP-004) ([561575b](https://github.com/johnatas-henrique/overdrive/commit/561575b6d978534283f2ac819c86537301e4176b))
* **input:** tab blur safety + gamepad disconnect handling (TR-INP-005, TR-INP-009) ([af3e9a9](https://github.com/johnatas-henrique/overdrive/commit/af3e9a93edad06a61d71fe63d0fe28d38b81f919))


### Bug Fixes

* **asset-manager:** resolve review findings G1-G4, CR13 ([e144bd3](https://github.com/johnatas-henrique/overdrive/commit/e144bd32e80337e989dc0768d2a3a837fcf050e0))
* **asset-manager:** resolve TD1/TD2/TD3/TD5 and remove _addAllToScene tests ([295973d](https://github.com/johnatas-henrique/overdrive/commit/295973dc457454a19b6e001ae61da2937f7fa140))
* **asset-manager:** unify EventMap payload, clear pending loads, prevent scene duplication ([c685fcd](https://github.com/johnatas-henrique/overdrive/commit/c685fcddc25888821ebc76473e5620dd26301159))
* **input:** pr review fixes — optional chain, drift overwrite, jsdoc ([f3cc823](https://github.com/johnatas-henrique/overdrive/commit/f3cc823754fcce45cb7856a6d063f0500b8fec80))

## [0.4.1](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.4.0...overdrive-v0.4.1) (2026-06-29)


### Bug Fixes

* PR review — jsdoc, type assertions, and FIFO eviction ([7d22446](https://github.com/johnatas-henrique/overdrive/commit/7d224460a80cad0f2311afc077920e5f7737ea30))
* remove dead code in persistence and config-tree ([9bede1d](https://github.com/johnatas-henrique/overdrive/commit/9bede1d695ff7fcc9a277f66aeec6caa8a7b008e))

## [0.4.0](https://github.com/johnatas-henrique/overdrive/compare/overdrive-v0.3.0...overdrive-v0.4.0) (2026-06-29)


### Features

* **dev-tools:** add _resetdevtoolsfortesting singleton reset ([e3400f5](https://github.com/johnatas-henrique/overdrive/commit/e3400f5a67cbbb71c9f8a3e90132f22a7575351f))
* **dev-tools:** add AiTelemetryPanel implementation ([f235593](https://github.com/johnatas-henrique/overdrive/commit/f235593928893e885ec58c2b77204d5d1101ccfa))
* **dev-tools:** add GSM Visualizer panel ([28e437f](https://github.com/johnatas-henrique/overdrive/commit/28e437f5a1df0bfd399dad0e5f48f34f190e1663))
* **dev-tools:** config tree panel, setRuntime, and DevTools integration ([bd61abf](https://github.com/johnatas-henrique/overdrive/commit/bd61abf095893bb2c2f08f9312be24ecfafffefc))
* **dev-tools:** css variables and stylesheet ([8bb018a](https://github.com/johnatas-henrique/overdrive/commit/8bb018aedb34f5cbcd78d0ac62e803fafc44b1c9))
* **dev-tools:** event bus inspector with tab system and app wiring ([d623009](https://github.com/johnatas-henrique/overdrive/commit/d6230094eeabf46da555d5d6f788493eb0ac3286))
* **dev-tools:** implement Dev Compile Guard with import.meta.env.DEV ([daf8084](https://github.com/johnatas-henrique/overdrive/commit/daf808420dd136cba33c20fd8521e31bac7f31b5))
* **dev-tools:** integrate GSM Visualizer into overlay ([ceaa562](https://github.com/johnatas-henrique/overdrive/commit/ceaa5621a2d259f515c378bb69cdee76e2a267d6))
* **dev-tools:** keybinds, showNotification, singleton wiring ([9dc28ad](https://github.com/johnatas-henrique/overdrive/commit/9dc28add5bbe3daec8b9a501f6301a35b1cf5585))
* **dev-tools:** replace inline styles with CSS classes ([6dd6453](https://github.com/johnatas-henrique/overdrive/commit/6dd6453fe610851aa2a8224eba78ccbc213db55f))
* **dev-tools:** singleton proxy with DEV guard ([e4f3028](https://github.com/johnatas-henrique/overdrive/commit/e4f30287a9bf4061a8146a5288e87074f133b8f2))
* **dev-tools:** types, config, and core overlay implementation ([15bce5b](https://github.com/johnatas-henrique/overdrive/commit/15bce5b22ffbe16bd124b0cf7f3d8d5ffcce7809))
* **event-bus:** add getSubscriptions() and wildcard subscription support ([c0f62fa](https://github.com/johnatas-henrique/overdrive/commit/c0f62fab89cd6ba50c4837929737a00d6b6a55d5))
* **event-bus:** add race.started event + off(event) overload ([6a680f6](https://github.com/johnatas-henrique/overdrive/commit/6a680f67ea7813bed98ffbabd9975c4a50c8e6f2))
* **foundation:** add SimulationSnapshot API + assertDefined utility ([3545db4](https://github.com/johnatas-henrique/overdrive/commit/3545db4512c94e675b76992aaf501c247c165061))
* **playground:** add AI telemetry mock data ([bb66e93](https://github.com/johnatas-henrique/overdrive/commit/bb66e933f735182f32e50c5a59d8ffc2e5e5fd95))
* **sprint-02:** tech debt cleanup, telemetry recorder, and dev tools ([7cf3d88](https://github.com/johnatas-henrique/overdrive/commit/7cf3d884b49be91e3d183e1441218c9796fdab6b))
* **telemetry:** add console summary log with isRecording gate ([d7caa45](https://github.com/johnatas-henrique/overdrive/commit/d7caa4544ccf2f0ad9ccafb7de969eb499e97663))
* **telemetry:** add init() with Event Bus lifecycle subscriptions ([4847054](https://github.com/johnatas-henrique/overdrive/commit/48470541b1fe6d35a0ecb672da0a30f290fc1fae))
* **telemetry:** add JSON export with window.__telemetry surface ([50fac98](https://github.com/johnatas-henrique/overdrive/commit/50fac98fb283b781444d7ba650dd6324b81a3ca5))
* **telemetry:** add sampling loop and CarEntityRef ([becd047](https://github.com/johnatas-henrique/overdrive/commit/becd0471169f3566eaf6333b8c0b6a929ac807f8))
* **telemetry:** data model and storage ([7ae1194](https://github.com/johnatas-henrique/overdrive/commit/7ae119436348279034142ae5a413e5ee823287c7))


### Bug Fixes

* **app:** d-013 move eventbus before createmainscene ([224290a](https://github.com/johnatas-henrique/overdrive/commit/224290ac9f1c778541b4e64eba97dc079f846843))
* dead code removal for coverage improvement ([52c0bab](https://github.com/johnatas-henrique/overdrive/commit/52c0bab88666b9e69dda53caab2bbe95729c60ef))
* **dev-infra:** t-001 subscription refs and t-002 validation ([bc0e7d9](https://github.com/johnatas-henrique/overdrive/commit/bc0e7d945a747b3d206b09ab9bb000e6a39bf7ff))
* **dev-tools:** add singleton reset function for test optimization ([72ab759](https://github.com/johnatas-henrique/overdrive/commit/72ab759d60b04ba48b84775a3994d84067967caf))
* **dev-tools:** css fixes, gsm visualizer coverage, and playground wiring ([e6f36ee](https://github.com/johnatas-henrique/overdrive/commit/e6f36ee81ec2932f2aaf9cc52ee55460ab211929))
* **dev-tools:** keybind header and pointer-events CSS ([0b336ce](https://github.com/johnatas-henrique/overdrive/commit/0b336ce38b343644276814d6c9b48b282f20b87d))
* **dev-tools:** pr [#15](https://github.com/johnatas-henrique/overdrive/issues/15) review — overlay, inspector, visualizer fixes ([1c14464](https://github.com/johnatas-henrique/overdrive/commit/1c144642cb77e880ad5f57a61966c8d3d0e26c42))
* **dev-tools:** pr [#15](https://github.com/johnatas-henrique/overdrive/issues/15) review — snapshot, types, css fixes ([ba34260](https://github.com/johnatas-henrique/overdrive/commit/ba342605e53ff29ea5383c591d07cc65e1e30f8b))
* **dev-tools:** pr [#15](https://github.com/johnatas-henrique/overdrive/issues/15) review fixes and css tab switching bug ([f9611c1](https://github.com/johnatas-henrique/overdrive/commit/f9611c12cc6435585157b0cc738e31fbdf787ea5))
* **foundation:** pr [#15](https://github.com/johnatas-henrique/overdrive/issues/15) review — persistence and config fixes ([fe16a5f](https://github.com/johnatas-henrique/overdrive/commit/fe16a5ff298ccafd2d60fa5084eef8daf2ee0dba))
* **foundation:** pr [#15](https://github.com/johnatas-henrique/overdrive/issues/15) review fixes ([d0ca92c](https://github.com/johnatas-henrique/overdrive/commit/d0ca92c095e282ecc9e601237b85dc6fe8911944))
* **foundation:** resolve 4 CRITICALs + 5 WARNINGs across Foundation systems ([77a2527](https://github.com/johnatas-henrique/overdrive/commit/77a2527f42c3adc227e0169947f876022e699f8c))
* **telemetry:** recorder updates and event-bus test cleanup ([4529925](https://github.com/johnatas-henrique/overdrive/commit/4529925fd356aa0c4524aa93eb61c7d1dc63481b))
* **test:** suppress stderr in null canvas container test ([7f498cd](https://github.com/johnatas-henrique/overdrive/commit/7f498cd69d039da31bfb09f771335cf2bf6e0fc1))

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
