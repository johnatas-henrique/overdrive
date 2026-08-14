using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Multiplayer;
using Overdrive.Simulation;
using Unity.Mathematics;

namespace Overdrive.Multiplayer.Tests
{
    /// <summary>
    /// Verifies the Multiplayer Isolation Boundary (Story 001): the ADR-0017 D2 seam is
    /// published with exact signatures, the Overdrive.Multiplayer assembly is engine-free,
    /// contract types behave per spec, and static isolation guardrails (assembly graph,
    /// package manifest, provider absence) hold for MVP.
    /// </summary>
    public class MultiplayerIsolationTests
    {
        private static Assembly MultiplayerAssembly => typeof(INetworkSimulationDriver).Assembly;

        private static string ProjectRoot
        {
            get
            {
                var cwd = Directory.GetCurrentDirectory();
                // In the Unity Editor, the working directory is the project root.
                return cwd;
            }
        }

        // ------------------------------------------------------------------ //
        // AC-1: Seam published with exact ADR-0017 D2 signatures
        // ------------------------------------------------------------------ //

        [Test]
        public void AC1_ExactD2Signatures()
        {
            Type iface = typeof(INetworkSimulationDriver);
            Assert.That(iface.IsInterface, Is.True);
            Assert.That(iface.Namespace, Is.EqualTo("Overdrive.Multiplayer"));
            Assert.That(iface.Name, Is.EqualTo("INetworkSimulationDriver"), "Legacy name INetworkSimulatorDriver must not be used.");

            var members = iface.GetMembers(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly);
            var methodNames = members.OfType<MethodInfo>()
                .Where(m => !m.IsSpecialName) // exclude event add_/remove_ accessors
                .Select(m => m.Name).ToArray();
            var eventNames = members.OfType<EventInfo>().Select(e => e.Name).ToArray();

            Assert.That(methodNames, Is.EquivalentTo(new[]
            {
                "SubmitInputs", "SerializeSnapshot", "Rollback", "GetPredictedInput"
            }), "Interface must expose exactly the four ADR-0017 D2 methods.");
            Assert.That(eventNames, Is.EquivalentTo(new[] { "RemoteInputsReceived" }), "Interface must expose exactly the RemoteInputsReceived event.");

            // SubmitInputs(ReadOnlySpan<SimulationInput>, uint)
            MethodInfo submit = iface.GetMethod("SubmitInputs");
            Assert.That(submit.ReturnType, Is.EqualTo(typeof(void)));
            var sp = submit.GetParameters();
            Assert.That(sp.Length, Is.EqualTo(2));
            Assert.That(sp[0].ParameterType, Is.EqualTo(typeof(ReadOnlySpan<SimulationInput>)));
            Assert.That(sp[1].ParameterType, Is.EqualTo(typeof(uint)));

            // int SerializeSnapshot(in PublishedSimulationSnapshot, Span<byte>)
            MethodInfo serialize = iface.GetMethod("SerializeSnapshot");
            Assert.That(serialize.ReturnType, Is.EqualTo(typeof(int)));
            var ssp = serialize.GetParameters();
            Assert.That(ssp.Length, Is.EqualTo(2));
            Assert.That(ssp[0].ParameterType, Is.EqualTo(typeof(PublishedSimulationSnapshot).MakeByRefType()), "SerializeSnapshot first param must be 'in PublishedSimulationSnapshot'.");
            Assert.That(ssp[0].IsIn, Is.True, "SerializeSnapshot first param must carry the 'in' modifier.");
            Assert.That(ssp[1].ParameterType, Is.EqualTo(typeof(Span<byte>)));

            // void Rollback(uint, in SimulationRollbackState)
            MethodInfo rollback = iface.GetMethod("Rollback");
            Assert.That(rollback.ReturnType, Is.EqualTo(typeof(void)));
            var rp = rollback.GetParameters();
            Assert.That(rp.Length, Is.EqualTo(2));
            Assert.That(rp[0].ParameterType, Is.EqualTo(typeof(uint)));
            Assert.That(rp[1].ParameterType, Is.EqualTo(typeof(SimulationRollbackState).MakeByRefType()), "Rollback second param must be 'in SimulationRollbackState'.");
            Assert.That(rp[1].IsIn, Is.True, "Rollback second param must carry the 'in' modifier.");

            // NetworkInput GetPredictedInput(int, uint)
            MethodInfo predicted = iface.GetMethod("GetPredictedInput");
            Assert.That(predicted.ReturnType, Is.EqualTo(typeof(NetworkInput)));
            var pp = predicted.GetParameters();
            Assert.That(pp.Length, Is.EqualTo(2));
            Assert.That(pp[0].ParameterType, Is.EqualTo(typeof(int)));
            Assert.That(pp[1].ParameterType, Is.EqualTo(typeof(uint)));
        }

