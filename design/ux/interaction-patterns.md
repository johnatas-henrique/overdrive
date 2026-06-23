# Interaction Pattern Library

> **Status**: In Design
> **Author**: user + ux-designer
> **Last Updated**: 2026-06-22
> **Template**: Interaction Pattern Library

---

## Overview

This library defines the interaction vocabulary for Overdrive — how screens, HUD, and gameplay feedback respond to player actions and game events. It covers navigation, input, feedback, HUD display, pit stop, post-race, and loading patterns.

Patterns define **visual and behavioral responses** only. Key bindings are owned by the Input System (ADR-0006) and are remappable. A pattern works identically regardless of which physical button triggers the action.

---

## Pattern Catalog

### Navigation (8)

| Pattern                      | Screen / Flow                | One-line                                            |
| ---------------------------- | ---------------------------- | --------------------------------------------------- |
| Screen Stack                 | Menu LITE (all screens)      | Push/pop navigation, ESC returns to previous screen |
| Menu Grid Focus              | Car Select, Race Setup       | Directional focus between cards with highlight      |
| Global Confirm/Cancel        | All states (per GSM routing) | Primary/back action routed by GSM state             |
| Pause Overlay                | Racing → Paused              | Freezes simulation, overlay with Resume/Quit        |
| ESC Guard                    | Title Screen                 | ESC does nothing — prevents accidental exit         |
| Double-press Safety          | Title Screen                 | Second ENTER while transitioning is no-op           |
| Tab Bar / Section Navigation | Options screen               | Left sidebar tabs switch content area               |
| Confirmation Dialog          | Pause, destructive actions   | YES/NO prompt for irreversible actions              |

### Feedback (5)

| Pattern                     | Screen / Flow                         | One-line                                   |
| --------------------------- | ------------------------------------- | ------------------------------------------ |
| Camera Shake                | Gameplay (kerb, collision, off-track) | Brief shake proportional to impact         |
| Screen Transitions (Menu)   | Menu LITE (all pushes/pops)           | Instant transitions, no fade/slide         |
| Count-up Animation          | Results Screen                        | Position number animates 1→2→...→final     |
| State-Driven Event Feedback | All systems                           | Systems react to Event Bus, no polling     |
| Color as Information        | HUD (fuel, tire, alerts)              | Color communicates state, shape reinforces |

### Input (11)

| Pattern                | Screen / Flow               | One-line                                                   |
| ---------------------- | --------------------------- | ---------------------------------------------------------- |
| Analog Steering        | Gameplay (gamepad)          | -1 to 1 from left stick, dead zone applied                 |
| Digital Steering       | Gameplay (keyboard)         | A/D produce ±0.5, A+D=0                                    |
| Throttle/Brake         | Gameplay                    | Triggers 0-1 analog, W/S digital, brake overrides throttle |
| Gear Shift Pulse       | Gameplay                    | Discrete +1/-1 per press, 1 per tick max                   |
| Camera Toggle Debounce | Gameplay                    | Max 1 toggle per 200ms                                     |
| Device Switching       | All contexts                | HUD hints update on device change                          |
| Tab Blur Safety        | Web target                  | Inputs zeroed on tab blur, restored on focus               |
| Slider                 | Options (volume, dead zone) | Horizontal bar with numeric value, ◀▶ to adjust            |
| Toggle                 | Options (HUD, invert look)  | Binary ON/OFF switch, ENTER to toggle                      |
| Dropdown / Select      | Options (colorblind mode)   | List selector, ENTER opens, ▲▼ navigates                   |
| Input Remapping        | Options (Controls)          | Press key/button to rebind, ESC to cancel                  |

### HUD & Display (6)

| Pattern                     | Screen / Flow       | One-line                                              |
| --------------------------- | ------------------- | ----------------------------------------------------- |
| Speed Display               | HUD (Racing)        | km/h + gear, 20Hz update                              |
| Position Display            | HUD (Racing)        | P1-P8 + gap + lap, direct read from RM                |
| Resource Bars (Fuel / Tire) | HUD (Racing)        | Horizontal bars with flat colour shifts               |
| Countdown Lights            | Race start          | 5→1 sequential lights, 1s interval                    |
| Alert Block                 | HUD (Racing)        | Temporary notifications (pit ready, fuel empty, etc.) |
| Context-Sensitive Hints     | Loading, Pause, Pit | Shows correct key per active device                   |

### Pit Stop (2)

| Pattern                 | Screen / Flow    | One-line                                 |
| ----------------------- | ---------------- | ---------------------------------------- |
| Pit Overlay Replacement | Pit entry → exit | HUD replaced by service progress overlay |
| Pit Confirm Gate        | Pit service      | Confirm only enabled after tires done    |

### PostRace (3)

| Pattern            | Screen / Flow     | One-line                                                        |
| ------------------ | ----------------- | --------------------------------------------------------------- |
| Drone Camera Orbit | PostRace          | Camera orbits player car, confirm to skip                       |
| Results Screen     | PostRace          | Position count-up, time, rival reaction, Race Again / Main Menu |
| Race Again Flow    | Results → PreRace | Same config, no asset reload, no loading if cached              |

### Loading (2)

| Pattern                    | Screen / Flow     | One-line                                       |
| -------------------------- | ----------------- | ---------------------------------------------- |
| Loading Screen Minimum     | Menu → Race       | 0.5s minimum, skips entirely if loading < 0.5s |
| Loading to Race Transition | Loading → PreRace | Instant transition, grid camera + engine audio |

---

## Patterns

---

### Navigation

---

### Screen Stack

**Category**: Navigation
**Used In**: Menu LITE — Title, Car Select, Race Setup, Loading, Results

**Description**: O Menu LITE usa uma pilha de telas (push/pop). Cada transição de tela empurra a nova para o topo da pilha; ESC/B volta para a tela anterior (pop). A pilha garante que o estado das telas anteriores seja preservado ao voltar (ex: seleção de time mantida ao voltar de Race Setup).

**Specification**:

- Push: nova tela é adicionada ao topo da pilha e se torna ativa (`isVisible = true`).
- Pop: tela do topo é removida da pilha e a anterior reaparece (`isVisible = true`).
- Pop remove a tela do topo — não a esconde. Destroy/recreate não é necessário porque os controls são criados com `createOnce` (ADR-0019).
- Transição instantânea (sem fade/slide). A Loading screen serve como transição visual entre telas com operações longas.
- A pilha começa com Title Screen. Push adiciona ao topo. Pop nunca remove a última tela (Title).

**When to Use**: Qualquer fluxo de telas lineares ou hierárquicas onde o jogador pode voltar ao estado anterior.

**When NOT to Use**: Transições que mudam o estado do jogo (ex: Loading → Race não usa pop — é uma transição de GSM, não de navegação).

