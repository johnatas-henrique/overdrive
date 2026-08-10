using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;

namespace Overdrive.Input.Tests
{
    /// <summary>Integration evidence for Story 004: the SimulationInput tick processor.</summary>
    [TestFixture]
    public sealed class TickProcessorTests
    {
        // ---- AC-7: render-rate-independent determinism -------------------------------

        [Test]
        public void AC7_RenderRateIndependentProcessingIsBitwiseIdentical()
        {
            // Sequência de 60 ticks (pares iguais para 30 FPS: 2 ticks/frame).
            var perTick = new List<RawInputSample>();
            for (int j = 0; j < 30; j++)
            {
                RawInputSample s = MakeVaryingSample(j);
                perTick.Add(s);
                perTick.Add(s);
            }

            // Varia pause edges e disponibilidade ao longo da sequência (edge cases do AC-7).
            var pausePerTick = new List<bool>(new bool[60]);
            pausePerTick[0] = true;  // pause edge no tick 0
            pausePerTick[30] = true; // novo edge no tick 30

            // Varia disponibilidade em dois pares completos (edge cases do AC-7).
            int[] noDevicePairs = { 5, 25 };
            foreach (int pair in noDevicePairs)
            {
                int first = 2 * pair;
                perTick[first] = MakeSample(0f, 0f, 0f, availability: InputAvailability.NoInputDevice);
                perTick[first + 1] = perTick[first]; // manter invariante do par (30 FPS reusa o 1º 2×)
            }

            // 30 FPS: 30 frames × 2 ticks — cada frame usa o 1º elemento do par (idêntico ao 2º).
            var frames30 = new List<(RawInputSample sample, int ticks)>();
            for (int j = 0; j < 30; j++)
            {
                frames30.Add((perTick[2 * j], 2));
            }

            // 144 FPS: a MESMA sequência perTick, agrupada em frames de 1/2/0 ticks.
            var frames144 = new List<(RawInputSample sample, int ticks)>();
            int t = 0;
            for (; t < 40; t++)
            {
                frames144.Add((perTick[t], 1));          // frames 0-39: ticks 0-39
            }

            frames144.Add((perTick[40], 2));             // frame 40: ticks 40-41 (mesmo par)
            t += 2;
            frames144.Add((MakeSample(0f, 0f, 0f), 0));  // frame 42: zero-tick (sample não consumido)
            for (; t < 60; t++)
            {
                frames144.Add((perTick[t], 1));          // frames 42-59: ticks 42-59
            }

            List<SimulationInput> out30 = RunSchedule(new TickProcessor(), frames30, pausePerTick);
            List<SimulationInput> out144 = RunSchedule(new TickProcessor(), frames144, pausePerTick);

            Assert.AreEqual(60, out30.Count);
            Assert.AreEqual(60, out144.Count);
            for (int i = 0; i < 60; i++)
            {
                AssertBitwiseIdentical(out30[i], out144[i], i);
            }
        }

        // ---- AC-22: non-finite raw sanitized to zero before EMA with rate-limited warning ----

        [Test]
        public void AC22_NonFiniteRawSanitizedToZeroBeforeEma()
        {
            var processor = new TickProcessor();
            var warnings = new List<(InputChannel, float)>();
            processor.InvalidInputWarning += (channel, value) => warnings.Add((channel, value));

            var nanSample = MakeSample(float.NaN, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);
            SimulationInput input = processor.ProcessTick(nanSample, pausePending: false);

            Assert.AreEqual(0f, input.AccelerateOut, "Accelerate EMA output must be 0 after NaN sanitization");
            Assert.AreEqual(0f, input.RawAcceleratePostDeadZone, "RawAcceleratePostDeadZone must be 0 (sanitized)");
            Assert.AreEqual(1, warnings.Count, "Exactly one warning on the first invalid tick");
            Assert.AreEqual(InputChannel.Accelerate, warnings[0].Item1);
            Assert.IsTrue(float.IsNaN(warnings[0].Item2), "Warning must carry the offending value");
        }

        [Test]
        public void AC22_WarningRateLimitedToOnePerSixtyTickWindow()
        {
            var processor = new TickProcessor();
            int warnings = 0;
            processor.InvalidInputWarning += (channel, value) => warnings++;

            var nanSample = MakeSample(float.NaN, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);
            for (int i = 0; i < 61; i++)
            {
                processor.ProcessTick(nanSample, pausePending: false);
            }

            Assert.AreEqual(2, warnings, "Warning fires on the first invalid tick of ticks 0-59 and 60-119");
        }