        [Test]
        public void AC1_ExactDelegateSignature()
        {
            Type delegateType = typeof(RemoteInputsReceivedHandler);
            Assert.That(delegateType.IsClass, Is.True, "Delegates are sealed classes.");
            Assert.That(delegateType.BaseType, Is.EqualTo(typeof(MulticastDelegate)));
            Assert.That(delegateType.IsPublic, Is.True, "RemoteInputsReceivedHandler must be a public delegate.");
            Assert.That(delegateType.Name, Is.EqualTo("RemoteInputsReceivedHandler"), "Delegate name must be RemoteInputsReceivedHandler.");
            Assert.That(delegateType.Namespace, Is.EqualTo("Overdrive.Multiplayer"), "Delegate namespace must be Overdrive.Multiplayer.");

            MethodInfo invoke = delegateType.GetMethod("Invoke");
            Assert.That(invoke.ReturnType, Is.EqualTo(typeof(void)));
            var parameters = invoke.GetParameters();
            Assert.That(parameters.Length, Is.EqualTo(2));
            Assert.That(parameters[0].ParameterType, Is.EqualTo(typeof(uint)));
            Assert.That(parameters[1].ParameterType, Is.EqualTo(typeof(ReadOnlySpan<NetworkInput>)));
        }

        [Test]
        public void AC1_EventTypeMatchesDelegate()
        {
            // Mutation guard: the RemoteInputsReceived event must be typed exactly
            // RemoteInputsReceivedHandler — a different delegate must fail.
            EventInfo evt = typeof(INetworkSimulationDriver).GetEvent("RemoteInputsReceived");
            Assert.That(evt, Is.Not.Null, "RemoteInputsReceived event must exist.");
            Assert.That(evt.EventHandlerType, Is.EqualTo(typeof(RemoteInputsReceivedHandler)),
                "RemoteInputsReceived must be typed RemoteInputsReceivedHandler.");
        }

        // ------------------------------------------------------------------ //
        // AC-2: Isolated engine-free assembly
        // ------------------------------------------------------------------ //

        [Test]
        public void AC2_NoMonoBehaviourOrUnityEngineTypes()
        {
            Type[] types = MultiplayerAssembly.GetTypes();
            foreach (Type type in types)
            {
                if (!type.IsClass && !type.IsValueType && !type.IsInterface) continue;
                Assert.That(typeof(UnityEngine.Object).IsAssignableFrom(type), Is.False,
                    $"Type {type.FullName} derives from UnityEngine.Object — the assembly must be engine-free.");
                Assert.That(type.FullName ?? "", Does.Not.StartWith("UnityEngine."),
                    $"Type {type.FullName} lives in a UnityEngine namespace.");
            }
        }

        [Test]
        public void AC2_AsmdefIsEngineFree()
        {
            string asmdefPath = FindAsmdefFile("Overdrive.Multiplayer.asmdef");
            Assert.That(asmdefPath, Is.Not.Null, "Overdrive.Multiplayer.asmdef not found under Assets/source/.");

            var doc = ParseJson(File.ReadAllText(asmdefPath));
            Assert.That(doc.GetBool("noEngineReferences"), Is.True, "noEngineReferences must be true.");

            var refs = doc.GetStringArray("references");
            Assert.That(refs, Does.Contain("Overdrive.Simulation"));
            Assert.That(refs, Does.Contain("Unity.Mathematics"));
            Assert.That(refs.Count, Is.EqualTo(2), "The assembly must reference ONLY Overdrive.Simulation + Unity.Mathematics.");

            // Precompiled (DLL) references must be empty — the assembly depends only on the two asmdef refs.
            var precompiled = doc.GetStringArray("precompiledReferences");
            Assert.That(precompiled, Is.Empty, "The assembly must not declare precompiled references.");
        }

        [Test]
        public void AC2_NoForbiddenAssemblyReferences()
        {
            AssemblyName[] refs = MultiplayerAssembly.GetReferencedAssemblies();
            string[] names = refs.Select(r => r.Name).ToArray();
            Assert.That(names, Does.Not.Contain("UnityEngine"), "The assembly must not reference UnityEngine.");
            Assert.That(names, Does.Not.Contain("UnityEngine.CoreModule"));
            foreach (string forbidden in ForbiddenAssemblyPrefixes)
            {
                Assert.That(names.Any(n => MatchesPrefix(n, forbidden)), Is.False,
                    $"Assembly references forbidden transport/provider assembly prefix '{forbidden}'.");
            }
        }

        // ------------------------------------------------------------------ //
        // AC-3: Contract types and rollback wrappers
        // ------------------------------------------------------------------ //

        [Test]
        public void AC3_WrappersPreserveSixteenValues()
        {
            var positions = new List<float3>();
            for (int i = 0; i < Vector3Array16.Capacity; i++) positions.Add(new float3(i, i * 2f, i * 3f));

            var wrapper = new Vector3Array16(positions);
            Assert.That(wrapper.Count, Is.EqualTo(16));
            for (int i = 0; i < 16; i++)
            {
                var expected = new float3(i, i * 2f, i * 3f);
                Assert.That(wrapper[i].x, Is.EqualTo(expected.x).Within(1e-5f));
                Assert.That(wrapper[i].y, Is.EqualTo(expected.y).Within(1e-5f));
                Assert.That(wrapper[i].z, Is.EqualTo(expected.z).Within(1e-5f));
            }
        }

        [Test]
        public void AC3_FromEnumerableConsumesExactlySixteen()
        {
            var wrapper = Vector3Array16.FromEnumerable(Enumerable.Range(0, 16).Select(i => new float3(i)));
            Assert.That(wrapper.Count, Is.EqualTo(16));
            Assert.That(wrapper[15].x, Is.EqualTo(15f));
        }