**Reference**: menu-lite.md AC#1–14, ADR-0019

---

### Menu Grid Focus

**Category**: Navigation
**Used In**: Car Select (grid 8), Race Setup (4 track cards)

**Description**: Navegação direcional entre cards em um grid. Setas do teclado / D-pad do gamepad movem o foco entre os cards. O card focado recebe highlight visual (borda na accent color). Confirm seleciona o card focado e avança para a próxima tela.

**Specification**:

- Foco move-se horizontalmente e verticalmente (setas / D-pad).
- Grid wrap em linhas: 4 cards por linha no Car Select, seta direita na coluna 4 vai para coluna 1 da mesma linha.
- Card focado: borda 2px na accent color do time, leve scale up (1.05×).
- Card selecionado: checkmark overlay, highlight persistente.
- Confirm no card focado = seleciona e avança. Confirm no card já selecionado = avança sem mudar seleção.
- A transição para a próxima tela só acontece se houver uma seleção ativa.

**When to Use**: Qualquer tela de seleção com múltiplas opções visuais (times, pistas, configurações).

**When NOT to Use**: Listas textuais longas — prefira scroll list com focus indicator simples.

**Reference**: menu-lite.md AC#2–7

---

### Global Confirm/Cancel

**Category**: Navigation
**Used In**: All Menu screens, PreRace (skip grid), Pit Stop (early exit), PostRace (skip drone / dismiss results)

**Description**: Duas ações globais (`confirm` e `cancel`) roteadas por GSM state. `confirm` executa a ação primária do estado atual. `cancel` volta ou abre pause. O roteamento é definido por tabela no Input GDD e nunca muda em runtime — cada estado sabe qual ação `confirm` executa.

**Specification**:

- `confirm` é um pulso digital (não hold). Disparado uma vez por pressão (edge-triggered).
- Roteamento por estado GSM:
  - `Menu` → ação primária da tela ativa (select, next, confirm choice).
  - `PreRace` → skip grid cinematic, `gsm.transition('Racing')`.
  - `Racing` → ESC/Start dispara pause (via `cancel`, não `confirm`).
  - `Paused` → `confirm` = resume, `cancel` = abre prompt de quit.
  - `PostRace` → skip drone, dismiss results.
- HUD nunca bloqueia `confirm` — o routing é do Input System, não do HUD.
- Exceção: Pit Stop — `confirm` só funciona se `tiresDone == true` (ADR-0014). Gatekeeping feito pelo Pit Stop system, não pelo Input.

**When to Use**: Toda ação primária do estado atual.

**When NOT to Use**: Ações secundárias (ex: abrir settings, toggle câmera) — devem usar ações dedicadas.

**Reference**: input.md, ADR-0006, ADR-0014, race-management.md

---

### Pause Overlay

**Category**: Navigation
**Used In**: Racing → Paused

**Description**: Durante Racing, ESC (keyboard) ou START (gamepad) pausa a corrida. A simulação congela e um overlay de pause aparece. O jogador pode resume ou quit.

**Specification**:

- ESC/START durante Racing → `gsm.transition('Paused')`.
- Paused → FixedUpdatePipeline para de executar os 8 slots. HUD permanece visível mas não atualiza.
- Paused → `confirm` (Resume) → `gsm.transition('Racing')`. Simulação descongela no mesmo estado.
- Paused → `cancel` (confirmado) → `endRace()` sem `race.completed`. GSM → Menu.
- Quit do pause NÃO conta como corrida completada — não gera resultados para progression.
- Overlay de pause mostra: "PAUSED" + Resume + Quit to Menu.
- Transição instantânea (sem fade) — o congelamento da simulação já comunica a pausa.

**When to Use**: Durante corrida ativa (`gsm.state = Racing`), quando jogador precisa interromper.

**When NOT to Use**: Durante transições de estado (PreRace, PostRace) — não há pause em cinematic ou resultados.

**Reference**: ADR-0024 (GSM Paused sub-state), input.md AC#10

---

### ESC Guard

**Category**: Navigation
**Used In**: Title Screen

**Description**: ESC no Title Screen não faz nada — não sai do jogo, não volta para tela anterior. Previne fechamento acidental.

**Specification**:

- ESC na Title Screen: no-op. Nenhum evento emitido.
- Se o jogo estiver em Tauri/Electron, ESC no Title não fecha a janela.
- A saída do jogo é feita via Quit no pause ou no Results screen.

**When to Use**: Tela inicial do jogo (Title), onde não há estado anterior para voltar.

**When NOT to Use**: Telas com estado anterior (Car Select, Race Setup) — ESC deve fazer pop.

**Reference**: menu-lite.md AC#14

---

### Double-press Safety

**Category**: Navigation
**Used In**: Title Screen

**Description**: Duas pressões rápidas de ENTER no Title não causam crash nem pulam telas. O segundo `confirm` é ignorado se a transição já estiver em andamento.

**Specification**:

- `confirm` no Title dispara `screenStack.push(CarSelect)`.
- Se a transição de tela já estiver em andamento (push em progresso), o segundo `confirm` é no-op.
- O Input state gerencia um flag `isTransitioning` que é limpo após a próxima tela ser exibida.
- Não há debounce de tempo — o flag de transição é a proteção.

**When to Use**: Telas onde uma ação dispara uma transição de tela não-instantânea.

**When NOT to Use**: Ações que devem ser repetíveis (ex: gear up/down).

**Reference**: menu-lite.md AC#15

---

### Feedback

---

### Camera Shake

**Category**: Feedback
**Used In**: Gameplay — kerb rumble, collisions, off-track

**Description**: A câmera treme brevemente em resposta a eventos de contato e colisão. A intensidade e duração variam conforme o tipo e magnitude do evento. Shake é visual apenas — não afeta a simulação.

**Specification**:

- Kerb rumble: < 1s, intensidade fixa baixa. Ativado quando qualquer roda do carro do jogador está sobre um kerb.
- Collision shake: proporcional ao `collisionImpulse` recebido. Decaimento exponencial. Apenas para o carro do jogador (ADR-0010).
- Off-track shake: breve (< 0.5s), intensidade fixa baixa. Ativado quando o carro do jogador sai da pista.
- Transição suave (não instantânea) — o shake decai, não corta abruptamente.
- Múltiplos shakes simultâneos: o de maior intensidade vence. Não acumulam.

**When to Use**: Qualquer contato físico significativo na perspectiva do jogador (kerb, colisão, saída de pista).

**When NOT to Use**: Eventos que não envolvem o carro do jogador (ex: colisão entre dois adversários distantes).

**Reference**: camera.md AC#4–6

---

### Screen Transitions (Menu)

**Category**: Feedback
**Used In**: Menu LITE — all screen pushes/pops

