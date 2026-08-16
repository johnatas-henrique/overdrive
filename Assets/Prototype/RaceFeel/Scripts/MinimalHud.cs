// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01

using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Minimal HUD for the prototype: speed, lap, countdown, and lap times.
    /// Uses OnGUI (IMGUI) — adequate for a prototype, not production UI.
    /// Text sits on dark semi-transparent panels for contrast against any sky.
    /// </summary>
    public class MinimalHud : MonoBehaviour
    {
        [SerializeField] RaceFeelController controller;
        [SerializeField] ArcadeCar car;

        GUIStyle _bigStyle;
        GUIStyle _smallStyle;
        GUIStyle _panelStyle;

        void Start()
        {
            if (controller == null) controller = FindFirstObjectByType<RaceFeelController>();
            if (car == null) car = FindFirstObjectByType<ArcadeCar>();
        }

        void OnGUI()
        {
            if (controller == null) return;

            _bigStyle ??= new GUIStyle(GUI.skin.label)
            {
                fontSize = 42,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };
            _smallStyle ??= new GUIStyle(GUI.skin.label)
            {
                fontSize = 20,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = Color.white }
            };
            // Dark panel behind text: readable over any sky/background.
            if (_panelStyle == null)
            {
                var tex = new Texture2D(1, 1);
                tex.SetPixel(0, 0, new Color(0f, 0f, 0f, 0.65f));
                tex.Apply();
                _panelStyle = new GUIStyle { normal = { background = tex } };
            }

            // Top center: speed
            var speedRect = new Rect(Screen.width / 2f - 110, 16, 220, 58);
            GUI.Box(speedRect, GUIContent.none, _panelStyle);
            GUI.Label(speedRect,
                car != null ? $"{car.CurrentSpeedKmh:F0} km/h" : "—", _bigStyle);

            // Top left: lap + time (3 rows, each on its own panel)
            var lapRect = new Rect(16, 16, 320, 30);
            GUI.Box(lapRect, GUIContent.none, _panelStyle);
            GUI.Label(lapRect,
                $"Lap {controller.CurrentLap}/{controller.TotalLaps}", _smallStyle);

            var curRect = new Rect(16, 50, 320, 30);
            GUI.Box(curRect, GUIContent.none, _panelStyle);
            GUI.Label(curRect,
                $"Cur {controller.CurrentLapTime:F2}s", _smallStyle);

            string bestText = controller.BestLapTime < float.MaxValue
                ? $"{controller.BestLapTime:F2}s"
                : "--";
            var lastRect = new Rect(16, 84, 320, 30);
            GUI.Box(lastRect, GUIContent.none, _panelStyle);
            GUI.Label(lastRect,
                $"Last {controller.LastLapTime:F2}s", _smallStyle);

            var bestRect = new Rect(16, 118, 320, 30);
            GUI.Box(bestRect, GUIContent.none, _panelStyle);
            GUI.Label(bestRect,
                $"Best {bestText}", _smallStyle);

            // Center overlay during countdown/finish
            switch (controller.CurrentState)
            {
                case RaceFeelController.State.Countdown:
                    var cdRect = new Rect(Screen.width / 2f - 160, Screen.height / 2f - 70, 320, 140);
                    GUI.Box(cdRect, GUIContent.none, _panelStyle);
                    GUI.Label(cdRect,
                        controller.CountdownRemaining > 0f
                            ? Mathf.CeilToInt(controller.CountdownRemaining).ToString()
                            : "GO!", _bigStyle);
                    break;
                case RaceFeelController.State.Finished:
                    var finRect = new Rect(Screen.width / 2f - 210, Screen.height / 2f - 70, 420, 140);
                    GUI.Box(finRect, GUIContent.none, _panelStyle);
                    GUI.Label(finRect,
                        $"FINISH — {controller.FinishTime:F2}s", _bigStyle);
                    break;
            }
        }
    }
}