        [Test]
        public void AC3_FactoriesFailClosed()
        {
            Assert.Throws<ArgumentNullException>(() => new Vector3Array16(null));
            Assert.Throws<ArgumentException>(() => new Vector3Array16(Enumerable.Range(0, 15).Select(i => new float3(i)).ToList()));
            Assert.Throws<ArgumentException>(() => new Vector3Array16(Enumerable.Range(0, 17).Select(i => new float3(i)).ToList()));
            Assert.Throws<ArgumentNullException>(() => Vector3Array16.FromEnumerable(null));
            Assert.Throws<ArgumentException>(() => Vector3Array16.FromEnumerable(Enumerable.Range(0, 15).Select(i => new float3(i))));
            Assert.Throws<ArgumentException>(() => Vector3Array16.FromEnumerable(Enumerable.Range(0, 17).Select(i => new float3(i))));

            Assert.Throws<ArgumentNullException>(() => new QuaternionArray16(null));
            Assert.Throws<ArgumentException>(() => new QuaternionArray16(Enumerable.Range(0, 15).Select(i => quaternion.identity).ToList()));
            Assert.Throws<ArgumentException>(() => QuaternionArray16.FromEnumerable(Enumerable.Range(0, 17).Select(i => quaternion.identity)));
        }

        [Test]
        public void AC3_IndexerOutOfRangeThrows()
        {
            var wrapper = new Vector3Array16(Enumerable.Range(0, 16).Select(i => new float3(i)).ToList());
            Assert.Throws<ArgumentOutOfRangeException>(() => { _ = wrapper[-1]; });
            Assert.Throws<ArgumentOutOfRangeException>(() => { _ = wrapper[16]; });

            var quats = new QuaternionArray16(Enumerable.Range(0, 16).Select(i => quaternion.identity).ToList());
            Assert.Throws<ArgumentOutOfRangeException>(() => { _ = quats[16]; });
        }

        [Test]
        public void AC3_SourceMutationDoesNotMutateWrapper()
        {
            var source = Enumerable.Range(0, 16).Select(i => new float3(i)).ToList();
            var wrapper = new Vector3Array16(source);
            source[0] = new float3(999f);
            Assert.That(wrapper[0].x, Is.EqualTo(0f).Within(1e-5f), "Wrapper must copy elements at construction (no alias).");
        }

        [Test]
        public void AC3_NetworkInputMinimalPlaceholder()
        {
            // Mutation guard: NetworkInput must be a struct with exactly one uint field in MVP.
            Type ni = typeof(NetworkInput);
            Assert.That(ni.IsValueType, Is.True, "NetworkInput must be a struct.");
            FieldInfo[] fields = ni.GetFields(BindingFlags.Public | BindingFlags.Instance);
            Assert.That(fields.Length, Is.EqualTo(1), "NetworkInput must expose exactly one public INSTANCE field in MVP.");
            Assert.That(fields[0].Name, Is.EqualTo("SimulationFrame"));
            Assert.That(fields[0].FieldType, Is.EqualTo(typeof(uint)));
            // Static public fields are also forbidden — the struct must stay a pure placeholder.
            FieldInfo[] staticFields = ni.GetFields(BindingFlags.Public | BindingFlags.Static);
            Assert.That(staticFields.Length, Is.EqualTo(0), "NetworkInput must not expose public static fields in MVP.");
        }

        [Test]
        public void AC3_RollbackStateIsReadonlyStruct()
        {
            // Mutation guard: SimulationRollbackState must stay a readonly struct (not a class).
            Type stateType = typeof(SimulationRollbackState);
            Assert.That(stateType.IsValueType, Is.True, "SimulationRollbackState must be a struct.");
            Assert.That(stateType.GetCustomAttributes(typeof(IsReadOnlyAttribute), false).Length, Is.GreaterThan(0),
                "SimulationRollbackState must be marked [IsReadOnly] (readonly struct).");
        }

        [Test]
        public void AC3_QuaternionFactoriesFailClosed()
        {
            // Mutation guard: quaternion wrapper must fail closed on null/wrong length, never NRE.
            Assert.Throws<ArgumentNullException>(() => new QuaternionArray16(null));
            Assert.Throws<ArgumentException>(() => new QuaternionArray16(Enumerable.Range(0, 16).Select(i => quaternion.identity).Take(15).ToList()));
            Assert.Throws<ArgumentException>(() => new QuaternionArray16(Enumerable.Range(0, 16).Select(i => quaternion.identity).ToList().Concat(new[] { quaternion.identity }).ToList()));
            Assert.Throws<ArgumentNullException>(() => QuaternionArray16.FromEnumerable(null));
            Assert.Throws<ArgumentException>(() => QuaternionArray16.FromEnumerable(Enumerable.Range(0, 15).Select(i => quaternion.identity)));
            Assert.Throws<ArgumentException>(() => QuaternionArray16.FromEnumerable(Enumerable.Range(0, 17).Select(i => quaternion.identity)));
            Assert.Throws<ArgumentOutOfRangeException>(() => { _ = new QuaternionArray16(Enumerable.Range(0, 16).Select(i => quaternion.identity).ToList())[-1]; });
        }

        [Test]
        public void AC3_QuaternionValuePreservation()
        {
            // Mutation guard: quaternion wrapper must preserve all 16 values through indexed access.
            // A negated quaternion (-q) must FAIL — Abs(dot) would treat it as equal, so we assert
            // the positive dot product (same orientation), not its absolute value.
            var quats = new List<quaternion>();
            for (int i = 0; i < 16; i++) quats.Add(quaternion.EulerZXY(new float3(i, 0, 0)));
            var wrapper = new QuaternionArray16(quats);
            for (int i = 0; i < 16; i++)
            {
                var expected = quaternion.EulerZXY(new float3(i, 0, 0));
                float dot = math.dot(wrapper[i].value, expected.value);
                Assert.That(dot, Is.GreaterThan(0.9999f),
                    $"Quaternion wrapper[{i}] must preserve the original orientation (dot {dot} must be positive near 1).");
            }
        }

