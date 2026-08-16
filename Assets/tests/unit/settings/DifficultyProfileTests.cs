using System;
using NUnit.Framework;
using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Settings.Core.Tests
{
    /// <summary>
    /// Engine-free unit tests for the DifficultyProfile contract (story 3-4):
    /// struct expansion (6 immutable fields), the tier-range guard, and the
    /// IDifficultyProfileCatalog port contract. Balance values per tier are
    /// verified against the real assets in DifficultyProfileIntegrationTests.
    /// </summary>
    public class DifficultyProfileTests
    {
        [Test]
        public void SixArgConstructor_PopulatesAllSixFields()
        {
            var profile = new DifficultyProfile(3, 1.00f, 0.5f, 0.00f, 0.30f, 0.50f);

            Assert.That(profile.Level, Is.EqualTo(3), "Level must be the tier identifier.");
            Assert.That(profile.AiPrecision, Is.EqualTo(1.00f), "AiPrecision must carry through.");
            Assert.That(profile.AiErrorMultiplier, Is.EqualTo(0.5f), "AiErrorMultiplier must carry through.");
            Assert.That(profile.PaceNoise, Is.EqualTo(0.00f), "PaceNoise must carry through.");
            Assert.That(profile.PlayerOffTrackGrip, Is.EqualTo(0.30f), "PlayerOffTrackGrip must carry through.");
            Assert.That(profile.PlayerWallSpeedLoss, Is.EqualTo(0.50f), "PlayerWallSpeedLoss must carry through.");
        }

        [Test]
        public void LevelOnlyConstructor_ZeroesBalanceFields()
        {
            var profile = new DifficultyProfile(2);

            Assert.That(profile.Level, Is.EqualTo(2), "Level must be preserved.");
            Assert.That(profile.AiPrecision, Is.EqualTo(0f), "AiPrecision defaults to zero.");
            Assert.That(profile.AiErrorMultiplier, Is.EqualTo(0f), "AiErrorMultiplier defaults to zero.");
            Assert.That(profile.PaceNoise, Is.EqualTo(0f), "PaceNoise defaults to zero.");
            Assert.That(profile.PlayerOffTrackGrip, Is.EqualTo(0f), "PlayerOffTrackGrip defaults to zero.");
            Assert.That(profile.PlayerWallSpeedLoss, Is.EqualTo(0f), "PlayerWallSpeedLoss defaults to zero.");
        }

        [Test]
        public void LevelOnlyConstructor_DefaultParameter_IsZero()
        {
            var profile = new DifficultyProfile();

            Assert.That(profile.Level, Is.EqualTo(0), "Default level is Very Easy (0).");
        }

        [Test]
        public void ProfileFields_AreReadOnly()
        {
            var fields = typeof(DifficultyProfile).GetFields(System.Reflection.BindingFlags.Public
                | System.Reflection.BindingFlags.Instance);

            Assert.That(fields.Length, Is.EqualTo(6), "The struct exposes exactly six public instance fields.");
            foreach (var field in fields)
            {
                Assert.That(field.IsInitOnly, Is.True,
                    $"Field {field.Name} must be readonly — the profile is immutable per race (ADR-0004).");
            }
        }

        [Test]
        public void ValidateLevel_AcceptsMinAndMaxBoundaries()
        {
            Assert.DoesNotThrow(() => DifficultyProfileValidation.ValidateLevel(DifficultySelection.MinLevel));
            Assert.DoesNotThrow(() => DifficultyProfileValidation.ValidateLevel(DifficultySelection.MaxLevel));
        }

        [Test]
        public void ValidateLevel_RejectsBelowMin()
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => DifficultyProfileValidation.ValidateLevel(DifficultySelection.MinLevel - 1));
        }

        [Test]
        public void ValidateLevel_RejectsAboveMax()
        {
            Assert.Throws<ArgumentOutOfRangeException>(
                () => DifficultyProfileValidation.ValidateLevel(DifficultySelection.MaxLevel + 1));
        }

        [Test]
        public void ValidateLevel_IsAlignedWithDifficultySelectionDomain()
        {
            // The guard and the persisted selection must agree on the domain.
            for (int level = DifficultySelection.MinLevel; level <= DifficultySelection.MaxLevel; level++)
            {
                Assert.DoesNotThrow(() => DifficultyProfileValidation.ValidateLevel(level),
                    $"Level {level} within the approved range must validate.");
            }

            Assert.That(DifficultySelection.MaxLevel - DifficultySelection.MinLevel, Is.EqualTo(4),
                "The approved tier domain is exactly five levels (Very Easy..Very Hard).");
        }
    }
}
