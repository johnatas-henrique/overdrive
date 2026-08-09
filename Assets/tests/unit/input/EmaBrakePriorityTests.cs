using NUnit.Framework;
using Overdrive.Input;

namespace Overdrive.Input.Tests
{
    /// <summary>
    /// Unit tests for Story 003 — EMA &amp; Brake Priority. Pure C# recurrence; each test builds
    /// a fresh <see cref="EmaBrakePriority"/> so EMA state never leaks across tests.
    /// </summary>
    public class EmaBrakePriorityTests
    {
        [Test]
        public void AC1_FirstTickAccelerate030()
        {
            var p = new EmaBrakePriority();
            var o = p.Process(1f, 0f, 0f);
            Assert.AreEqual(0.3f, o.Accelerate, 1e-4f);
            Assert.AreEqual(0f, o.Brake, 1e-4f);
        }

        [Test]
        public void AC2_FirstTickSteerMinus050()
        {
            var p = new EmaBrakePriority();
            var o = p.Process(0f, 0f, -1f);
            Assert.AreEqual(-0.5f, o.Steer, 1e-4f);
        }

        [Test]
        public void AC3_SteerPositiveAndNonzeroPrev()
        {
            // Edge do QA spec para AC-3: steer positivo e prev não-zero (diferencia do AC-2).
            var p = new EmaBrakePriority();
            var first = p.Process(0f, 0f, 1f); // prev 0 → 0.5*1 + 0.5*0 = 0.5
            var second = p.Process(0f, 0f, 1f); // prev 0.5 → 0.5*1 + 0.5*0.5 = 0.75
            Assert.AreEqual(0.5f, first.Steer, 1e-4f);
            Assert.AreEqual(0.75f, second.Steer, 1e-4f);
        }

        [Test]
        public void AC5_BrakePrioritySuppressesAccelerate()
        {
            var p = new EmaBrakePriority();
            var o = p.Process(1f, 1f, 0f);
            Assert.AreEqual(0f, o.Accelerate);
            Assert.AreEqual(0.3f, o.Brake, 1e-4f);
        }

        [Test]
        public void AC6_FiveTickFixtureSequence()
        {
            float[] expected = { 0.3f, 0.51f, 0.657f, 0.7599f, 0.83193f };
            var p = new EmaBrakePriority();
            for (int i = 0; i < expected.Length; i++)
            {
                var o = p.Process(1f, 0f, 0f);
                Assert.AreEqual(expected[i], o.Accelerate, 1e-4f, $"tick {i + 1}");
            }
        }

        [Test]
        public void AC6_AccelerateReaches095AfterNineTicks()
        {
            var p = new EmaBrakePriority();
            EmaOutput o = default;
            for (int i = 0; i < 9; i++)
            {
                o = p.Process(1f, 0f, 0f);
            }

            Assert.GreaterOrEqual(o.Accelerate, 0.95f);
        }

        [Test]
        public void AC6_NeverExceedsOneOnAnyTick()
        {
            // QA spec: values never exceed 1.0 — verifica o limite superior em todos os ticks.
            var p = new EmaBrakePriority();
            for (int i = 0; i < 20; i++)
            {
                var o = p.Process(1f, 0f, 0f);
                Assert.LessOrEqual(o.Accelerate, 1f, $"tick {i + 1}");
            }
        }

    [Test]
    public void AC27_AlphaZeroRetainsPreviousValue()
    {
        // α=0: output é sempre o prev. Do rest (prev 0), o raw nunca entra — o output permanece 0
        // mesmo com raw variando (acelerate/steer com brake=0; brake com brake variando em instância
        // separada, pois brake não-zero ativaria a brake priority e mascararia o accelerate).
        // NOTA: a retenção de um prev NÃO-zero com α=0 exige um seam de inicialização que é da
        // story-006 (AC-41 InitializeFromPostDeadZone) — coberto lá, não aqui.
        var p = new EmaBrakePriority(0f, 0f, 0f);
        var first = p.Process(0.75f, 0f, -0.25f);
        var second = p.Process(0.25f, 0f, -1f);
        Assert.AreEqual(0f, first.Accelerate, 1e-4f);
        Assert.AreEqual(0f, first.Steer, 1e-4f);
        Assert.AreEqual(first.Accelerate, second.Accelerate, 1e-4f);
        Assert.AreEqual(first.Steer, second.Steer, 1e-4f);

        // Brake α=0 com brake variando, em instância separada (brake não-zero).
        var pb = new EmaBrakePriority(0f, 0f, 0f);
        Assert.AreEqual(0f, pb.Process(0f, 0.6f, 0f).Brake, 1e-4f);
        Assert.AreEqual(0f, pb.Process(0f, 0.2f, 0f).Brake, 1e-4f);
    }

