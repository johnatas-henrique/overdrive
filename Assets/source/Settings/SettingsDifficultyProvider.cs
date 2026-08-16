using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Settings
{
    /// <summary>
    /// Settings-backed adapter that supplies the persisted difficulty tier to the
    /// Kernel's GO-boundary replay capture (story 3-4, AC-D7).
    /// Decorates a base <see cref="IReplayInitialStateProvider"/> (the composition
    /// root's full race-configuration provider, owned elsewhere): it reads the
    /// persisted <c>Difficulty.Level</c> from the blob service, resolves the
    /// immutable profile through <see cref="IDifficultyProfileCatalog"/>, and
    /// fills <c>ReplayInitialStateCaptureInput.DifficultyProfile</c>.
    /// The current-race snapshot is immutable — a later Apply cannot mutate an
    /// already-captured <c>ReplayInitialState</c>.
    /// </summary>
    public sealed class SettingsDifficultyProvider : IReplayInitialStateProvider
    {
        private readonly IReplayInitialStateProvider _baseProvider;
        private readonly SettingsBlobService _blobService;
        private readonly IDifficultyProfileCatalog _catalog;

        /// <summary>
        /// Creates a provider decorating <paramref name="baseProvider"/>.
        /// </summary>
        /// <param name="baseProvider">Composition-root provider supplying the
        /// remaining race-configuration fields; may be a test fake.</param>
        /// <param name="blobService">Blob service that owns the persisted
        /// difficulty selection (write path: SettingsEditSession.Apply).</param>
        /// <param name="catalog">Difficulty catalog resolving tier → profile.</param>
        public SettingsDifficultyProvider(
            IReplayInitialStateProvider baseProvider,
            SettingsBlobService blobService,
            IDifficultyProfileCatalog catalog)
        {
            _baseProvider = baseProvider ?? throw new System.ArgumentNullException(nameof(baseProvider));
            _blobService = blobService ?? throw new System.ArgumentNullException(nameof(blobService));
            _catalog = catalog ?? throw new System.ArgumentNullException(nameof(catalog));
        }

        /// <inheritdoc/>
        public ReplayInitialStateCaptureInput GetCaptureInput()
        {
            ReplayInitialStateCaptureInput input = _baseProvider.GetCaptureInput();

            // The load cascade always resolves (primary -> backup -> factory defaults),
            // so the persisted difficulty is the effective selection at GO.
            GameSettingsData settings = _blobService.Load().Settings;
            DifficultyProfile profile = _catalog.GetProfile(settings.Difficulty.Level);
            input.DifficultyProfile = profile;
            return input;
        }
    }
}