        [Test]
        public void AC22_ValidTickResetsWarningWindow()
        {
            var processor = new TickProcessor();
            int warnings = 0;
            processor.InvalidInputWarning += (channel, value) => warnings++;

            var nanSample = MakeSample(float.NaN, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);
            var validSample = MakeSample(0f, 0f, 0f);

            processor.ProcessTick(nanSample, pausePending: false);
            processor.ProcessTick(nanSample, pausePending: false);
            processor.ProcessTick(validSample, pausePending: false); // reset
            processor.ProcessTick(nanSample, pausePending: false);  // nova janela

            Assert.AreEqual(2, warnings, "A valid tick resets the 60-tick window");
        }

        [Test]
        public void AC22_PositiveAndNegativeInfinityWarnDistinctly()
        {
            var processor = new TickProcessor();
            var warnedChannels = new List<(InputChannel, float)>();
            processor.InvalidInputWarning += (channel, value) => warnedChannels.Add((channel, value));

            var infSample = MakeSample(float.PositiveInfinity, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);
            var negInfSample = MakeSample(float.NegativeInfinity, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);
            var validSample = MakeSample(0f, 0f, 0f);

            processor.ProcessTick(infSample, pausePending: false);
            processor.ProcessTick(validSample, pausePending: false); // reset a janela
            processor.ProcessTick(negInfSample, pausePending: false);

            Assert.AreEqual(2, warnedChannels.Count, "Each Infinity variant warns (distinct representation)");
            Assert.AreEqual(InputChannel.Accelerate, warnedChannels[0].Item1);
            Assert.IsTrue(float.IsPositiveInfinity(warnedChannels[0].Item2));
            Assert.IsTrue(float.IsNegativeInfinity(warnedChannels[1].Item2));
        }

        [Test]
        public void AC22_IndependentRateLimitPerChannel()
        {
            var processor = new TickProcessor();
            var warnings = new List<InputChannel>();
            processor.InvalidInputWarning += (channel, value) => warnings.Add(channel);

            var bothInvalid = MakeSample(float.NaN, float.NaN, 0f,
                validity: RawInputValidityFlags.AccelerateNonFinite | RawInputValidityFlags.BrakeNonFinite);

            processor.ProcessTick(bothInvalid, pausePending: false);
            processor.ProcessTick(bothInvalid, pausePending: false);
            processor.ProcessTick(bothInvalid, pausePending: false);

            Assert.AreEqual(2, warnings.Count, "One warning per invalid channel (accelerate + brake), rate-limited independently");
            Assert.Contains(InputChannel.Accelerate, warnings);
            Assert.Contains(InputChannel.Brake, warnings);
        }

        // ---- AC-28: Pause edge consumed exactly once ---------------------------------

        [Test]
        public void AC28_PauseEdgeConsumedExactlyOnce()
        {
            var processor = new TickProcessor();
            var sample = MakeSample(1f, 0f, 0f);

            SimulationInput tick1 = processor.ProcessTick(sample, pausePending: true);
            SimulationInput tick2 = processor.ProcessTick(sample, pausePending: false);
            SimulationInput tick3 = processor.ProcessTick(sample, pausePending: false);

            Assert.IsTrue(tick1.PauseEdge, "First tick consumes the pending edge");
            Assert.IsFalse(tick2.PauseEdge, "Subsequent ticks do not see the consumed edge");
            Assert.IsFalse(tick3.PauseEdge);
        }

        // ---- AC-34: multiple ticks reuse one raw sample, consume Pause once ----------

        [Test]
        public void AC34_TwoTicksReuseSampleAndConsumePauseOnce()
        {
            var processor = new TickProcessor();
            var sample = MakeSample(1f, 0f, 0f);

            SimulationInput tick1 = processor.ProcessTick(sample, pausePending: true);
            SimulationInput tick2 = processor.ProcessTick(sample, pausePending: false);

            Assert.AreEqual(0.3f, tick1.AccelerateOut, 1e-6f, "EMA α=0.3 from rest");
            Assert.AreEqual(0.51f, tick2.AccelerateOut, 1e-6f, "EMA advances once per tick");
            Assert.IsTrue(tick1.PauseEdge, "Pause true only on the first tick");
            Assert.IsFalse(tick2.PauseEdge);
        }

        [Test]
        public void AC34_ThreePlusTicksProduceExpectedValues()
        {
            var processor = new TickProcessor();
            var sample = MakeSample(1f, 0f, 0f);

            SimulationInput tick1 = processor.ProcessTick(sample, pausePending: true);
            SimulationInput tick2 = processor.ProcessTick(sample, pausePending: false);
            SimulationInput tick3 = processor.ProcessTick(sample, pausePending: false);
            SimulationInput tick4 = processor.ProcessTick(sample, pausePending: false);

            Assert.AreEqual(0.3f, tick1.AccelerateOut, 1e-6f);
            Assert.AreEqual(0.51f, tick2.AccelerateOut, 1e-6f);
            Assert.AreEqual(0.657f, tick3.AccelerateOut, 1e-6f);
            Assert.AreEqual(0.7599f, tick4.AccelerateOut, 1e-6f);
            Assert.IsTrue(tick1.PauseEdge, "Pause true only on the first tick");
            Assert.IsFalse(tick2.PauseEdge);
            Assert.IsFalse(tick3.PauseEdge);
            Assert.IsFalse(tick4.PauseEdge);
        }