        [Test]
        public void AC27_AlphaOneEqualsRawExactly()
        {
            var p = new EmaBrakePriority(1f, 1f, 1f);
            // brake 0 para não ativar a brake priority (que zeraria accelerateOut).
            var o = p.Process(0.75f, 0f, -0.25f);
            Assert.AreEqual(0.75f, o.Accelerate, 1e-4f);
            Assert.AreEqual(0f, o.Brake, 1e-4f); // brake raw 0 → EMA = 0
            Assert.AreEqual(-0.25f, o.Steer, 1e-4f);

            // Brake com α=1 e valor não-zero (separado: brake não-zero ativaria brake priority).
            var p2 = new EmaBrakePriority(1f, 1f, 1f);
            Assert.AreEqual(0.5f, p2.Process(0f, 0.5f, 0f).Brake, 1e-4f); // 1*0.5 + 0*0

            // α=1 descarta prev: segundo tick com raw diferente → output = raw2 (não mistura).
            var p3 = new EmaBrakePriority(1f, 1f, 1f);
            p3.Process(0.75f, 0f, 0f); // prev = 0.75
            Assert.AreEqual(0.25f, p3.Process(0.25f, 0f, 0f).Accelerate, 1e-4f); // 1*0.25 + 0*0.75

            // Brake/Steer α=1 descartam prev (instâncias separadas).
            var p4 = new EmaBrakePriority(1f, 1f, 1f);
            p4.Process(0f, 0.5f, 0f); // brake prev = 0.5
            Assert.AreEqual(0.2f, p4.Process(0f, 0.2f, 0f).Brake, 1e-4f); // 1*0.2 + 0*0.5
            var p5 = new EmaBrakePriority(1f, 1f, 1f);
            p5.Process(0f, 0f, 0.5f); // steer prev = 0.5
            Assert.AreEqual(0.2f, p5.Process(0f, 0f, 0.2f).Steer, 1e-4f); // 1*0.2 + 0*0.5
        }

        [Test]
        public void ConfigReady_NonDefaultAlphasControlRecurrence()
        {
            // Story 008 (Settings) passa alphas do control-profile — o construtor deve dirigir
            // a recorrência, não valores hardcoded. α_acc=0.5, α_steer=0.8 from rest.
            var p = new EmaBrakePriority(0.5f, 0.3f, 0.8f);
            var o = p.Process(1f, 0f, -1f);
            Assert.AreEqual(0.5f, o.Accelerate, 1e-4f); // 0.5*1 + 0.5*0
            Assert.AreEqual(-0.8f, o.Steer, 1e-4f); // 0.8*-1 + 0.2*0

            // Brake alpha não-default + brake não-zero: 0.7*1 + 0.3*0 = 0.7.
            var p2 = new EmaBrakePriority(0.3f, 0.7f, 0.5f);
            Assert.AreEqual(0.7f, p2.Process(0f, 1f, 0f).Brake, 1e-4f);
        }

    [Test]
    public void Reset_ClearsEmaState()
    {
        var p = new EmaBrakePriority();
        // Avança os 3 canais: accelerate (3 ticks 1.0), brake (1 tick 1.0), steer (1 tick 1.0).
        for (int i = 0; i < 3; i++)
        {
            p.Process(1f, 0f, 0f);
        }

        p.Process(0f, 1f, 1f);
        p.Reset();
        var o = p.Process(1f, 0f, 1f);
        // Reset → first tick from rest nos 3 canais; se brake/steer não fossem limpos,
        // os outputs seriam não-zero.
        Assert.AreEqual(0.3f, o.Accelerate, 1e-4f); // 0.3*1 + 0.7*0
        Assert.AreEqual(0f, o.Brake, 1e-4f); // 0.3*0 + 0.7*0
        Assert.AreEqual(0.5f, o.Steer, 1e-4f); // 0.5*1 + 0.5*0
    }

