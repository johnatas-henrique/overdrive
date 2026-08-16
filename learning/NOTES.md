# NOTES — Teaching preferences and observations

- User has NO drawing/art background (38yo, partially blind earlier in life). Never assume visual intuition: teach via objective criteria, measurable values, and empirical tests. (2026-08-06)
- The question that defined the teaching method: "tem jeito de tirarmos a prova disso?" — proof-first mindset: every style claim must be verifiable (checklist + tools), never asserted on trust.
- User distrusts "trust me" — always respond with evidence (file:line, tool output, empirical results).
- Language: conversation in Brazilian Portuguese; ALL persistent files in English (project rule #1422).
- Mission scope (2026-08-06): 3D models (from scratch + restyling), images, and AI cutscenes (video) for Overdrive, all conforming to the art bible style. PBR→NPR was the user's initial (partial) framing — the real goal is asset production, NPR is one technique inside it.
- First deliverable chosen by user: fundamentals (style hierarchy + conformance verification), before any tooling lesson.
- Lesson style: short lessons with a tangible win; case studies from the user's own outputs work best (e.g., the 93 Krea2 car images).
- Generated images live in E:\ComfyUI\ComfyUI-Easy-Install\ComfyUI\output (WSL: /mnt/e/...) — a dumping ground (mix of project cars + unrelated experiments: wolfman, monster, perfume, tower). Only conforming references get copied into the repo (design/art/reference/generated/).
- Session model limitation: deepseek-v4-flash cannot see images — visual checks delegate to the vision subagent; programmatic color checks need Pillow (WSL python lacks it; the ComfyUI python is a Windows .exe — use pip install pillow in WSL or powershell.exe python when needed).
- Vision-agent conformance check of the 93 images (2026-08-06): mostly NEARLY CONFORMS; systematic issues: text/logos on tires & cockpit, carbon-fiber texture realism, smooth gradients (not hard cel), unpinned livery in cockpit prompts. Two images generated completely wrong liveries — empirical proof that prompts don't guarantee style.