        // ---- Contract edges -----------------------------------------------------------

        [Test]
        public void RawPostDeadZoneCarriesSanitizedDeadZonedValues()
        {
            var processor = new TickProcessor();
            // Gamepad: steer 0.55 com inner 0.15/outer 0.95 → magnitude normalizada 0.5.
            var sample = MakeSample(0.525f, 0f, 0.55f);

            SimulationInput input = processor.ProcessTick(sample, pausePending: false);

            Assert.AreEqual(0.5f, input.RawAcceleratePostDeadZone, 1e-4f, "Trigger 0.525 com inner 0.05 → 0.5");
            Assert.AreEqual(0.5f, input.RawSteerPostDeadZone, 1e-4f, "Stick 0.55 com inner 0.15/outer 0.95 → 0.5");
            Assert.AreEqual(0f, input.RawBrakePostDeadZone, 1e-4f);
        }

        [Test]
        public void KeyboardSchemeBypassesDeadZone()
        {
            var processor = new TickProcessor();
            var sample = MakeSample(1f, 0f, -1f, scheme: ControlScheme.KeyboardMouse);

            SimulationInput input = processor.ProcessTick(sample, pausePending: false);

            Assert.AreEqual(1f, input.RawAcceleratePostDeadZone, "Keyboard accelerates map directly (0/1)");
            Assert.AreEqual(-1f, input.RawSteerPostDeadZone, "Keyboard steer maps directly (-1/0/1)");
        }

        [Test]
        public void AC22_InvalidAfterEstablishedStateAdvancesFromSanitizedZero()
        {
            // Prove sanitization happens BEFORE the EMA: a NaN after an established 0.3 must
            // advance the EMA from the sanitized 0.0 (→ 0.21), NOT retain the last valid 0.3.
            var processor = new TickProcessor();
            int warnings = 0;
            processor.InvalidInputWarning += (channel, value) => warnings++;

            var valid = MakeSample(1f, 0f, 0f);
            var nanSample = MakeSample(float.NaN, 0f, 0f, validity: RawInputValidityFlags.AccelerateNonFinite);

            SimulationInput t1 = processor.ProcessTick(valid, pausePending: false);
            SimulationInput t2 = processor.ProcessTick(nanSample, pausePending: false);

            Assert.AreEqual(0.3f, t1.AccelerateOut, 1e-6f);
            Assert.AreEqual(0.21f, t2.AccelerateOut, 1e-6f, "EMA advances from sanitized 0, not last-valid 0.3");
            Assert.AreEqual(0f, t2.RawAcceleratePostDeadZone);
            Assert.AreEqual(1, warnings);
        }

        [Test]
        public void AC22_NonFiniteBrakeAndSteerSanitizedWithWarning()
        {
            var processor = new TickProcessor();
            var warnedChannels = new List<InputChannel>();
            processor.InvalidInputWarning += (channel, value) => warnedChannels.Add(channel);

            var brakeNaN = MakeSample(0f, float.NaN, 0f, validity: RawInputValidityFlags.BrakeNonFinite);
            var steerInf = MakeSample(0f, 0f, float.PositiveInfinity, validity: RawInputValidityFlags.SteerNonFinite);

            SimulationInput brakeOut = processor.ProcessTick(brakeNaN, pausePending: false);
            SimulationInput steerOut = processor.ProcessTick(steerInf, pausePending: false);

            Assert.AreEqual(0f, brakeOut.RawBrakePostDeadZone, "Non-finite brake sanitized to 0");
            Assert.AreEqual(0f, steerOut.RawSteerPostDeadZone, "Non-finite steer sanitized to 0");
            Assert.AreEqual(0f, brakeOut.BrakeOut, "Brake EMA output is 0 from sanitized 0");
            Assert.AreEqual(0f, steerOut.SteerOut, "Steer EMA output is 0 from sanitized 0");
            Assert.Contains(InputChannel.Brake, warnedChannels);
            Assert.Contains(InputChannel.Steer, warnedChannels);
        }

        [Test]
        public void AC28_NewRiseAfterConsumptionProducesNewEdge()
        {
            // Coalescing and held-Pause latching live in the controller (Story 001/002); the tick
            // processor only propagates the caller-supplied pausePending one-shot per pending edge.
            var processor = new TickProcessor();
            var sample = MakeSample(1f, 0f, 0f);

            SimulationInput t1 = processor.ProcessTick(sample, pausePending: true);   // 1º pending → edge
            SimulationInput t2 = processor.ProcessTick(sample, pausePending: false);  // consumido → sem edge
            SimulationInput t3 = processor.ProcessTick(sample, pausePending: true);   // novo pending → novo edge
            SimulationInput t4 = processor.ProcessTick(sample, pausePending: false);  // consumido → sem edge

            Assert.IsTrue(t1.PauseEdge);
            Assert.IsFalse(t2.PauseEdge);
            Assert.IsTrue(t3.PauseEdge);
            Assert.IsFalse(t4.PauseEdge);
        }