    [Test]
    public void AC71_SanitizationPrecedesEma()
    {
        // Provê que a sanitização roda ANTES do EMA nos 3 canais: com prev não-zero, NaN→0
        // e o EMA decai do prev, não vira 0 imediatamente (distingue de sanitizar depois).
        // Accelerate: prev 0.3, NaN → 0.3*0 + 0.7*0.3 = 0.21.
        var p = new EmaBrakePriority();
        p.Process(1f, 0f, 0f); // accelerate prev = 0.3
        Assert.AreEqual(0.21f, p.Process(float.NaN, 0f, 0f).Accelerate, 1e-4f);

        // Brake: prev 0.3, NaN → 0.21 (instância separada: brake não-zero ativaria priority).
        var pb = new EmaBrakePriority();
        pb.Process(0f, 1f, 0f); // brake prev = 0.3
        Assert.AreEqual(0.21f, pb.Process(0f, float.NaN, 0f).Brake, 1e-4f);

        // Steer: prev 0.5, NaN → 0.5*0 + 0.5*0.5 = 0.25.
        var ps = new EmaBrakePriority();
        ps.Process(0f, 0f, 1f); // steer prev = 0.5
        Assert.AreEqual(0.25f, ps.Process(0f, 0f, float.NaN).Steer, 1e-4f);

        // +Infinity (mesmo branch de NaN no Sanitize) também prova ordering com prev não-zero.
        var pi = new EmaBrakePriority();
        pi.Process(1f, 0f, 0f); // accelerate prev = 0.3
        Assert.AreEqual(0.21f, pi.Process(float.PositiveInfinity, 0f, 0f).Accelerate, 1e-4f);
        var pbi = new EmaBrakePriority();
        pbi.Process(0f, 1f, 0f); // brake prev = 0.3
        Assert.AreEqual(0.21f, pbi.Process(0f, float.PositiveInfinity, 0f).Brake, 1e-4f);
        var psi = new EmaBrakePriority();
        psi.Process(0f, 0f, 1f); // steer prev = 0.5
        Assert.AreEqual(0.25f, psi.Process(0f, 0f, float.PositiveInfinity).Steer, 1e-4f);

        // -Infinity (mesmo branch de NaN/±Inf) com prev não-zero.
        var pni = new EmaBrakePriority();
        pni.Process(1f, 0f, 0f); // accelerate prev = 0.3
        Assert.AreEqual(0.21f, pni.Process(float.NegativeInfinity, 0f, 0f).Accelerate, 1e-4f);
        var pbni = new EmaBrakePriority();
        pbni.Process(0f, 1f, 0f); // brake prev = 0.3
        Assert.AreEqual(0.21f, pbni.Process(0f, float.NegativeInfinity, 0f).Brake, 1e-4f);
        var psni = new EmaBrakePriority();
        psni.Process(0f, 0f, 1f); // steer prev = 0.5
        Assert.AreEqual(0.25f, psni.Process(0f, 0f, float.NegativeInfinity).Steer, 1e-4f);
    }

        [Test]
        public void AC31_AccelerateNotSuppressedWhenBrakeZero()
        {
            var p = new EmaBrakePriority();
            var o = p.Process(1f, 0f, 0f);
            // filtered Accelerate para este tick = EMA result (0.3).
            Assert.AreEqual(0.3f, o.Accelerate, 1e-4f);
            Assert.AreEqual(0f, o.Brake, 1e-4f); // brake raw 0 → EMA exatamente 0
        }

        [Test]
        public void AC38_BrakeImmediatelySuppressesSteadyStateAccelerate()
        {
            var p = new EmaBrakePriority();
            for (int i = 0; i < 9; i++)
            {
                p.Process(1f, 0f, 0f); // steady-state: 0.95+
            }

            var o = p.Process(1f, 1f, 0f); // brake sobe acima do threshold
            Assert.AreEqual(0f, o.Accelerate);
            Assert.AreEqual(0.3f, o.Brake, 1e-4f);
        }

        [Test]
        public void AC38_BrakeJustAboveThresholdSuppresses()
        {
            // Edge do QA spec: brake logo acima do threshold (0 pós dead-zone) → suprime.
            var p = new EmaBrakePriority();
            for (int i = 0; i < 9; i++)
            {
                p.Process(1f, 0f, 0f); // steady-state
            }

            var o = p.Process(1f, 0.0001f, 0f);
            Assert.AreEqual(0f, o.Accelerate); // brake > 0 → suprime
            Assert.AreEqual(0.00003f, o.Brake, 1e-6f); // 0.3*0.0001 = 0.00003
        }

        [Test]
        public void AC42_AccelerateResumesFromFrozenPreBrakeValue()
        {
            var p = new EmaBrakePriority();
            for (int i = 0; i < 3; i++)
            {
                p.Process(1f, 0f, 0f); // prev = 0.657
            }

            // Brake priority ativo 2 ticks: accelerateOut = 0; prev congelado em 0.657.
            var b1 = p.Process(1f, 1f, 0f);
            var b2 = p.Process(1f, 1f, 0f);
            Assert.AreEqual(0f, b1.Accelerate);
            Assert.AreEqual(0f, b2.Accelerate);

            // Brake volta a 0: resume do frozen 0.657 → 0.3*1.0 + 0.7*0.657 = 0.7599.
            // Não 0.3 (resetaria) nem acumulado durante braking.
            var resumed = p.Process(1f, 0f, 0f);
            Assert.AreEqual(0.7599f, resumed.Accelerate, 1e-4f);
        }

