import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";

export const CreateSceneGUI = async (scene: Scene): Promise<void> => {
  if (scene.getEngine().name === "WebGPU") {
    await import("@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture");
  }

  const adt = AdvancedDynamicTexture.CreateFullscreenUI("ui");
  adt.rootContainer.scaleX = window.devicePixelRatio;
  adt.rootContainer.scaleY = window.devicePixelRatio;

  const title = new TextBlock("title", "Overdrive");
  title.color = "white";
  title.fontSize = 24;
  title.top = "-40%";
  title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  adt.addControl(title);

  const fpsText = new TextBlock("fps", "");
  fpsText.color = "lime";
  fpsText.fontSize = 14;
  fpsText.top = "-45%";
  fpsText.left = "45%";
  fpsText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  adt.addControl(fpsText);

  scene.getEngine().onEndFrameObservable.add(() => {
    fpsText.text = `FPS: ${scene.getEngine().getFps().toFixed(0)}`;
  });

  const panel = new StackPanel("panel");
  panel.top = "20%";
  adt.addControl(panel);

  const btn = Button.CreateSimpleButton("actionBtn", "Click Me");
  btn.width = "120px";
  btn.height = "40px";
  btn.color = "white";
  btn.background = "green";
  btn.onPointerUpObservable.add(() => {
    title.text = "Button Clicked!";
    title.color = "yellow";
    setTimeout(() => {
      title.text = "Overdrive";
      title.color = "white";
    }, 1500);
  });
  panel.addControl(btn);
};