        [Test]
        public void BrakePriorityFreezesThenResumesAccelerateEma()
        {
            // Brake priority freezes the Accelerate EMA at its pre-brake value and resumes from it
            // when raw Brake returns to zero (GDD :154, ADR-0005).
            var processor = new TickProcessor();
            var accelOnly = MakeSample(1f, 0f, 0f);
            var braking = MakeSample(1f, 1f, 0f);

            SimulationInput t1 = processor.ProcessTick(accelOnly, pausePending: false); // EMA 0.3
            SimulationInput t2 = processor.ProcessTick(braking, pausePending: false);   // brake > 0 → 0, frozen
            SimulationInput t3 = processor.ProcessTick(accelOnly, pausePending: false); // brake 0 → resume 0.51

            Assert.AreEqual(0.3f, t1.AccelerateOut, 1e-6f);
            Assert.AreEqual(0f, t2.AccelerateOut, "Brake priority zeroes accelerateOut");
            Assert.AreEqual(0.51f, t3.AccelerateOut, 1e-6f, "Accelerate EMA resumes from the frozen 0.3");
        }

        [Test]
        public void NoInputDeviceAvailabilityPropagates()
        {
            var processor = new TickProcessor();
            var sample = MakeSample(0f, 0f, 0f, availability: InputAvailability.NoInputDevice);

            SimulationInput input = processor.ProcessTick(sample, pausePending: false);

            Assert.AreEqual(InputAvailability.NoInputDevice, input.Availability);
        }

        // ---- Helpers ------------------------------------------------------------------

        private static List<SimulationInput> RunSchedule(
            TickProcessor processor,
            List<(RawInputSample sample, int ticks)> frames,
            List<bool> pausePerTick)
        {
            var outputs = new List<SimulationInput>();
            int tickIndex = 0;
            foreach ((RawInputSample sample, int ticks) in frames)
            {
                for (int t = 0; t < ticks; t++)
                {
                    outputs.Add(processor.ProcessTick(sample, pausePerTick[tickIndex]));
                    tickIndex++;
                }
            }

            return outputs;
        }

        private static RawInputSample MakeVaryingSample(int index)
        {
            float accelerate = index % 3 == 0 ? 1f : index % 3 == 1 ? 0.5f : 0f;
            float brake = index % 5 == 0 ? 0.8f : 0f;
            float steer = (index % 4 - 1.5f) / 1.5f; // -1..1
            return MakeSample(accelerate, brake, steer);
        }

        private static RawInputSample MakeSample(
            float accelerate, float brake, float steer,
            ControlScheme scheme = ControlScheme.Gamepad,
            RawInputValidityFlags validity = RawInputValidityFlags.None,
            InputAvailability availability = InputAvailability.Available,
            ulong seq = 0)
        {
            return new RawInputSample(seq, scheme, accelerate, brake, steer, availability, validity);
        }

        private static void AssertBitwiseIdentical(SimulationInput expected, SimulationInput actual, int tick)
        {
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.AccelerateOut), BitConverter.SingleToInt32Bits(actual.AccelerateOut), $"AccelerateOut bitwise mismatch at tick {tick}");
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.BrakeOut), BitConverter.SingleToInt32Bits(actual.BrakeOut), $"BrakeOut bitwise mismatch at tick {tick}");
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.SteerOut), BitConverter.SingleToInt32Bits(actual.SteerOut), $"SteerOut bitwise mismatch at tick {tick}");
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.RawAcceleratePostDeadZone), BitConverter.SingleToInt32Bits(actual.RawAcceleratePostDeadZone), $"RawAcceleratePostDeadZone bitwise mismatch at tick {tick}");
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.RawBrakePostDeadZone), BitConverter.SingleToInt32Bits(actual.RawBrakePostDeadZone), $"RawBrakePostDeadZone bitwise mismatch at tick {tick}");
            Assert.AreEqual(BitConverter.SingleToInt32Bits(expected.RawSteerPostDeadZone), BitConverter.SingleToInt32Bits(actual.RawSteerPostDeadZone), $"RawSteerPostDeadZone bitwise mismatch at tick {tick}");
            Assert.AreEqual(expected.PauseEdge, actual.PauseEdge, $"PauseEdge mismatch at tick {tick}");
            Assert.AreEqual(expected.Availability, actual.Availability, $"Availability mismatch at tick {tick}");
        }
    }
}