        [Test]
        public void AC42_PartialThrottleDuringBrakingFreezesEma()
        {
            // QA spec: "partial throttle changes" durante braking. O EMA congelado NÃO deve
            // avançar com o throttle mudando — resume do frozen value.
            var p = new EmaBrakePriority();
            for (int i = 0; i < 3; i++)
            {
                p.Process(1f, 0f, 0f); // prev = 0.657
            }

            // Brake ativo, throttle varia (1.0 → 0.4 → 0.8): accelerateOut sempre 0, prev congelado.
            Assert.AreEqual(0f, p.Process(1f, 1f, 0f).Accelerate);
            Assert.AreEqual(0f, p.Process(0.4f, 1f, 0f).Accelerate);
            Assert.AreEqual(0f, p.Process(0.8f, 1f, 0f).Accelerate);

            // Brake volta a 0 → resume do frozen 0.657 (não do throttle variado).
            var resumed = p.Process(1f, 0f, 0f);
            Assert.AreEqual(0.7599f, resumed.Accelerate, 1e-4f); // 0.3*1 + 0.7*0.657
        }

            [Test]
    public void AC71_SanitizesAllChannels()
    {
        // Cada assert usa instância fresca — o EMA acumula estado entre chamadas (prev avança,
        // brake priority), então compartilhar p contaminaria os valores. Sanitização isolada.
        // Brake: NaN e ±Inf → 0 (sanitizado antes do EMA).
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, float.NaN, 0f).Brake, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, float.PositiveInfinity, 0f).Brake, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, float.NegativeInfinity, 0f).Brake, 1e-4f);
        // Brake: 1.5 clampado para 1.0 → 0.3*1 + 0.7*0 = 0.3; -1.5 clampado para -1.0 → 0.3*-1 = -0.3.
        Assert.AreEqual(0.3f, new EmaBrakePriority().Process(0f, 1.5f, 0f).Brake, 1e-4f);
        Assert.AreEqual(-0.3f, new EmaBrakePriority().Process(0f, -1.5f, 0f).Brake, 1e-4f);
        // Steer: NaN e ±Inf → 0.
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, 0f, float.NaN).Steer, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, 0f, float.PositiveInfinity).Steer, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(0f, 0f, float.NegativeInfinity).Steer, 1e-4f);
        // Steer: 1.5 clampado para 1.0 → 0.5*1 = 0.5; -1.5 clampado para -1.0 → 0.5*-1 = -0.5.
        Assert.AreEqual(0.5f, new EmaBrakePriority().Process(0f, 0f, 1.5f).Steer, 1e-4f);
        Assert.AreEqual(-0.5f, new EmaBrakePriority().Process(0f, 0f, -1.5f).Steer, 1e-4f);
        // Accelerate: NaN e ±Inf → 0; -1.5 clampado para -1.0 → 0.3*-1 = -0.3.
        Assert.AreEqual(0f, new EmaBrakePriority().Process(float.NaN, 0f, 0f).Accelerate, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(float.PositiveInfinity, 0f, 0f).Accelerate, 1e-4f);
        Assert.AreEqual(0f, new EmaBrakePriority().Process(float.NegativeInfinity, 0f, 0f).Accelerate, 1e-4f);
        Assert.AreEqual(-0.3f, new EmaBrakePriority().Process(-1.5f, 0f, 0f).Accelerate, 1e-4f);
    }


        [Test]
        public void AC71_ClampedBrakeStillActivatesPriority()
        {
            var p = new EmaBrakePriority();
            for (int i = 0; i < 3; i++)
            {
                p.Process(1f, 0f, 0f); // accelerate prev = 0.657
            }

            // Brake clampado (1.5 → 1.0) ainda ativa brake priority: accelerateOut = 0,
            // brakeOut = EMA do brake sanitizado (0.3*1.0 + 0.7*0 = 0.3).
            var o = p.Process(1f, 1.5f, 0f);
            Assert.AreEqual(0f, o.Accelerate);
            Assert.AreEqual(0.3f, o.Brake, 1e-4f);
        }

        [Test]
        public void AC71_ClampsOutOfRangeBeforeEma()
        {
            var p = new EmaBrakePriority();
            // 1.5 clampado para 1.0 ANTES do EMA → 0.3*1.0 + 0.7*0 = 0.3.
            // (Sanitize depois do EMA daria 0.3*1.5 = 0.45 — o assert distingue o estágio.)
            Assert.AreEqual(0.3f, p.Process(1.5f, 0f, 0f).Accelerate, 1e-4f);
            // -1.5 clampado para -1.0 → 0.5*-1.0 + 0.5*0 = -0.5.
            Assert.AreEqual(-0.5f, p.Process(0f, 0f, -1.5f).Steer, 1e-4f);
        }
    }
}