        [Test]
        public void AC3_FromEnumerableSuccessPath()
        {
            // Mutation guard: FromEnumerable must preserve all values on the valid 16-element path.
            var wrapper = Vector3Array16.FromEnumerable(Enumerable.Range(0, 16).Select(i => new float3(i, i * 2f, i * 3f)));
            Assert.That(wrapper.Count, Is.EqualTo(16));
            for (int i = 0; i < 16; i++)
            {
                Assert.That(wrapper[i].x, Is.EqualTo(i).Within(1e-5f));
                Assert.That(wrapper[i].y, Is.EqualTo(i * 2f).Within(1e-5f));
                Assert.That(wrapper[i].z, Is.EqualTo(i * 3f).Within(1e-5f));
            }
        }

        [Test]
        public void AC3_QuaternionFromEnumerableSuccessPath()
        {
            // Mutation guard: quaternion FromEnumerable must preserve all 16 orientations on the
            // valid path — a mutant returning default or identity-filled wrapper must fail.
            var quats = Enumerable.Range(0, 16).Select(i => quaternion.EulerZXY(new float3(i, 0, 0))).ToList();
            var wrapper = QuaternionArray16.FromEnumerable(quats);
            Assert.That(wrapper.Count, Is.EqualTo(16));
            for (int i = 0; i < 16; i++)
            {
                float dot = math.dot(wrapper[i].value, quats[i].value);
                Assert.That(dot, Is.GreaterThan(0.9999f),
                    $"Quaternion wrapper[{i}] must preserve the original orientation via FromEnumerable (dot {dot}).");
            }
        }

        [Test]
        public void AC3_AllVelocityIndicesPreserved()
        {
            // Mutation guard: linear/angular velocity wrappers must preserve ALL 16 values, not just sampled ones.
            var linear = new Vector3Array16(Enumerable.Range(0, 16).Select(i => new float3(i, i * 2f, i * 3f)).ToList());
            for (int i = 0; i < 16; i++)
            {
                Assert.That(linear[i].x, Is.EqualTo(i).Within(1e-5f));
                Assert.That(linear[i].y, Is.EqualTo(i * 2f).Within(1e-5f));
                Assert.That(linear[i].z, Is.EqualTo(i * 3f).Within(1e-5f));
            }
        }

        [Test]
        public void AC3_ExactConstructorSignatures()
        {
            // Mutation guard: ctor must take IReadOnlyList<T> exactly (not List<T> or arrays).
            ConstructorInfo v3ctor = typeof(Vector3Array16).GetConstructor(new[] { typeof(IReadOnlyList<float3>) });
            Assert.That(v3ctor, Is.Not.Null, "Vector3Array16 must expose a public ctor taking IReadOnlyList<float3>.");

            ConstructorInfo qctor = typeof(QuaternionArray16).GetConstructor(new[] { typeof(IReadOnlyList<quaternion>) });
            Assert.That(qctor, Is.Not.Null, "QuaternionArray16 must expose a public ctor taking IReadOnlyList<quaternion>.");

            // Static factories must exist with exact signatures.
            MethodInfo v3factory = typeof(Vector3Array16).GetMethod("FromEnumerable", new[] { typeof(IEnumerable<float3>) });
            Assert.That(v3factory, Is.Not.Null, "Vector3Array16 must expose static FromEnumerable(IEnumerable<float3>).");
            Assert.That(v3factory.IsStatic, Is.True);
            Assert.That(v3factory.ReturnType, Is.EqualTo(typeof(Vector3Array16)));

            MethodInfo qfactory = typeof(QuaternionArray16).GetMethod("FromEnumerable", new[] { typeof(IEnumerable<quaternion>) });
            Assert.That(qfactory, Is.Not.Null, "QuaternionArray16 must expose static FromEnumerable(IEnumerable<quaternion>).");
            Assert.That(qfactory.IsStatic, Is.True);
            Assert.That(qfactory.ReturnType, Is.EqualTo(typeof(QuaternionArray16)));
        }

