namespace Overdrive.Multiplayer
{
    /// <summary>
    /// Minimal placeholder for a remote player's network input in MVP. The Beta
    /// 14-byte transport layout (mapping the consumed 12-byte
    /// <c>SimulationInput</c> plus two bytes of network metadata) is NOT committed
    /// here per GDD multiplayer-architecture.md:88-102 — it is a Beta candidate.
    /// </summary>
    public struct NetworkInput
    {
        /// <summary>
        /// The simulation frame this input belongs to. Minimal placeholder field
        /// only; the Beta layout expands this struct.
        /// </summary>
        public uint SimulationFrame;
    }
}
