// PROTOTYPE - NOT FOR PRODUCTION
// Runtime tuning panel for the race-feel prototype (playtest 2026-08-02).
// Press Tab to show/hide. Every value is a text field applied on Enter
// (or via the Apply All button). Track button swaps Oval <-> Spa at runtime
// (full rebuild + reset). Speed cap locks the car at a fixed speed so corner
// tables can be validated without feathering the throttle.
//
// FIX (2026-08-02): the first version only applied a field when its text
// changed in the same frame as Enter - which never happens (typing changes
// the text in earlier frames), so nothing ever applied. Now Enter always
// parses the current text, and the keyboard focus is released back to the
// game so WASD/S are not swallowed by the text field.

using System.Globalization;
using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// OnGUI tuning panel: steering capacity curve, speed cap, track swap.
    /// Values are typed (not sliders) so the playtester can enter exact
    /// numbers and validate corner tables at a fixed speed.
    /// </summary>
    public class RaceFeelTuningPanel : MonoBehaviour
    {
        [Header("References (auto-found)")]
        [SerializeField] ArcadeCar car;
        [SerializeField] PrototypeTrack track;
        [SerializeField] CarVisualLivery carVisual;
        [SerializeField] RaceFeelController controller;

        // Text field buffers (applied on Enter).
        // 16-team roster: name, real engine P/m (kW/505kg), real vmax (km/h),
        // registry BR/GR/ST stats (unchanged), and the NEW TS/AC stat values
        // approved 2026-08-02 (real-engine scale).
        // (name, pm, vmax, br, gr, st, ts, ac)
        static readonly (string name, float pm, float vmax, int br, int gr, int st, int ts, int ac)[] TeamCars =
        {
            ("1a McLaren", 1012f, 340f, 16, 20, 20, 20, 20),
            ("1b Ferrari", 974f, 340f, 20, 16, 20, 20, 20),
            ("1c Williams", 960f, 334f, 20, 16, 16, 17, 19),
            ("1d Benetton", 931f, 330f, 20, 20, 20, 15, 17),
            ("2a March", 915f, 322f, 16, 16, 16, 11, 14),
            ("2b Lotus", 915f, 322f, 20, 16, 12, 11, 14),
            ("2c Tyrrell", 915f, 316f, 16, 16, 16, 8, 11),
            ("2d Brabham", 915f, 322f, 16, 12, 12, 11, 14),
            ("3a Minardi", 915f, 316f, 12, 12, 12, 8, 11),
            ("3b Ligier", 915f, 316f, 8, 12, 8, 8, 11),
            ("3c Dallara", 915f, 316f, 16, 16, 16, 8, 11),
            ("3d Arrows", 915f, 316f, 8, 12, 8, 8, 11),
            ("4a Rial", 915f, 316f, 8, 12, 12, 8, 11),
            ("4b Coloni", 915f, 316f, 8, 12, 8, 8, 11),
            ("4c Onyx", 915f, 316f, 8, 8, 8, 8, 11),
            ("4d Zakspeed", 832f, 312f, 4, 12, 12, 6, 6),
        };

        // Text field buffers (applied on Enter). Steering knobs are GLOBAL
        // (user decision 2026-08-02): 2.5 / 1.5 / 0.5 / 10 / 60 / shape 1 -
        // identical for all cars; only falloffEnd varies (99% of own vmax).
        string _maxSteerLow = "2.5";
        string _maxSteerHigh = "1.5";
        string _liftOffBonus = "0.5";
        string _minTurnRadius = "10";
        string _falloffStart = "60";
        string _falloffEnd = "321"; // 99% of proto 324 km/h
        string _falloffShape = "1";
        string _maxLateralG = "20";
        string _liftOffGripBonus = "3";
        string _speedCap = "0"; // 0 = no cap
        string _coastDecel = "3.5";
        string _deadStop = "0.8";
        string _enginePower = "40";
        string _powerPerMass = "1012";
        string _dragCoeff = "0";
        string _grassGrip = "0.55";
        string _grassDecel = "4";
        string _grassTraction = "0.25"; // engine fraction on grass
        string _brakePower = "35";
        string _maxSpeed = "324"; // km/h
        string _controlThreshold = "1";
        string _driftFactor = "1.15";   // velocity follows F x grip above the curve's speed limit
        string _driftLookahead = "40";  // m: corner radius sample distance ahead
        string _driftHeadBoost = "1.40"; // heading asks F x this more than the velocity (slip gap)

        // Grip calibration (user formula 2026-08-02): grip is defined as the
        // % of the car's OWN vmax at which the oval (70 m) can be taken
        // flat-out while accelerating. Interpolated between high (GR 20)
        // and low (GR 0) by the car's GR stat. Values in % (90 = 90%).
        string _gripHighPct = "90";
        string _gripLowPct = "50";

        bool _visible = true;
        Rect _window = new Rect(12, 12, 300, 760);
        string _appliedNote = "";

        void Start()
        {
            if (car == null) car = FindFirstObjectByType<ArcadeCar>();
            if (track == null) track = FindFirstObjectByType<PrototypeTrack>();
            if (controller == null) controller = FindFirstObjectByType<RaceFeelController>();
            if (carVisual == null && car != null)
                carVisual = car.GetComponentInChildren<CarVisualLivery>(true);

            if (carVisual != null)
                carVisual.ApplyTeamColor(15);

            RefreshFromCar();
        }

        static string F(float v) => v.ToString("0.##", CultureInfo.InvariantCulture);

        void Update()
        {
            // Tab toggles the panel (Input System).
            if (UnityEngine.InputSystem.Keyboard.current != null
                && UnityEngine.InputSystem.Keyboard.current.tabKey.wasPressedThisFrame)
                _visible = !_visible;
        }

        void OnGUI()
        {
            if (!_visible) return;
            // Window starts anchored to the RIGHT edge so it does not cover
            // the HUD times at the top-left (playtest feedback 2026-08-02).
            if (_window.x == 12f) // only on first frame
                _window = new Rect(Screen.width - _window.width - 12f, 12f, _window.width, _window.height);
            _window = GUILayout.Window(42, _window, DrawWindow, "Race Feel Tuning (Tab)");
        }

        void DrawWindow(int id)
        {
            GUILayout.Label("Enter applies a field, or Apply All", GUILayout.Width(280));

            GUILayout.Label("— GLOBAL steering + traction (all cars) —", GUILayout.Width(280));
            _maxSteerLow = Field("Max steer low (rad/s)", _maxSteerLow);
            _maxSteerHigh = Field("Max steer high (rad/s)", _maxSteerHigh);
            _liftOffBonus = Field("Lift-off bonus (rad/s)", _liftOffBonus);
            _minTurnRadius = Field("Min turn radius (m)", _minTurnRadius);
            _falloffStart = Field("Falloff start (km/h)", _falloffStart);
            _falloffShape = Field("Falloff shape (1=lin)", _falloffShape);
            _enginePower = Field("Engine traction [tire, all]", _enginePower);

            GUILayout.Label("— CAR-DEPENDENT (from car stats) —", GUILayout.Width(280));
            _maxSpeed = Field("Max speed [Top Speed stat]", _maxSpeed);
            _falloffEnd = Field("Falloff end [Top Speed x0.99]", _falloffEnd);
            _powerPerMass = Field("Power P/m [car data]", _powerPerMass);
            _dragCoeff = Field("Drag coeff K [derived]", _dragCoeff);
            _brakePower = Field("Brake power [Brake stat]", _brakePower);
            _maxLateralG = Field("Grip (g) [Grip stat]", _maxLateralG);
            _liftOffGripBonus = Field("Lift-off grip (g) [fixed]", _liftOffGripBonus);
            _controlThreshold = Field("Control thr [Stability]", _controlThreshold);

            GUILayout.Label("— Grip calibration (GR: 20=high, 0=low) —", GUILayout.Width(280));
            _gripHighPct = Field("Grip high % (GR 20)", _gripHighPct);
            _gripLowPct = Field("Grip low % (GR 0)", _gripLowPct);

            GUILayout.Label("— BEHAVIOR (not car-dependent) —", GUILayout.Width(280));
            _speedCap = Field("Speed cap (km/h, 0=off)", _speedCap);
            _driftFactor = Field("Drift factor (1=off)", _driftFactor);
            _driftLookahead = Field("Drift lookahead (m)", _driftLookahead);
            _driftHeadBoost = Field("Drift head boost (x)", _driftHeadBoost);
            _coastDecel = Field("Coast decel (m/s2)", _coastDecel);
            _deadStop = Field("Dead stop (m/s)", _deadStop);
            _grassGrip = Field("Grass grip (mult)", _grassGrip);
            _grassDecel = Field("Grass decel (m/s2)", _grassDecel);
            _grassTraction = Field("Grass traction (mult)", _grassTraction);

            GUILayout.Label("— 16 cars (real 1989 engines) —", GUILayout.Width(280));
            for (int i = 0; i < TeamCars.Length; i += 2)
            {
                GUILayout.BeginHorizontal();
                if (GUILayout.Button(TeamCars[i].name, GUILayout.Width(140)))
                    ApplyTeamCar(i);
                if (i + 1 < TeamCars.Length && GUILayout.Button(TeamCars[i + 1].name, GUILayout.Width(140)))
                    ApplyTeamCar(i + 1);
                GUILayout.EndHorizontal();
            }

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Car proto (tuning)", GUILayout.Width(140)))
            {
                ApplyProtoCar();
            }
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Apply All", GUILayout.Width(90)))
            {
                ApplyAll();
            }
            if (GUILayout.Button($"Track: {track.Variant}", GUILayout.Width(180)))
            {
                track.SwitchVariant();
                controller.ResetSession();
                RefreshFromCar();
                _appliedNote = "track switched + race reset";
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(6);
            GUILayout.Label("— Live —", GUILayout.Width(280));
            float v = car.CurrentSpeedKmh;
            GUILayout.Label($"Speed: {v:0.0} km/h" + (car.SpeedCapKmh > 0f ? $"  (cap {car.SpeedCapKmh:0})" : ""), GUILayout.Width(280));
            GUILayout.Label($"Yaw now: {car.TargetYawRate:0.00} rad/s (executed)", GUILayout.Width(280));
            GUILayout.Label($"Ceiling throttle: {car.MaxYawThrottle:0.00} rad/s → radius {car.MinRadiusThrottle:0.0} m", GUILayout.Width(280));
            GUILayout.Label($"Ceiling lift-off:  {car.MaxYawLiftOff:0.00} rad/s → radius {car.MinRadiusLiftOff:0.0} m", GUILayout.Width(280));
            if (track != null)
            {
                float ahead = track.GetCornerRadiusAhead(car.transform.position, 60f);
                GUILayout.Label(ahead < 10000f ? $"Track radius ahead: {ahead:0} m" : "Track radius ahead: —", GUILayout.Width(280));
            }

            if (_appliedNote.Length > 0)
            {
                GUILayout.Space(4);
                GUILayout.Label("✓ " + _appliedNote, GUILayout.Width(280));
            }

            GUI.DragWindow(new Rect(0, 0, 10000, 20));
        }

        /// <summary>
        /// Labeled text field. Enter ALWAYS parses the current text and
        /// applies it (independent of whether the text changed this frame -
        /// the 2026-08-02 fix), then releases keyboard focus to the game.
        /// </summary>
        string Field(string label, string value)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label(label, GUILayout.Width(180));
            string next = GUILayout.TextField(value, GUILayout.Width(80));
            GUILayout.EndHorizontal();

            bool enter = Event.current.type == EventType.KeyDown && Event.current.keyCode == KeyCode.Return;
            if (enter && float.TryParse(next, NumberStyles.Float, CultureInfo.InvariantCulture, out float parsed))
            {
                ApplyField(label, parsed);
                GUI.FocusControl(null); // release keyboard back to the game
                _appliedNote = $"{label} = {F(parsed)}";
            }
            return next;
        }

        /// <summary>
        /// Apply the Car Definition GDD stat conversion (car-definition-data.md
        /// lines 186-254) for a uniform stat value: Top Speed, Acceleration,
        /// Brake Power, Grip Level (cornering_speed -&gt; maxLateralG using the
        /// oval's 70 m reference radius), Stability (control_threshold).
        /// Falloff end follows the car's own top speed so the steering
        /// minimum lands exactly at vmax (the prototype default of 324 km/h
        /// belongs to the tuning car, not to GDD cars).
        ///
        /// Engine power comes straight from the GDD 0-100 time (constant
        /// acceleration, no drag - the GDD does not model drag):
        /// enginePower = 27.78 / accelTime. The prototype's linearDamping
        /// would cap a GDD car below its vmax (observed 2026-08-02: the
        /// stat-20 car stuck at ~180 km/h with damping 0.28), so the preset
        /// sets a per-car damping whose terminal velocity sits 15% above
        /// vmax: damping = enginePower / (1.15 * vmax). The engine cap
        /// (forwardSpeed &lt; cap) stops the car exactly at vmax.
        /// </summary>
        /// <summary>
        /// Restore the prototype tuning car (the values the playtester
        /// calibrated by feel before the GDD presets existed): 324 km/h,
        /// 40 m/s^2 engine, 35 m/s^2 brake, 20 g grip, damping 0.28, falloff
        /// end at 324 km/h. Lets the playtester A/B the GDD stats against
        /// the feel-calibrated reference car.
        /// </summary>
        void ApplyProtoCar()
        {
            // Global steering knobs (user decision 2026-08-02): same values
            // as the 16 team cars.
            car.MaxSteerLow = 2.5f;
            car.MaxSteerHigh = 1.5f;
            car.LiftOffSteerBonus = 0.5f;
            car.MinTurnRadius = 10f;
            car.FalloffStartKmh = 60f;
            car.FalloffEndKmh = 324f * 0.99f; // 99% of own max speed
            car.FalloffShape = 1f;
            car.MaxSpeedMps = 324f / 3.6f;
            car.EnginePower = 40f;
            car.PowerPerMass = 1012f;
            car.DragCoeff = 0f;         // proto model: linear damping only
            car.LinearDamping = 0.28f;
            car.BrakePower = 35f;
            car.MaxLateralG = 20f;
            car.LiftOffGripBonus = 3f;
            car.ControlThreshold = 1f;
            car.SpeedCapKmh = 0f;
            RefreshFromCar();
            _appliedNote = "car proto (tuning): 324 km/h, 40 m/s2, P/m 1012, 20g, damp 0.28, steer knobs global";
        }

        /// <summary>
        /// Apply one of the 16 real teams (2026-08-02 roster): real engine
        /// P/m + real vmax + quadratic drag K = P/m/vmax^3 (the OPTION A
        /// physics validated on McLaren/Zakspeed), plus the team's own
        /// registry BR/GR/ST stats. Grip uses the user formula (2026-08-02):
        /// the car keeps flat-out on the 70 m oval up to gripHighPct (GR 20)
        /// of its own vmax, down to gripLowPct (GR 0), interpolated by GR.
        /// The new TS/AC stat values are recorded in the roster for display
        /// only - the physical values (P/m, vmax) are the real-engine source.
        ///
        /// STEERING KNOBS ARE GLOBAL (user decision 2026-08-02): maxSteerLow
        /// 2.5, maxSteerHigh 1.5, liftOff 0.5, minTurnRadius 10, falloffStart
        /// 60, falloffShape 1.0 - identical for all 16 cars. The only
        /// per-car steering value is falloffEnd = 99% of the car's own vmax
        /// (the steering minimum lands just below top speed). Car
        /// differentiation comes from vmax/grip/brake, not steering.
        /// </summary>
        void ApplyTeamCar(int i)
        {
            var (name, pm, vmax, br, gr, st, ts, ac) = TeamCars[i];
            // Global steering knobs (user decision 2026-08-02).
            car.MaxSteerLow = 2.5f;
            car.MaxSteerHigh = 1.5f;
            car.LiftOffSteerBonus = 0.5f;
            car.MinTurnRadius = 10f;
            car.FalloffStartKmh = 60f;
            car.FalloffEndKmh = vmax * 0.99f; // 99% of own max speed
            car.FalloffShape = 1f;
            // Real-engine physics.
            car.EnginePower = 13.5f;     // tire-limited traction (all cars)
            car.PowerPerMass = pm;
            car.MaxSpeedMps = vmax / 3.6f;
            car.DragCoeff = pm / Mathf.Pow(vmax / 3.6f, 3f);
            car.LinearDamping = 0f;      // quadratic drag replaces linear
            car.BrakePower = 55.56f * 55.56f / (2f * (30f + (20f - br) / 20f * 50f));
            // Grip (user formula 2026-08-02): % of the car's own vmax at
            // which the oval (70 m) is flat-out while accelerating.
            float.TryParse(_gripLowPct, NumberStyles.Float, CultureInfo.InvariantCulture, out float lowPct);
            float.TryParse(_gripHighPct, NumberStyles.Float, CultureInfo.InvariantCulture, out float highPct);
            float pct = (lowPct + (highPct - lowPct) * (gr / 20f)) / 100f;
            car.MaxLateralG = Mathf.Pow(pct * vmax / 3.6f, 2f) / 686.7f;
            float ovalLimitKmh = pct * vmax;
            car.ControlThreshold = st / 20f;
            car.LiftOffGripBonus = 3f; // FIXED g (user decision): same absolute tool for every car
            car.SpeedCapKmh = 0f;

            if (carVisual != null)
                carVisual.ApplyTeamColor(i);

            RefreshFromCar();
            _appliedNote = $"{name}: TS {ts} AC {ac} | P/m {pm:0}, vmax {vmax}, K {car.DragCoeff:0.000000}, grip {car.MaxLateralG:0.00}g ({pct * 100f:0}% => oval {ovalLimitKmh:0} km/h), brake {car.BrakePower:0.0}";
        }

        void ApplyAll()
        {
            if (float.TryParse(_maxSteerLow, NumberStyles.Float, CultureInfo.InvariantCulture, out float v1)) car.MaxSteerLow = v1;
            if (float.TryParse(_maxSteerHigh, NumberStyles.Float, CultureInfo.InvariantCulture, out float v2)) car.MaxSteerHigh = v2;
            if (float.TryParse(_liftOffBonus, NumberStyles.Float, CultureInfo.InvariantCulture, out float v2b)) car.LiftOffSteerBonus = v2b;
            if (float.TryParse(_minTurnRadius, NumberStyles.Float, CultureInfo.InvariantCulture, out float v3)) car.MinTurnRadius = v3;
            if (float.TryParse(_falloffStart, NumberStyles.Float, CultureInfo.InvariantCulture, out float v4)) car.FalloffStartKmh = v4;
            if (float.TryParse(_falloffEnd, NumberStyles.Float, CultureInfo.InvariantCulture, out float v5)) car.FalloffEndKmh = v5;
            if (float.TryParse(_falloffShape, NumberStyles.Float, CultureInfo.InvariantCulture, out float v6)) car.FalloffShape = v6;
            if (float.TryParse(_maxLateralG, NumberStyles.Float, CultureInfo.InvariantCulture, out float v7)) car.MaxLateralG = v7;
            if (float.TryParse(_liftOffGripBonus, NumberStyles.Float, CultureInfo.InvariantCulture, out float v7b)) car.LiftOffGripBonus = v7b;
            if (float.TryParse(_speedCap, NumberStyles.Float, CultureInfo.InvariantCulture, out float v8)) car.SpeedCapKmh = v8;
            if (float.TryParse(_driftFactor, NumberStyles.Float, CultureInfo.InvariantCulture, out float v8d)) car.DriftFactor = v8d;
            if (float.TryParse(_driftLookahead, NumberStyles.Float, CultureInfo.InvariantCulture, out float v8l)) car.DriftLookahead = v8l;
            if (float.TryParse(_driftHeadBoost, NumberStyles.Float, CultureInfo.InvariantCulture, out float v8h)) car.DriftHeadBoost = v8h;
            if (float.TryParse(_coastDecel, NumberStyles.Float, CultureInfo.InvariantCulture, out float v9)) car.CoastDecel = v9;
            if (float.TryParse(_deadStop, NumberStyles.Float, CultureInfo.InvariantCulture, out float v10)) car.DeadStopMps = v10;
            if (float.TryParse(_enginePower, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11)) car.EnginePower = v11;
            if (float.TryParse(_powerPerMass, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11b)) car.PowerPerMass = v11b;
            if (float.TryParse(_dragCoeff, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11f)) car.DragCoeff = v11f;
            if (float.TryParse(_grassGrip, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11c)) car.GrassGrip = v11c;
            if (float.TryParse(_grassDecel, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11d)) car.GrassDecel = v11d;
            if (float.TryParse(_grassTraction, NumberStyles.Float, CultureInfo.InvariantCulture, out float v11e)) car.GrassTraction = v11e;
            if (float.TryParse(_brakePower, NumberStyles.Float, CultureInfo.InvariantCulture, out float v12)) car.BrakePower = v12;
            if (float.TryParse(_maxSpeed, NumberStyles.Float, CultureInfo.InvariantCulture, out float v13)) car.MaxSpeedMps = v13 / 3.6f;
            if (float.TryParse(_controlThreshold, NumberStyles.Float, CultureInfo.InvariantCulture, out float v14)) car.ControlThreshold = v14;
            GUI.FocusControl(null);
            _appliedNote = "all fields applied";
        }

        void ApplyField(string label, float parsed)
        {
            switch (label)
            {
                case "Max steer low (rad/s)": car.MaxSteerLow = parsed; break;
                case "Max steer high (rad/s)": car.MaxSteerHigh = parsed; break;
                case "Lift-off bonus (rad/s)": car.LiftOffSteerBonus = parsed; break;
                case "Min turn radius (m)": car.MinTurnRadius = parsed; break;
                case "Falloff start (km/h)": car.FalloffStartKmh = parsed; break;
                case "Falloff end [Top Speed x0.99]": car.FalloffEndKmh = parsed; break;
                case "Falloff shape (1=lin)": car.FalloffShape = parsed; break;
                case "Engine traction [tire, all]": car.EnginePower = parsed; break;
                case "Grip (g) [Grip stat]": car.MaxLateralG = parsed; break;
                case "Lift-off grip (g) [fixed]": car.LiftOffGripBonus = parsed; break;
                case "Speed cap (km/h, 0=off)": car.SpeedCapKmh = parsed; break;
                case "Drift factor (1=off)": car.DriftFactor = parsed; break;
                case "Drift lookahead (m)": car.DriftLookahead = parsed; break;
                case "Drift head boost (x)": car.DriftHeadBoost = parsed; break;
                case "Coast decel (m/s2)": car.CoastDecel = parsed; break;
                case "Dead stop (m/s)": car.DeadStopMps = parsed; break;
                case "Power P/m [car data]": car.PowerPerMass = parsed; break;
                case "Drag coeff K [derived]": car.DragCoeff = parsed; break;
                case "Grass grip (mult)": car.GrassGrip = parsed; break;
                case "Grass decel (m/s2)": car.GrassDecel = parsed; break;
                case "Grass traction (mult)": car.GrassTraction = parsed; break;
                case "Brake power [Brake stat]": car.BrakePower = parsed; break;
                case "Max speed [Top Speed stat]": car.MaxSpeedMps = parsed / 3.6f; break;
                case "Control thr [Stability]": car.ControlThreshold = parsed; break;
            }
        }

        /// <summary>Re-read the car's current values into the text fields.</summary>
        void RefreshFromCar()
        {
            _maxSteerLow = F(car.MaxSteerLow);
            _maxSteerHigh = F(car.MaxSteerHigh);
            _liftOffBonus = F(car.LiftOffSteerBonus);
            _minTurnRadius = F(car.MinTurnRadius);
            _falloffStart = F(car.FalloffStartKmh);
            _falloffEnd = F(car.FalloffEndKmh);
            _falloffShape = F(car.FalloffShape);
            _maxLateralG = F(car.MaxLateralG);
            _liftOffGripBonus = F(car.LiftOffGripBonus);
            _speedCap = F(car.SpeedCapKmh);
            _driftFactor = F(car.DriftFactor);
            _driftLookahead = F(car.DriftLookahead);
            _driftHeadBoost = F(car.DriftHeadBoost);
            _coastDecel = F(car.CoastDecel);
            _deadStop = F(car.DeadStopMps);
            _enginePower = F(car.EnginePower);
            _powerPerMass = F(car.PowerPerMass);
            // K is ~0.001-0.0013: the generic F() rounds to 2 decimals and
            // would show "0", then Apply All would parse "0" back and KILL
            // the drag (observed 2026-08-02: real presets lost their power
            // curve after the panel round-trip). Format with 6 decimals.
            _dragCoeff = car.DragCoeff.ToString("0.000000", CultureInfo.InvariantCulture);
            _grassGrip = F(car.GrassGrip);
            _grassDecel = F(car.GrassDecel);
            _grassTraction = F(car.GrassTraction);
            _brakePower = F(car.BrakePower);
            _maxSpeed = F(car.MaxSpeedMps * 3.6f);
            _controlThreshold = F(car.ControlThreshold);
        }
    }
}