**Description**: Transições entre telas de menu são instantâneas — sem fade, slide ou qualquer animação. A Loading screen é a única transição visual entre estados longos. A escolha é deliberada (ADR-0019): menus devem responder imediatamente ao input do jogador, sem delays de animação.

**Specification**:

- `push` / `pop`: a tela de origem some instantaneamente (`isVisible = false`) e a tela de destino aparece (`isVisible = true`) no mesmo frame.
- Nenhum timer de animação entre telas de menu.
- A Loading screen serve como transição visual entre Menu → Race (tempo mínimo de 0.5s para feedback de progresso).
- A transição de GSM (Loading → PreRace) é instantânea do ponto de vista da UI — o 3D scene já foi carregado e está pronto.

**When to Use**: Todas as transições entre telas de menu (Title → Car Select → Race Setup → Loading → Results).

**When NOT to Use**: Transições de gameplay (Racing → PostRace) podem usar animações de câmera ou HUD — essas são coordenadas por eventos, não por transições de tela.

**Reference**: menu-lite.md #128, ADR-0019

---

### Count-up Animation

**Category**: Feedback
**Used In**: Results Screen — finish position

**Description**: A posição final do jogador é exibida como um número grande que anima em contagem crescente até o valor final. Ex: se o jogador terminou em P3, o número mostra 1 → 2 → 3 em rápida sucessão (~200ms por dígito) antes de fixar no resultado.

**Specification**:

- Contagem começa de 1 (não de 0).
- Velocidade: ~200ms por dígito. P3 = 400ms, P8 = 1.4s.
- A animação é acompanhada de um som de "tick" a cada dígito (se assets permitirem, ADR-0020).
- Após o número fixar, o resto do conteúdo da tela (tempo total, fastest lap, rival reaction) aparece instantaneamente.
- O efeito só ocorre na primeira exibição da Results screen — não repete em "Race Again".

**When to Use**: Resultado de corrida (posição final do jogador).

**When NOT to Use**: Qualquer outro número (velocidade, tempo, fuel level) — esses usam atualização direta.

**Reference**: menu-lite.md #121

---

### State-Driven Event Feedback

**Category**: Feedback
**Used In**: All systems — HUD, Audio, Camera

**Description**: Sistemas reativos (HUD, Audio, Camera) escutam eventos do Event Bus para mudar seu comportamento. Nenhum sistema faz polling de estado alheio. O GSM emite `gsm.state.exited` + `gsm.state.entered` a cada transição; sistemas de corrida emitem `race.*` events.

**Specification**:

- Sistemas NUNCA chamam `gsm.getCurrent()` — recebem o estado via evento (ADR-0024 Core Rule 3).
- Eventos de estado: `gsm.state.exited({ from: 'Loading', to: 'Menu' })`, `gsm.state.entered({ from: 'Loading', to: 'Menu' })`.
- Eventos de corrida: `race.starting`, `race.green.flag`, `race.light.countdown`, `race.checkered`, `race.completed`.
- HUD blocks escutam eventos para toggle de visibilidade (ex: Pit overlay substitui HUD quando `pit.status` muda).
- Audio troca música/BGM com crossfade de 500ms ao receber `gsm.state.entered` (ADR-0020).
- Camera alterna entre grid/cockpit/chase/drone ao receber `gsm.state.entered`.

**When to Use**: Toda mudança de estado que afeta mais de um sistema.

**When NOT to Use**: Dados por frame (speed, fuel level) — use leitura direta ou Event Bus throttled a 20Hz.

**Reference**: event-bus.md, ADR-0001, ADR-0024, ADR-0020

---

### Color as Information (Accessibility-Conscious)

**Category**: Feedback
**Used In**: HUD — fuel level, tire condition, position change, alerts

**Description**: Cores comunicam estado do jogo sem depender exclusivamente de ícones ou números (art-bible P2). Fuel verde → vermelho conforme diminui. Tire glow bands indicam temperatura. Position change flash verde (ganhou posição) / vermelho (perdeu). Paralelamente, formas e posições garantem que a informação não depende apenas de cor (accessibility Standard tier).

**Specification**:

