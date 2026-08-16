// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-04

// PROTOTYPE - TEMPORARY telemetry sampler (gamepad validation session
// 2026-08-04). Appends car-state CSV rows to Temp/gamepad_log.csv while in
// play mode. Deleted after the validation is analyzed.
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.InputSystem;

namespace RaceFeel
{
    public class GamepadSampler : MonoBehaviour
    {
        ArcadeCar _car;
        System.Reflection.FieldInfo _throttleField;
        float _startTime;
        readonly StringBuilder _buffer = new StringBuilder(16384);
        int _frameSinceFlush;

        void Awake()
        {
            _car = FindFirstObjectByType<ArcadeCar>();
            _throttleField = typeof(ArcadeCar).GetField(
                "_throttleEma",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            _startTime = Time.time;
            try { File.WriteAllText(LogPath(), "t,speedKmh,steerRaw,steerEma,yaw,slip,sliding,throttleRaw,throttleEma,onGrass\n"); }
            catch (System.Exception e) { Debug.LogError("GamepadSampler: " + e.Message); }
        }

        void Update()
        {
            if (_car == null) return;

            float steerRaw = 0f;
            float throttleRaw = 0f;
            var gp = Gamepad.current;
            if (gp != null)
            {
                steerRaw = gp.leftStick.x.ReadValue();
                throttleRaw = gp.rightTrigger.ReadValue();
            }
            else
            {
                var kb = Keyboard.current;
                if (kb != null)
                {
                    if (kb.aKey.isPressed) steerRaw -= 1f;
                    if (kb.dKey.isPressed) steerRaw += 1f;
                    if (kb.wKey.isPressed) throttleRaw = 1f;
                }
            }

            float throttleEma = _throttleField != null
                ? (float)_throttleField.GetValue(_car)
                : 0f;

            _buffer.AppendFormat(
                "{0:F3},{1:F2},{2:F3},{3:F3},{4:F3},{5:F3},{6},{7:F3},{8:F3},{9}\n",
                Time.time - _startTime,
                _car.CurrentSpeedKmh,
                steerRaw,
                _car.VisualSteerInput,
                _car.TargetYawRate,
                _car.SlipRatio,
                _car.IsSliding ? 1 : 0,
                throttleRaw,
                throttleEma,
                _car.OnGrass ? 1 : 0);

            if (++_frameSinceFlush >= 60) Flush();
        }

        void OnDestroy()
        {
            Flush();
        }

        void Flush()
        {
            _frameSinceFlush = 0;
            if (_buffer.Length == 0) return;
            try { File.AppendAllText(LogPath(), _buffer.ToString()); }
            catch (System.Exception e) { Debug.LogError("GamepadSampler: " + e.Message); }
            _buffer.Clear();
        }

        static string LogPath()
        {
            return Path.Combine(Application.dataPath, "../Temp/gamepad_log.csv");
        }
    }
}