        [Test]
        public void AC3_RollbackStateHasFourReadonlyFields()
        {
            var positions = new Vector3Array16(Enumerable.Range(0, 16).Select(i => new float3(i)).ToList());
            var rotations = new QuaternionArray16(Enumerable.Range(0, 16).Select(i => quaternion.identity).ToList());
            var linear = new Vector3Array16(Enumerable.Range(0, 16).Select(i => new float3(i, i, i)).ToList());
            var angular = new Vector3Array16(Enumerable.Range(0, 16).Select(i => new float3(i, 0, 0)).ToList());

            var state = new SimulationRollbackState(positions, rotations, linear, angular);

            // The four arrays must be distinct — a ctor that assigns LinearVelocities to AngularVelocities
            // (or any cross-wiring) must fail, not just preserve sampled indices.
            Assert.That(state.AngularVelocities[0].x, Is.EqualTo(0f).Within(1e-5f));
            Assert.That(state.LinearVelocities[0].x, Is.EqualTo(0f).Within(1e-5f));
            Assert.That(state.AngularVelocities[5].x, Is.EqualTo(5f).Within(1e-5f));
            Assert.That(state.LinearVelocities[5].x, Is.EqualTo(5f).Within(1e-5f));
            // Distinct-value proof: linear[i] = (i,i,i) vs angular[i] = (i,0,0) — y differs at every index.
            Assert.That(state.LinearVelocities[7].y, Is.EqualTo(7f).Within(1e-5f), "LinearVelocities[7].y must be 7 (distinct from AngularVelocities).");
            Assert.That(state.AngularVelocities[7].y, Is.EqualTo(0f).Within(1e-5f), "AngularVelocities[7].y must be 0 (distinct from LinearVelocities).");

            // Field names and types must match the contract exactly (4 public readonly fields).
            FieldInfo[] fields = typeof(SimulationRollbackState).GetFields(BindingFlags.Public | BindingFlags.Instance);
            Assert.That(fields.Length, Is.EqualTo(4));
            Assert.That(fields.All(f => f.IsInitOnly), Is.True, "All rollback fields must be readonly.");
            Assert.That(fields.Select(f => f.Name), Is.EquivalentTo(new[] { "Positions", "Rotations", "LinearVelocities", "AngularVelocities" }));
            Assert.That(typeof(SimulationRollbackState).GetField("Positions").FieldType, Is.EqualTo(typeof(Vector3Array16)));
            Assert.That(typeof(SimulationRollbackState).GetField("Rotations").FieldType, Is.EqualTo(typeof(QuaternionArray16)));
            Assert.That(typeof(SimulationRollbackState).GetField("LinearVelocities").FieldType, Is.EqualTo(typeof(Vector3Array16)));
            Assert.That(typeof(SimulationRollbackState).GetField("AngularVelocities").FieldType, Is.EqualTo(typeof(Vector3Array16)));

            // Positions and Rotations values must survive construction — a ctor assigning
            // Positions = default (or Rotations = default) must fail.
            Assert.That(state.Positions[7].x, Is.EqualTo(7f).Within(1e-5f), "Positions[7].x must be preserved.");
            float rotDot = math.dot(state.Rotations[7].value, quaternion.identity.value);
            Assert.That(rotDot, Is.GreaterThan(0.9999f), "Rotations[7] must preserve quaternion.identity.");
        }

        [Test]
        public void AC3_WrapperElementTypeIsUnityMathematics()
        {
            Type wrapperType = typeof(Vector3Array16);
            FieldInfo[] fields = wrapperType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic);
            foreach (FieldInfo field in fields)
            {
                Assert.That(field.FieldType, Is.EqualTo(typeof(float3)), $"Wrapper field {field.Name} must be Unity.Mathematics.float3 (never UnityEngine.Vector3).");
            }