- Fuel level: barra de 0–100%. **Flat colour shifts**: verde (#00FF00) até 30%, amarelo (#FFAA00) até 5%, vermelho puro (#FF0000) abaixo de 5%. Sem gradiente — a cor muda abruptamente nos thresholds (art bible Colour Rule #1: no gradients).
- Tire condition: barra de 0–100%. **Flat colour shifts**: branco (#FFFFFF) até 50%, amarelo (#FFAA00) até 20%, vermelho (#FF0000) abaixo de 20%. Sem gradiente.
- Position change: seta animada — verde + "▲" para cima, vermelho + "▼" para baixo. Duração 1.5s, fade out.
- Alertas (fuel empty, car ahead): ícone + cor de alerta + text label.
- **Accessibility**: nenhuma informação é transmitida APENAS por cor. Sempre acompanhada de forma, text label, ou posição (ex: fuel bar também tem valor numérico %).
- Colorblind mode (Standard tier): 3 presets (protanopia, deuteranopia, tritanopia) que trocam os hex values por substitutos distinguíveis.

**When to Use**: Qualquer indicador de estado que muda gradualmente (fuel, tire, position).

**When NOT to Use**: Informação binária (pit ready / not ready) — use icon + text label.

**Reference**: art-bible.md P2, accessibility-requirements.md, ADR-0018

---

### Input

---

### Analog Steering

**Category**: Input
**Used In**: Gameplay — car steering via gamepad left stick

**Description**: O steering é um valor analógico de -1 a 1 lido do gamepad left stick, com dead zone aplicada. Physics consome este valor diretamente no slot #2 do pipeline (ADR-0008). O ângulo de viragem real é derivado do grip model arcade (gripMax × steerInput), não de articulação de rodas.

**Specification**:

- Range: -1 (máximo à esquerda) a +1 (máximo à direita).
- Dead zone: 0.15 (configurável via tuning knob `input.deadZone`). Valores dentro da dead zone são zero.
- A leitura é polling-per-tick (slot #1), não event-driven — garante que Physics tenha o valor exato do frame (ADR-0002).
- HUD steering indicator: opcional, mostra o input bruto (não o ângulo resultante).

**When to Use**: Controle do carro via gamepad.

**When NOT to Use**: Navegação em menus — use direcional digital.

**Reference**: input.md AC#1, ADR-0006

---

### Digital Steering

**Category**: Input
**Used In**: Gameplay — car steering via keyboard

**Description**: Quando o teclado é o dispositivo ativo, as teclas A/D ou setas esquerda/direita produzem valores digitais de steering. A/D simultâneo produz zero steering (input.md AC#7).

**Specification**:

- A / ← = +0.5 (viragem suave, não abrupta).
- D / → = -0.5.
- A + D simultâneo = 0 (neutral).
- O valor digital é suavizado por um lerp de ~50ms para evitar snap instantâneo (transição gradual, não abrupta).

**When to Use**: Controle do carro via teclado (fallback quando gamepad não está conectado).

**When NOT to Use**: Gamepad conectado — prefira analog steering.

**Reference**: input.md AC#3, AC#7, ADR-0006

---

### Throttle/Brake

**Category**: Input
**Used In**: Gameplay — car speed control

**Description**: Throttle e brake lidos como valores 0–1. Gamepad: triggers direito (throttle) e esquerdo (brake) analógicos. Keyboard: W/↑ = throttle (0→1 instantâneo), S/↓ = brake (0→1 instantâneo). Ambos nunca são positivos simultaneamente — se ambos > 0, prevalece brake.

**Specification**:

- Gamepad triggers: range 0–1 analógico, dead zone 0.1.
- Keyboard: W/↑ = throttle 1.0 (digital). S/↓ = brake 1.0 (digital).
- Precedência: se brake > 0, throttle é ignorado (simulação de carro de corrida real).
- Physics consome throttle/brake no slot #2.
- HUD mostra input display opcional (barra de throttle/brake).

**When to Use**: Controle de velocidade do carro (gamepad ou teclado).

**When NOT to Use**: Qualquer outro contexto (menus, pit, pause).

**Reference**: input.md AC#2, ADR-0006

---

### Gear Shift Pulse

**Category**: Input
**Used In**: Gameplay — gear up/down

**Description**: Gear shift é um pulso discreto, não um estado. Cada pressão de gear up produz +1; gear down produz -1. Múltiplas pressões rápidas produzem no máximo 1 shift por tick (1/60s). Não há "hold to shift" automático.

**Specification**:

- Gear up = +1 por pulso. Gear down = -1 por pulso.
- Se o jogador pressionar gear up 3 vezes em 2 ticks, apenas 1 shift ocorre (1 por tick, AC#8).
- O pulso é consumido pelo Physics system, que aplica a troca de marcha no início do próximo tick.
- Não há limite de marcha no input — quem define os limites é o Physics system (marchas 1–N).

**When to Use**: Controle de marcha do carro.

**When NOT to Use**: Qualquer outra ação (confirm, cancel, menu navigation).

**Reference**: input.md AC#4, AC#8

---

### Camera Toggle Debounce

**Category**: Input
**Used In**: Gameplay — toggle cockpit/chase/drone

**Description**: O toggle de câmera tem debounce de 200ms para evitar trocas acidentais em pressões rápidas. Máximo 1 toggle a cada 200ms. O debounce é fixo em Phase 1 (não configurável pelo jogador).

**Specification**:

- Primeira pressão da tecla/botão de camera toggle → alterna para próxima câmera (cockpit → chase).
- Segunda pressão dentro de 200ms → ignorada.
- Após 200ms sem nova pressão → o toggle é rearmado.
- Ciclo: cockpit → chase → cockpit (sem drone em Phase 1, AC#2 do camera.md).
- O debounce é gerenciado pelo Input System, não pela Camera.

**When to Use**: Alternância entre modos de câmera.

**When NOT to Use**: Qualquer ação que precise de resposta imediata repetível.

**Reference**: input.md AC#9, camera.md AC#2

---

### Device Switching

**Category**: Input
**Used In**: All contexts — HUD control hints update on device change

**Description**: Quando o jogador alterna entre teclado e gamepad, o HUD atualiza os control hints para mostrar as teclas ou botões corretos (ex: "ENTER" vs "A"). A detecção é implícita — o último dispositivo que enviou input significativo se torna o "active device". O input em si não muda (confirm continua sendo confirm).

**Specification**:

- Detecção: qualquer input de um dispositivo diferente do atual muda o active device.
- HUD hints: textos de atalho são substituídos imediatamente (ex: "Press ENTER" → "Press A").
- Steering/throttle/brake continuam funcionando independente do dispositivo ativo para hints.
- O estado persiste enquanto houver input do mesmo dispositivo. Timer de inatividade não reseta — só outro dispositivo muda.
- Menu navigation não distingue dispositivo (input.md #131).

**When to Use**: Qualquer tela/HUD que mostre control hints (loading screens, pause menu).

**When NOT to Use**: O input em si — confirm/cancel/navigation não mudam com o dispositivo.

**Reference**: input.md #130, AC#13

---

### Tab Blur Safety

**Category**: Input
**Used In**: Web — tab focus/blur handling

**Description**: Quando o jogador muda de aba (tab blur), todos os inputs são zerados (steering = 0, throttle = 0, brake = 0). Quando volta (tab focus), os inputs retomam valores ao vivo após ler o estado atual do dispositivo. Previne carro desgovernado ao voltar de uma aba com tecla presa.

**Specification**:

- Tab blur (page visibility change / window blur): todos os valores do InputState são setados para 0.
- Tab focus: inputs retomam leitura ao vivo do device no próximo tick.
- Gear state mantém o valor atual (não reseta marcha).
- A transição blur → focus não produz spikes (o pipeline processa entradas zero por 1 tick antes de restabelecer).

**When to Use**: Web target (navegador). Não se aplica a Tauri (sem tab blur).

**When NOT to Use**: Desktop Tauri — não há conceito de tab blur.

**Reference**: input.md AC#5–6

---

### HUD & Display

---

### Speed Display

**Category**: HUD & Display
**Used In**: HUD Block — always visible (Must Show)

**Description**: Velocidade atual do carro em km/h, exibida como número grande. Atualizada a cada frame via leitura direta de Physics (Core Rule #1 exception do hud.md). Inclui marcha atual (formato ordinal: "3rd") e indicador de throttle/brake.

**Specification**:

- Número grande (fontSize 72px na referência 1920), monospace, branco.
- Marcha: número ordinal ("3rd", "4th") em texto menor abaixo ou ao lado.
- Sem unidade "km/h" — número é autoexplicativo.
- Throttle/brake indicator: barra horizontal fina (opcional), mostra input 0–100%.
- Update rate: **a cada frame** — leitura direta de `playerCar.physics.speedKmh`.
- Gear update rate: por evento (tick de Physics).
- Sem animação de transição entre valores — o número muda instantaneamente.

**When to Use**: Tela de corrida (Racing state).

**When NOT to Use**: Telas de menu, pause, pit overlay.

**Reference**: ADR-0018 (SpeedBlock), physics-handling.md

---

### Position Display

**Category**: HUD & Display
**Used In**: HUD Block — always visible (Must Show)

**Description**: Posição atual do jogador (3/8 — current/total), gap info (tempo para o carro da frente e para o líder), volta atual / total. Posição é o dado mais crítico do HUD — visível no canto superior direito.

**Specification**:

- Posição: "3/8" (posição atual / total de carros), branco, ~50px na referência 1920.
- Change indicator: ▲ ganhou, ▼ perdeu, — sem mudança. Sem número. Flash verde/vermelho com fade out em 1.5s.
- Gap info: duas linhas abaixo — "+1.2s →" (tempo para o carro da frente) e "+0.8s L" (tempo para o líder). Fonte menor (~24px), cinza claro.
- Volta: "LAP 3/5" (14px) no canto do bloco.
- Posição atualizada via Event Bus (`position.changed`). Hysteresis de 0.5m por 3 ticks antes de emitir (evita flicker P3↔P4, ADR-0015).
- Gap info e volta atualizados no mesmo evento.

**When to Use**: Tela de corrida (Racing state).

**When NOT to Use**: Pit overlay (replace), menu.

**Reference**: ADR-0015, ADR-0018, race-management.md

---

### Resource Bars (Fuel / Tire)

**Category**: HUD & Display
**Used In**: HUD Block — contextual (visível durante corrida, oculto no pit overlay)

**Description**: Fuel level (0–100%) e tire condition (0–100%) exibidos como barras horizontais com gradiente de cor conforme o pattern Color as Information.

**Specification**:

- Fuel: barra horizontal, altura ~40px. Gradiente verde (100%) → amarelo (30%) → vermelho (5%). Valor numérico "%" ao lado. Ícone ⛽ substitui label de texto.
- Tire: barra horizontal, altura ~40px. Gradiente branco (100%) → amarelo (50%) → vermelho (20%). Valor numérico "%" ao lado. Ícone ⚙ substitui label de texto.
- Ambas ocupam um bloco compartilhado (Fuel acima, Tire abaixo) na zona inferior do HUD.
- Update rate: a cada 3 ticks (~20Hz).
- Quando fuel < 5%: barra pisca em vermelho (500ms interval).
- Tire condition degrada por desgaste de pista + abrasão off-road (tire-wear.md).

**When to Use**: Tela de corrida.

**When NOT to Use**: Pit overlay (substitui o bloco por indicadores de serviço).

**Reference**: fuel.md, tire-wear.md, ADR-0018

---

### Countdown Lights

**Category**: HUD & Display
**Used In**: Race start — PreRace → Racing transition

**Description**: Cinco luzes sequenciais (5→4→3→2→1) antes do green flag. Cada luz acende com 1s de intervalo. Após a 5ª luz, green flag inicia a corrida. As luzes são exibidas no HUD como indicadores visuais.

**Specification**:

- 5 luzes horizontais (círculos, 24px diâmetro). Vermelhas quando apagadas, verdes quando acesas.
- Intervalo: 1s entre cada luz (`LIGHT_INTERVAL_TICKS = 60`, ADR-0015).
- Sequência: luz 1 acende → 1s → luz 2 acende → 1s → ... → luz 5 acende → `race.green.flag`.
- HUD escuta `race.light.countdown` (payload: `{ lightsOn: number }`) para atualizar as luzes.
- As luzes ocupam o centro superior do HUD durante os 5 segundos. Após green flag, somem (`isVisible = false`).
- Acompanhadas de som de "bip" a cada luz (ADR-0020). Green flag = som de aceleração + início da música de corrida.

**When to Use**: Transição PreRace → Racing (contagem regressiva).

**When NOT to Use**: Qualquer outro estado de jogo.

**Reference**: race-management.md, ADR-0015, ADR-0018, ADR-0020

---

### Alert Block

**Category**: HUD & Display
**Used In**: HUD Block — contextual, aparece e desaparece conforme eventos

**Description**: Notificações temporárias que aparecem no HUD para informar o jogador de eventos importantes: pit ready, fuel empty, car ahead/behind, position change. Cada alerta tem duração máxima e desaparece automaticamente.

**Specification**:

- Posição: zona central do HUD (abaixo das luzes de contagem), ou overlay no canto.
- Tipos de alerta:
  - "PIT READY" — quando o carro entra na zona de pit. Duração: permanente até pit exit.
  - "FUEL EMPTY" — quando fuel chega a 0%. Pisca vermelho. Duração: permanente até pit stop ou DNF.
  - "CAR AHEAD" / "CAR BEHIND" — quando a distância para o carro da frente/trás é < 1s. Duração 2s.
  - "+1 POS" / "-1 POS" — quando o jogador ganha/perde posição. Duração 1.5s com fade out.
- No máximo 2 alertas visíveis simultaneamente. Se um terceiro chega, o mais antigo é substituído.
- Texto em caixa alta, sans-serif, 16px.

**When to Use**: Durante corrida, para eventos que exigem atenção do jogador.

**When NOT to Use**: Informação passiva (fuel level, tire condition) — use resource bars.

**Reference**: ADR-0018 (AlertBlock), input.md, fuel.md, race-management.md

---

### Context-Sensitive Hints

**Category**: HUD & Display
**Used In**: Loading screens, pause menu, pit overlay

**Description**: Dicas de controle que mostram a tecla ou botão correto conforme o dispositivo ativo (Device Switching pattern). Aparecem em loading screens e pause menu — não durante a corrida (input.md #130).

**Specification**:

- Loading screen: "Press [ENTER/A] to start" no canto inferior.
- Pause overlay: "[ESC/B] Resume | [ESC hold/B hold] Quit" no canto inferior.
- Pit overlay: "[ENTER/A] Exit (after tires done)" no canto inferior.
- O texto do hint é atualizado automaticamente quando o device switching detecta mudança de dispositivo.
- Sem overlay durante Racing — o jogador já sabe os controles.

**When to Use**: Telas onde o jogador precisa saber qual botão pressionar (loading, pause, pit).

**When NOT to Use**: Durante corrida (Racing state) — o HUD não mostra hints.

**Reference**: input.md #130

---

### Pit Stop

---

### Pit Overlay Replacement

**Category**: Pit Stop
**Used In**: Pit entry → pit service → pit exit

**Description**: Quando o carro entra no pit lane, um painel semi-transparente centralizado aparece sobre o HUD de corrida mostrando o progresso do serviço: troca de pneus (binário, feito/não feito) e abastecimento (progressivo, 0–100%). O HUD de corrida permanece visível atrás do painel.

**Specification**:

- Ao entrar no pit lane (Pit Stop system detecta `isInPitEntryZone`): painel centralizado aparece sobre o HUD.
- O HUD de corrida NÃO é ocultado — permanece visível atrás do painel semi-transparente.
- Painel mostra: nome do time/equipe no topo, dois indicadores abaixo.
- Indicador de pneu: "TIRES" + status "DONE" (checkmark verde) ou "WORKING" (amarelo pulsando). Pneu é binário (ADR-0014).
- Indicador de combustível: "FUEL" + barra progressiva 0–100% + "%" numérico. Combustível é progressivo (ADR-0014).
- Quando pneu fica DONE e o jogador está em condição de sair (fuel parcial), o botão de exit aparece: "PRESS [ENTER/A] TO EXIT".
- AI drivers: nenhum overlay — o serviço acontece deterministicamente sem feedback visual.
- Ao sair do pit (pit exit zone): overlay desaparece, HUD blocks reaparecem.

**When to Use**: Sempre que o carro do jogador entra no pit lane.

**When NOT to Use**: Durante corrida normal (Racing, fora do pit).

**Reference**: pit-stop.md, ADR-0014, ADR-0018

---

### Pit Confirm Gate

**Category**: Pit Stop
**Used In**: Pit service → early exit

**Description**: O botão `confirm` (ENTER/A) para sair do pit antes do abastecimento completo só fica disponível DEPOIS que os pneus são trocados. Pneu é binário (troca completa de peça), combustível é progressivo (líquido enchendo). O jogador pode sair com combustível parcial assim que os pneus ficam prontos.

**Specification**:

- `confirm` no pit é bloqueado até que `tiresDone == true` (ADR-0014).
- Enquanto pneus não terminam, o overlay mostra "WAITING — TIRE CHANGE IN PROGRESS".
- Quando pneus terminam (`tiresDone = true`): botão de exit aparece no overlay (Context-Sensitive Hints pattern).
- Se o jogador sai cedo (antes do tanque cheio): fuel é setado para o nível atual (parcial). Não há penalidade.
- AI drivers: nunca saem cedo — esperam ambos os serviços completarem (ADR-0014).
- Se o jogador não pressiona nada: o carro espera o tanque encher + `exitGraceTimeout` (3s) e sai automaticamente.

**When to Use**: Durante pit stop, quando o jogador está sendo servido.

**When NOT to Use**: Fora do pit stop.

**Reference**: pit-stop.md, ADR-0014

---

### PostRace

---

### Drone Camera Orbit

**Category**: PostRace
**Used In**: PostRace state — camera orbits player car

**Description**: Após a corrida terminar, a câmera transiciona para um modo drone que orbita o carro do jogador. O jogador pode assistir o replay da última ação ou pular para os resultados. A câmera usa ArcRotateCamera (ADR-0007) com input limpo, orbitando suavemente ao redor do carro.

**Specification**:

- Ao receber `gsm.state.entered` com `to: PostRace` → camera transiciona para drone orbit.
- Drone: ArcRotateCamera, alpha orbitando 360° ao redor do carro, beta fixo (ângulo superior), target = posição do carro do jogador.
- Velocidade de órbita: 1 volta completa a cada 15s.
- O drone não aceita input do jogador (`camera.inputs.clear()` + `inertia = 0`, ADR-0007).
- Se o jogador pressionar `confirm`: skip drone, mostra Results screen.
- Duração máxima da órbita: 30s. Após 30s sem input, transiciona automaticamente para Results.

**When to Use**: Após qualquer corrida (Checkered ou DNF do jogador).

**When NOT to Use**: Durante corrida (Racing), menu.

**Reference**: camera.md AC#9-10, ADR-0007

---

### Results Screen

**Category**: PostRace
**Used In**: PostRace state — after drone skip or timeout

**Description**: Tela de resultados exibe posição final, tempo total, fastest lap e rival reaction text. A posição usa Count-up Animation pattern. O jogador pode escolher "Race Again" (volta ao PreRace com seleções preservadas) ou "Main Menu" (volta ao Title).

**Specification**:

- Posição final: número grande com count-up (1 → 2 → ... → P3, ~200ms/dígito). Após fixar, rival reaction text aparece em itálico.
- Tempo total: monospace, formato MM:SS.mmm.
- Fastest lap: monospace, mesmo formato, apenas se o jogador fez a volta mais rápida.
- Rival reaction text: 1 linha em itálico, varia por rival e posição (mín. 2 variantes por rival).
- Dois botões: "RACE AGAIN" (confirm) e "MAIN MENU" (cancel).
- Race Again: GSM → PreRace. Car/track selections preservadas (não volta ao Car Select).
- Main Menu: GSM → Menu (Title).

**When to Use**: Após drone camera (ou imediatamente se o jogador skipou o drone).

**When NOT to Use**: Durante corrida, pause.

**Reference**: menu-lite.md #121, AC#11-13, ADR-0019

---

### Race Again Flow

**Category**: PostRace
**Used In**: Results → PreRace transition

**Description**: "Race Again" preserva as seleções atuais (carro, pista) e reinicia a sequência de corrida sem passar pelas telas de seleção. O jogador vai direto para a grid. A configuração de corrida (dificuldade, voltas) também é preservada.

**Specification**:

- Race Again no Results screen → `gsm.transition('PreRace')` (menu-lite.md AC#12).
- A RaceConfiguration atual (carSelected, trackSelected, difficulty, laps) é reutilizada.
- Não há reload de assets — o container dos carros e o track já estão em memória (ADR-0003).
- O Loading screen aparece brevemente (mín. 0.5s, idealmente zero) para resetar o estado da simulação.
- Se o jogador quer mudar de carro/pista: "Main Menu" → Title → novo fluxo de seleção.

**When to Use**: Quando o jogador quer repetir a mesma corrida com a mesma configuração.

**When NOT to Use**: Quando o jogador quer mudar de carro, pista ou configuração.

**Reference**: menu-lite.md AC#12, ADR-0019

---

### Loading

---

### Loading Screen Minimum

**Category**: Loading
**Used In**: Menu → Race transition, Race Again

**Description**: A Loading screen aparece apenas quando estritamente necessário — carregamento inicial de assets ou reset da simulação entre corridas. A meta é remover completamente a loading screen: com AssetContainers em cache (ADR-0003), Race Again não precisa de I/O. Se o carregamento for instantâneo, a loading screen dura **0.5s** no mínimo (apenas para evitar flash). Se for mais rápida que 0.5s, não aparece.

**Specification**:

- Conteúdo: track name (grande, centro), loading tip (menor, abaixo), opcional: som de motor ambiente.
- Duração mínima: **0.5s**. Se o carregamento levar menos que 0.5s, a loading screen não aparece — a transição é direta para PreRace.
- Race Again: sem loading screen se os assets já estão em memória. Reset da simulação é síncrono (< 16ms).
- Primeira corrida (após Title): pode precisar de loading real (assets do disco/rede). Loading screen aparece e dura o tempo real de carregamento.
- Se o carregamento falhar: mostra erro + "Returning to menu." + `gsm.transition('Menu')`.

**When to Use**: Primeira corrida da sessão (assets não cacheados). Race Again idealmente nunca usa.

**When NOT to Use**: Transições de menu que não envolvem carregamento.

**Reference**: ADR-0003, ADR-0019

---

### Loading to Race Transition

**Category**: Loading
**Used In**: Loading → PreRace (grid cinematic)

**Description**: Quando o carregamento termina (assets carregados + mínimo 0.5s), a Loading screen é substituída pela grid cinematic do PreRace. A transição é instantânea (Loading screen some, grid camera aparece). Nenhum fade.

**Specification**:

- Loading completou + mínimo 0.5s → `gsm.requestTransition('PreRace')`.
- A Loading screen some instantaneamente (`isVisible = false`).
- O GSM emite `gsm.state.exited({ from: 'Loading', to: 'PreRace' })` e `gsm.state.entered({ from: 'Loading', to: 'PreRace' })`.
- Camera: transiciona para o grid camera posicionado à frente do primeiro carro (camera.md AC#7-8).
- Audio: menu music crossfade (500ms) para motor ambiente + grid cinematic (ADR-0020).
- Após 8 segundos (ou confirm), PreRace → Racing inicia a corrida com countdown lights.

**When to Use**: Única — entre a Loading screen e a grid de largada.

**When NOT to Use**: Diretamente de menu para corrida sem loading (não é o caso na primeira corrida).

**Reference**: game-state-machine.md, ADR-0024, ADR-0020

---

### Tab Bar / Section Navigation

**Category**: Navigation
**Used In**: Options screen — Audio / Controls / Accessibility section switching

**Description**: Left sidebar with vertical tab list. Selecting a tab replaces the content area to the right. Active tab highlighted with accent colour.

**Specification**:

- Left sidebar: vertical list of section names (Audio, Controls, Accessibility).
- Active tab: accent colour text + left border indicator.
- Content area: replaces on tab selection (instant swap, no crossfade).
- Only one tab active at a time.
- MVP contains exactly 3 tabs: Audio, Controls, Accessibility. Video tab added post-MVP.

**When to Use**: Settings screens with distinct categories of options.

**When NOT to Use**: Single-category settings, navigation between different screens (use Screen Stack).

**Accessibility**: Tab roles with ARIA `tablist` / `tab` pattern. Section content labelled by `aria-labelledby`. Keyboard: ▲ ▼ between tabs, ENTER/A to activate.

**Reference**: options.md, ADR-0019

---

### Slider

**Category**: Input
**Used In**: Options — volume controls, dead zone adjustment

**Description**: Horizontal slider bar with variable range. Current value shown as numeric label. Adjusted by ◀ ▶ arrows or D-pad left/right.

**Specification**:

- Range: min–max with defined step (e.g. 0–100% step 1, or 0.0–0.5 step 0.05).
- Visual: filled portion of track in accent colour, empty portion in muted grey.
- Handle: 12px circle on track.
- Value label: numeric percentage or decimal shown next to slider.
- Update: immediate — no confirm required.
- Interaction: ◀ decrements, ▶ increments by one step. D-pad left/right equivalent.

**When to Use**: Numeric settings with a continuous or discrete range.

**When NOT to Use**: On/off settings (use Toggle). Multi-choice settings (use Dropdown).

**Accessibility**: ARIA `slider` role with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`. Keyboard: ◀ ▶ to adjust. Value label updates on each step.

**Reference**: options.md, ADR-0016

---

### Toggle

**Category**: Input
**Used In**: Options — Simplified HUD, Invert look

**Description**: Binary on/off switch. Single ENTER/A press toggles state. Visual: filled (ON, accent colour) vs empty (OFF, muted grey).

**Specification**:

- Two states: ON / OFF. Visual indicators: filled accent bar (ON) vs empty muted bar (OFF).
- Toggle on ENTER/A press only — no hold or double-press.
- State label shows current value ("ON" / "OFF").
- Update: immediate.

**When to Use**: Binary settings (enable/disable a feature).

**When NOT to Use**: Multi-value settings (use Dropdown or Slider).

**Accessibility**: ARIA `switch` role with `aria-checked`. Keyboard: ENTER/A to toggle.

**Reference**: options.md

---

### Dropdown / Select

**Category**: Input
**Used In**: Options — Colorblind mode selector

**Description**: Dropdown list showing currently selected value. ENTER/A opens the dropdown, ▲ ▼ navigates options, ENTER/A selects and closes.

**Specification**:

- Closed state: shows currently selected value with ▼ indicator.
- Open state: list of options overlays the dropdown. Selected option highlighted.
- Selection: ENTER/A on option → dropdown closes, value updates immediately.
- Cancel: ESC closes dropdown without changing selection.
- Single-select only (no multi-select in MVP).

**When to Use**: Settings with 3+ mutually exclusive options.

**When NOT to Use**: Two options only (use Toggle). 10+ options (consider list with scroll).

**Accessibility**: ARIA `combobox` pattern with `aria-expanded`, `aria-controls`, `aria-activedescendant`. Keyboard: ▲ ▼ in open state, ENTER to select, ESC to cancel.

**Reference**: options.md

---

### Input Remapping

**Category**: Input
**Used In**: Options — Controls section

**Description**: Interactive key/button rebinding. Player selects a control action, presses a new key or button, and the binding updates immediately.

**Specification**:

- Default state: shows current binding text (e.g. "Left stick", "W").
- Capture mode: player selects "Change" → text becomes "Press key/button..." → system waits for input.
- On key/button press: binding updates immediately. Text shows new binding name.
- Cancel: ESC during capture mode restores previous binding. Capture mode exits without change.
- Conflict resolution: last-assigned wins. If the newly pressed key was bound to another action, that action reverts to its default binding. A brief "Conflict: [action] reassigned" indicator appears.
- Protected bindings: Pause, Confirm, Cancel cannot be unbound (minimum navigation guarantee). If player attempts to unbind one, the binding is ignored and a "UI error" sound plays.
- Binding display: gamepad buttons show console-style names ("A", "LB", "RT"). Keyboard keys show key names ("W", "ENTER", "ESC").

**When to Use**: Settings screen where player can customize controls.

**When NOT to Use**: During gameplay. Post-MVP per-profile remapping or per-car presets.

**States**: Default (shows binding) → Capture (listening) → Cancelled (reverted) → Complete (updated).

**Accessibility**: Capture mode must have a clear visual indicator (text change + optional border glow). ESC cancel must be discoverable. Timer hazard: capture mode has no timeout — player can stay in "Press key..." indefinitely.

**Reference**: options.md, ADR-0006

---

### Confirmation Dialog

**Category**: Navigation
**Used In**: Pause overlay (Quit confirm), any destructive action

**Description**: Two-button prompt for destructive or irreversible actions. Presents the action label and YES/NO options.

**Specification**:

- Content: action label ("ABANDON RACE?") + two buttons: YES (destructive, caution colour) and NO (default focus, neutral).
- Default focus: NO — requires deliberate selection of YES.
- Navigation: ▲ ▼ or ◀ ▶ between YES and NO. ENTER/A selects focused option.
- ESC = NO (same behaviour: cancels, returns to previous state).
- Background: semi-transparent overlay (same as pause). Buttons replace the previous screen's content.

**When to Use**: Any action that is irreversible (quit race, delete data, abandon progress).

**When NOT to Use**: Non-destructive actions (screen navigation, settings changes that auto-save).

**States**: Hidden → Visible (buttons replace previous content) → YES (action) or NO (return).

**Accessibility**: Focus on NO by default. Clear visual distinction between YES and NO. Colour is secondary to text label (YES uses caution colour but also reads "YES", not just red).

**Reference**: pause.md, interaction-patterns.md (Double-press Safety), ADR-0019

---

## Sound Standards

Tabela de referência dos sons definidos nos patterns. Sons são gerenciados pelo Audio Engine (ADR-0020) e referenciados pelos patterns individuais.

| Sound                     | Context                           | Trigger                                  | Duration                              | Notes                                                      |
| ------------------------- | --------------------------------- | ---------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **Countdown beep**        | Race start                        | Cada luz countdown acende                | ~500ms, 440Hz, agudo                  | 5 beeps, 1s interval. Sync com `race.light.countdown`      |
| **Green flag horn**       | Race start                        | 5ª luz → green flag                      | ~300ms                                | Som de largada. Sync com `race.green.flag`                 |
| **Menu confirm**          | Menu navigation                   | ENTER/A em qualquer botão                | ~100ms                                | Click curto, feedback de ação confirmada                   |
| **Menu back**             | Menu navigation                   | ESC/B                                    | ~80ms                                 | Som sutilmente diferente do confirm                        |
| **Menu focus change**     | Menu navigation                   | ▲ ▼ ◀ ▶ move focus                       | ~50ms                                 | Tick suave — opcional, só se o timing responder sem delay  |
| **Count-up tick**         | Results screen                    | Cada dígito do count-up de posição       | ~80ms                                 | Tick seco, sincronizado com a animação                     |
| **Accident / collision**  | Gameplay (collision)              | Colisão com impulso ≥ `shakeMinImpulse`  | ~150ms                                | Som de impacto metálico, proporcional à força              |
| **Kerb rumble**           | Gameplay (off-road)               | Carro sobre kerb                         | Sustained enquanto sobre kerb         | Som de vibração/estalo seco                                |
| **Pit stop engine start** | Pit exit                          | Confirm exit → departure                 | ~200ms                                | Motor liga para sair do box                                |
| **Pit stop engine idle**  | Pit service                       | Carro parado no pit (pitStopped)         | Loop                                  | Motor em marcha lenta durante serviço                      |
| **Fuel pump sound**       | Pit service                       | Serviço de reabastecimento ativo         | Loop (desliga quando serviço termina) | Som de bomba de combustível, baixo volume, ambiente        |
| **Critical alert**        | Gameplay (fuel < 10%, tire ≤ 20%) | Recurso atinge nível crítico             | ~500ms                                | Som de alerta curto, uma vez por entrada em estado crítico |
| **DNF horn**              | PostRace (DNF)                    | RM emite DNF para o jogador              | ~1s                                   | Tom descendente, som de derrota                            |
| **Race win jingle**       | PostRace (P1)                     | Jogador termina em primeiro              | ~3s                                   | Pequeno jingle de vitória. Acesso via menu-lite.md         |
| **UI error**              | Options (remapping conflict)      | Tentativa de unbinding de ação protegida | ~150ms                                | Buzina curta — "não permitido"                             |

**Volume hierarchy**: SFX bus controls all gameplay sounds. Menu sounds are on UI bus. Music bus unaffected.

**Cutoff & prioritization**: No more than 3 simultaneous SFX sounds. Newest wins — oldest is cut if priority is equal. Engine sounds have highest priority, then collision, then UI.

---

---

## Animation Standards

| Context                             | Transition Type                     | Duration                   | Easing       | Notes                                                    |
| ----------------------------------- | ----------------------------------- | -------------------------- | ------------ | -------------------------------------------------------- |
| **Menu screen push/pop**            | Instant (`isVisible` toggle)        | 0ms                        | None         | All menu transitions are instant per ADR-0019            |
| **Loading → PreRace**               | Instant (scene swap behind Loading) | 0ms                        | None         | Loading stays visible until scene ready                  |
| **Position count-up (Results)**     | Tick animation, ~200ms per digit    | Varies (1–8 digits)        | Linear       | One-time, entry only                                     |
| **Slow-motion (checkered)**         | Pipeline dt halved to 50%           | 0.3s                       | None         | Post-checkered only. Camera untouched.                   |
| **Freeze frame (checkered)**        | Pipeline paused. Overlay appears.   | 0.5s                       | None         | "CHEQUERED FLAG" fades out in last 0.2s                  |
| **Drone camera orbit**              | ArcRotateCamera alpha change        | 0.5s transition, 15s/orbit | Linear orbit | Camera lerps from active to drone position in first 0.5s |
| **Pause enter/exit**                | Instant (`isVisible` toggle)        | 0ms                        | None         | No fade — must feel immediate                            |
| **Pit overlay enter/exit**          | Instant (`isVisible` toggle)        | 0ms                        | None         | Immediate feedback at pit stop                           |
| **Fuel/Tire bar fill**              | Smooth bar fill per update          | Per 1/60s update           | None         | Updated each physics tick during service                 |
| **Critical bar pulse (fuel/tire)**  | Colour shift between normal ↔ red   | 0.5s cycle                 | Square wave  | Only while below critical threshold                      |
| **Position change arrow fade**      | Alpha 1.0 → 0.0                     | 1.5s                       | Linear       | Triggered on `position.changed`                          |
| **Countdown lights**                | Circle colour red → green           | Instant per light          | None         | 1s interval between lights                               |
| **Alert block**                     | Instant appear / dismiss            | 0ms                        | None         | Max 2 simultaneous, FIFO queue                           |
| **Quit confirm → PostRace**         | Brief delay before state change     | ~500ms                     | None         | Prevents accidental quit from feeling instant            |
| **Camera toggle (cockpit ↔ chase)** | Camera lerp position + target       | 200ms                      | Linear       | Triggered by camera toggle                               |

**Design principle**: Menu and overlay transitions are instant (0ms) — no fade, no slide, no crossfade. Gameplay animations (slow-motion, drone orbit, count-up) use linear timing with no easing. Camera transitions are the only lerp-based animations. Mechanical, not smooth — reinforces arcade feel.

---

---

## Open Questions

[To be designed]