            Type quatType = typeof(QuaternionArray16);
            FieldInfo[] quatFields = quatType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic);
            foreach (FieldInfo field in quatFields)
            {
                Assert.That(field.FieldType, Is.EqualTo(typeof(quaternion)), $"Wrapper field {field.Name} must be Unity.Mathematics.quaternion (never UnityEngine.Quaternion).");
            }
        }

        // ------------------------------------------------------------------ //
        // AC-4: Assembly isolation guardrail (static, fail-closed, editor-aware)
        // ------------------------------------------------------------------ //

        private static readonly string[] ForbiddenAssemblyPrefixes =
        {
            "Unity.Services.", "Unity.Netcode.Runtime", "Mirror", "Photon", "Coherence", "Fusion", "Unity.Transport"
        };

        private static readonly string[] ForbiddenAsmdefNamespaces =
        {
            "Unity.Services", "Unity.Netcode", "Mirror", "Photon", "Coherence", "Fusion", "Unity.Transport"
        };

        [Test]
        public void AC4_OnlyKnownNonEditorGameplayAssemblies()
        {
            var asmdefs = FindAsmdefFilesUnder("Assets/source");
            Assert.That(asmdefs.Count, Is.GreaterThanOrEqualTo(5), "Expected at least the five gameplay asmdefs.");

            var nonEditor = new List<string>();
            foreach (string path in asmdefs)
            {
                var doc = ParseJson(File.ReadAllText(path));
                var platforms = doc.GetStringArray("includePlatforms");
                if (platforms.Contains("Editor")) continue; // editor-only excluded

                string name = doc.GetString("name");
                nonEditor.Add(name);
            }

            // The known gameplay assembly set grows with each Foundation epic. Adding a NEW non-editor
            // asmdef under Assets/source/ that is not in this list fails closed — an undeclared assembly
            // must be audited before it can join the boundary.
            Assert.That(nonEditor, Is.EquivalentTo(new[]
            {
                "Overdrive.Input", "Overdrive.Simulation", "Overdrive.Multiplayer",
                "Overdrive.Settings.Core", "Overdrive.Settings", "Overdrive.Content"
            }),
                "The only non-editor gameplay assemblies under Assets/source/ must be the known manifest. Any other non-editor asmdef fails.");
        }

        [Test]
        public void AC4_NoForbiddenNamespacesInAsmdefReferences()
        {
            foreach (string asmdefPath in FindAsmdefFilesUnder("Assets/source"))
            {
                var doc = ParseJson(File.ReadAllText(asmdefPath));
                var references = doc.GetStringArray("references");
                var precompiled = doc.GetStringArray("precompiledReferences");

                foreach (string reference in references.Concat(precompiled))
                {
                    foreach (string forbidden in ForbiddenAsmdefNamespaces)
                    {
                        Assert.That(MatchesBoundary(reference, forbidden), Is.False,
                            $"Asmdef '{doc.GetString("name")}' references '{reference}' which matches forbidden boundary '{forbidden}'.");
                    }
                }
            }
        }

        [Test]
        public void AC4_RecursiveAssemblyGraphScan()
        {
            var visited = new HashSet<string>(StringComparer.Ordinal);
            var queue = new Queue<AssemblyName>();

            // Seed with ALL three gameplay assemblies — a forbidden transitive reference
            // reachable only through Overdrive.Input or Overdrive.Simulation must be caught.
            foreach (string assemblyName in new[] { "Overdrive.Multiplayer", "Overdrive.Input", "Overdrive.Simulation" })
            {
                Assembly seed = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == assemblyName);
                if (seed == null) continue;
                foreach (AssemblyName name in seed.GetReferencedAssemblies()) queue.Enqueue(name);
            }

            while (queue.Count > 0)
            {
                AssemblyName current = queue.Dequeue();
                if (!visited.Add(current.Name)) continue;

                foreach (string forbidden in ForbiddenAssemblyPrefixes)
                {
                    Assert.That(MatchesPrefix(current.Name, forbidden), Is.False,
                        $"Assembly graph contains '{current.Name}' matching forbidden prefix '{forbidden}'.");
                }

                try
                {
                    Assembly asm = Assembly.Load(current);
                    foreach (AssemblyName nested in asm.GetReferencedAssemblies()) queue.Enqueue(nested);
                }
                catch (Exception)
                {
                    // A referenced assembly that cannot be loaded (e.g. editor-only) is not scanned deeper.
                }
            }
        }

        [Test]
        public void AC4_UnityEngineNetworkingAllowed()
        {
            // UnityEngine.Networking / UnityWebRequest must NOT be flagged by the denylist.
            string[] allowed = { "UnityEngine.Networking", "UnityWebRequest" };
            foreach (string candidate in allowed)
            {
                foreach (string forbidden in ForbiddenAsmdefNamespaces)
                {
                    Assert.That(MatchesBoundary(candidate, forbidden), Is.False,
                        $"'{candidate}' must be allowed — it must not match forbidden boundary '{forbidden}'.");
                }
            }

            // Exact boundary: 'Unity.ServicesX' must NOT match 'Unity.Services' (raw StartsWith would).
            Assert.That(MatchesBoundary("Unity.ServicesX", "Unity.Services"), Is.False,
                "Unity.ServicesX must not be treated as Unity.Services — boundary must be exact.");
            Assert.That(MatchesBoundary("Unity.Services.Authentication", "Unity.Services"), Is.True,
                "Unity.Services.Authentication IS within the forbidden boundary and must match.");
            Assert.That(MatchesBoundary("Unity.Transport", "Unity.Transport"), Is.True,
                "Exact equality must match.");
        }

        // ------------------------------------------------------------------ //
        // AC-5: Package manifest denylist (deterministic)
        // ------------------------------------------------------------------ //

        private static readonly string[] DeniedPackageIds =
        {
            "com.unity.netcode.gameobjects", "com.unity.transport", "io.fusion", "com.coherence", "com.mirrorng", "org.photonengine"
        };

        [Test]
        public void AC5_ManifestHasNoDeniedPackages()
        {
            var manifest = ParseJson(File.ReadAllText(Path.Combine(ProjectRoot, "Packages", "manifest.json")));
            var deps = manifest.GetObject("dependencies");
            Assert.That(deps.Count, Is.GreaterThan(0), "manifest.json must declare a dependencies object — absent dependencies would vacuously pass the denylist.");

            foreach (string key in deps.Keys)
            {
                foreach (string denied in DeniedPackageIds)
                {
                    Assert.That(key, Is.Not.EqualTo(denied),
                        $"manifest.json must not depend on denied package '{denied}'.");
                }
                Assert.That(key.StartsWith("com.unity.services."), Is.False,
                    $"manifest.json must not depend on any com.unity.services.* online-services package (found '{key}') — TR-multiplayer-001 / ADR-0016:68-69.");
            }
        }

        [Test]
        public void AC5_LockHasNoDeniedPackages()
        {
            var lockDoc = ParseJson(File.ReadAllText(Path.Combine(ProjectRoot, "Packages", "packages-lock.json")));
            var deps = lockDoc.GetObject("dependencies");
            Assert.That(deps.Count, Is.GreaterThan(0), "packages-lock.json must declare a dependencies object — absent dependencies would vacuously pass the denylist.");

            foreach (string key in deps.Keys)
            {
                foreach (string denied in DeniedPackageIds)
                {
                    Assert.That(key, Is.Not.EqualTo(denied),
                        $"packages-lock.json must not contain denied package '{denied}'.");
                }
            }

            // Nested dependencies: every resolved package is a top-level lock key (Unity lock schema),
            // so the top-level scan already covers transitive packages. Each entry may still declare its
            // own nested dependencies — a denied package must not appear there either.
            foreach (string key in deps.Keys)
            {
                Assert.That(deps[key], Is.InstanceOf<JsonObject>(),
                    $"Lock entry '{key}' must be a JSON object — malformed lock structure must fail closed.");
                var nested = ((JsonObject)deps[key]).GetObject("dependencies");
                foreach (string nestedKey in nested.Keys)
                {
                    foreach (string denied in DeniedPackageIds)
                    {
                        Assert.That(nestedKey, Is.Not.EqualTo(denied),
                            $"Denied package '{denied}' must not appear as a nested dependency of '{key}' in the lock.");
                    }
                    Assert.That(nestedKey, Is.Not.EqualTo("com.unity.multiplayer.playmode"),
                        $"com.unity.multiplayer.playmode must not appear as a nested dependency of '{key}' in the lock.");
                }
            }
        }

        [Test]
        public void AC5_MultiplayerCenterAllowedAsBuiltIn()
        {
            // com.unity.multiplayer.center is the Unity Multiplayer Center editor tool (built-in).
            // The denylist must NOT flag it: it is absent from DeniedPackageIds and, when present
            // in the lock, must be a built-in/editor package — never a runtime dependency.
            Assert.That(DeniedPackageIds, Does.Not.Contain("com.unity.multiplayer.center"),
                "com.unity.multiplayer.center must not be on the denylist — it is an allowed built-in editor package.");

            var lockDoc = ParseJson(File.ReadAllText(Path.Combine(ProjectRoot, "Packages", "packages-lock.json")));
            var deps = lockDoc.GetObject("dependencies");

            if (deps.TryGetValue("com.unity.multiplayer.center", out object centerEntry) && centerEntry is JsonObject centerObj)
            {
                // The lock stores each package entry as a nested object; its source must be builtin/editor-only.
                Assert.That(centerObj.GetString("source"), Is.EqualTo("builtin"),
                    "com.unity.multiplayer.center must be a built-in package in the lock (source: builtin), not a runtime dependency.");
            }

            // com.unity.multiplayer.playmode must fail if present in manifest OR as a runtime dependency in lock.
            var manifest = ParseJson(File.ReadAllText(Path.Combine(ProjectRoot, "Packages", "manifest.json")));
            Assert.That(manifest.GetObject("dependencies").ContainsKey("com.unity.multiplayer.playmode"), Is.False,
                "com.unity.multiplayer.playmode must not appear in manifest.json.");
            Assert.That(deps.ContainsKey("com.unity.multiplayer.playmode"), Is.False,
                "com.unity.multiplayer.playmode must not appear as a dependency in packages-lock.json.");
        }

        // ------------------------------------------------------------------ //
        // AC-6: No provider implementation
        // ------------------------------------------------------------------ //

        [Test]
        public void AC6_NoConcreteProviderImplementsDriver()
        {
            Type driverType = typeof(INetworkSimulationDriver);
            var implementers = new List<Type>();

            foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (assembly.IsDynamic) continue;
                Type[] types;
                try { types = assembly.GetTypes(); }
                catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
                catch { continue; }

                foreach (Type type in types)
                {
                    if (type.IsAbstract || type.IsInterface) continue;
                    if (driverType.IsAssignableFrom(type))
                        implementers.Add(type);
                }
            }

            Assert.That(implementers, Is.Empty,
                $"MVP must contain NO concrete INetworkSimulationDriver implementation (found: {string.Join(", ", implementers.Select(t => t.FullName))}).");
        }

        // ------------------------------------------------------------------ //
        // AC-7: Alpha/Beta deferral (absence-scoped)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC7_NoFuturePhaseImplementationPresent()
        {
            // Absence of future-phase implementations/dependencies: no provider, no transport
            // package, no rollback pipeline — verified by the AC-4/AC-5/AC-6 scans above.
            // This test asserts the seam/contract set is exactly the MVP-scoped one.
            Type[] types = MultiplayerAssembly.GetTypes();
            string[] typeNames = types.Select(t => t.FullName).ToArray();

            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.INetworkSimulationDriver"));
            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.RemoteInputsReceivedHandler"));
            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.SimulationRollbackState"));
            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.NetworkInput"));
            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.Vector3Array16"));
            Assert.That(typeNames, Does.Contain("Overdrive.Multiplayer.QuaternionArray16"));

            // No provider or rollback pipeline types exist in the MVP seam assembly.
            Assert.That(typeNames.Any(n => n.Contains("Provider") || n.Contains("RollbackPipeline") || n.Contains("Transport")), Is.False,
                "No provider/rollback-pipeline/transport types may exist in the MVP seam assembly.");

            // The OTHER gameplay assemblies (Overdrive.Input, Overdrive.Simulation) must also be free
            // of rollback-pipeline types — AC-7 scans the full gameplay surface, not just the seam.
            string[] gameplayAssemblyNames = { "Overdrive.Multiplayer", "Overdrive.Input", "Overdrive.Simulation" };
            foreach (Assembly asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (asm.IsDynamic) continue;
                if (!gameplayAssemblyNames.Contains(asm.GetName().Name)) continue;

                Type[] asmTypes;
                try { asmTypes = asm.GetTypes(); }
                catch (ReflectionTypeLoadException e) { asmTypes = e.Types.Where(t => t != null).ToArray(); }
                catch { continue; }

                foreach (string n in asmTypes.Select(t => t.FullName))
                {
                    Assert.That(n == null || !n.Contains("RollbackPipeline"), Is.True,
                        $"No RollbackPipeline type may exist in {asm.GetName().Name} (found {n}).");
                }
            }
        }

        // ------------------------------------------------------------------ //
        // Helpers
        // ------------------------------------------------------------------ //

        private static bool MatchesPrefix(string assemblyName, string forbiddenPrefix)
        {
            if (string.IsNullOrEmpty(assemblyName)) return false;
            if (assemblyName == forbiddenPrefix) return true;
            return assemblyName.StartsWith(forbiddenPrefix, StringComparison.Ordinal);
        }

        private static bool MatchesBoundary(string candidate, string forbiddenNamespace)
        {
            if (string.IsNullOrEmpty(candidate)) return false;
            if (candidate == forbiddenNamespace) return true;
            // Exact boundary: namespace boundary match only (e.g. "Unity.ServicesX" must NOT match "Unity.Services").
            return candidate.StartsWith(forbiddenNamespace + ".", StringComparison.Ordinal);
        }

        private static string FindAsmdefFile(string fileName)
        {
            string root = Path.Combine(ProjectRoot, "Assets", "source");
            return Directory.Exists(root)
                ? Directory.GetFiles(root, fileName, SearchOption.AllDirectories).FirstOrDefault()
                : null;
        }

        private static List<string> FindAsmdefFilesUnder(string relativeDir)
        {
            string root = Path.Combine(ProjectRoot, relativeDir);
            if (!Directory.Exists(root)) return new List<string>();
            return Directory.GetFiles(root, "*.asmdef", SearchOption.AllDirectories).ToList();
        }

        private static JsonObject ParseJson(string json)
        {
            return JsonObject.Parse(json);
        }

        // Minimal JSON object parser for dynamic manifest/lock/asmdef keys.
        private sealed class JsonObject
        {
            private readonly Dictionary<string, object> _fields = new Dictionary<string, object>();

            public static JsonObject Parse(string json)
            {
                int index = 0;
                object root = ParseValue(json, ref index);
                if (root is JsonObject obj) return obj;
                throw new InvalidDataException("JSON root must be an object.");
            }

            public string GetString(string key) => _fields.TryGetValue(key, out object value) ? (string)value : "";
            public bool GetBool(string key) => _fields.TryGetValue(key, out object value) && value is bool b && b;
            public List<string> GetStringArray(string key)
            {
                var result = new List<string>();
                if (_fields.TryGetValue(key, out object value) && value is List<object> list)
                {
                    foreach (object item in list) result.Add(item?.ToString() ?? "");
                }
                return result;
            }

            public Dictionary<string, object> GetObject(string key)
            {
                var result = new Dictionary<string, object>();
                if (_fields.TryGetValue(key, out object value) && value is JsonObject obj)
                {
                    foreach (var kv in obj._fields) result[kv.Key] = kv.Value;
                }
                return result;
            }

            public IReadOnlyCollection<string> Keys => _fields.Keys;

            public static object ParseValue(string json, ref int index)
            {
                SkipWhitespace(json, ref index);
                if (index >= json.Length) throw new InvalidDataException("Unexpected end of JSON.");
                char c = json[index];
                if (c == '{')
                {
                    index++;
                    var obj = new JsonObject();
                    SkipWhitespace(json, ref index);
                    if (index < json.Length && json[index] == '}') { index++; return obj; }
                    while (true)
                    {
                        SkipWhitespace(json, ref index);
                        string key = (string)ParseValue(json, ref index);
                        SkipWhitespace(json, ref index);
                        if (json[index] != ':') throw new InvalidDataException("Expected ':' in object.");
                        index++;
                        object value = ParseValue(json, ref index);
                        obj._fields[key] = value;
                        SkipWhitespace(json, ref index);
                        if (json[index] == ',') { index++; continue; }
                        if (json[index] == '}') { index++; return obj; }
                        throw new InvalidDataException("Expected ',' or '}' in object.");
                    }
                }
                if (c == '[')
                {
                    index++;
                    var list = new List<object>();
                    SkipWhitespace(json, ref index);
                    if (index < json.Length && json[index] == ']') { index++; return list; }
                    while (true)
                    {
                        list.Add(ParseValue(json, ref index));
                        SkipWhitespace(json, ref index);
                        if (json[index] == ',') { index++; continue; }
                        if (json[index] == ']') { index++; return list; }
                        throw new InvalidDataException("Expected ',' or ']' in array.");
                    }
                }
                if (c == '"')
                {
                    index++;
                    var sb = new System.Text.StringBuilder();
                    while (index < json.Length && json[index] != '"')
                    {
                        if (json[index] == '\\' && index + 1 < json.Length)
                        {
                            index++;
                            sb.Append(json[index]);
                        }
                        else sb.Append(json[index]);
                        index++;
                    }
                    if (index >= json.Length) throw new InvalidDataException("Unterminated string.");
                    index++;
                    return sb.ToString();
                }
                if (c == 't' && json.Substring(index, 4) == "true") { index += 4; return true; }
                if (c == 'f' && json.Substring(index, 5) == "false") { index += 5; return false; }
                if (c == 'n' && json.Substring(index, 4) == "null") { index += 4; return null; }
                if (c == '-' || (c >= '0' && c <= '9'))
                {
                    int start = index;
                    while (index < json.Length && "-0123456789.eE+".IndexOf(json[index]) >= 0) index++;
                    return json.Substring(start, index - start);
                }
                throw new InvalidDataException($"Unexpected character '{c}' at position {index}.");
            }

            private static void SkipWhitespace(string json, ref int index)
            {
                while (index < json.Length && char.IsWhiteSpace(json[index])) index++;
            }
        }
    }
}
