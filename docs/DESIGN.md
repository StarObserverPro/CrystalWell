# Crystal Well — gameplay contract (v0.5)

The [v0.5 revision](V05-DRAGON-SEA-OPTICS.md) supersedes older visual/layout details. The approved external dragon is fitted from its face core and has weighted neck articulation, color zoning and a synchronized collision proxy. A horizontal magical sea intersects the head; the lower body is not artificially cut off. Ball display size expresses depth without changing its collision radius. The closest 384 exposed crystal bricks can use limited screen-space refraction; mobile HUD overlays a full-height scene. Scoring, three lives, powerups and the 26-crystal rim remain unchanged.

## Player-facing experience

Almost no explanatory text. All visible buttons, numbers, life crystals, progress clusters, effect symbols and portrait prompt are three-dimensional models. Transparent DOM controls exist for accessibility and input only. No fine outlines, wireframes or SVG HUD.

Desktop and phone landscape only. The primary orthographic camera is tilted 20° from vertical and rotates once in 240 seconds. The secondary perspective camera stays orthogonal and updates at 18 Hz desktop / 14 Hz touch. Main view controls the shield; side view supplements depth. Ball heat color encodes distance from the opening, not camera distance.

## Space and collisions

The well radius is 9.72. A 20×20 grid clipped to radius 9.1 holds eight vertical crystal layers: 1,926 occupied cells, including many radial layers. The front (-Y) has a connected, multi-height notch. This is a filled cylinder, not a thin barrel.

The circular shield is at Z=10.55, base radius 1.32, and moves in XY. Upward balls that contact it rebound downward. Missing the opening costs one of three lives. Well-wall and floor bounces are safe. The external dragon is scaled to a 17.04-unit silhouette across the opening. A coarse moving height field sampled from the imported mesh handles collisions; the triangle mesh is never a per-frame collider.

Local fracture, periodic resonance and a small final collapse remove crystals. Victory requires zero crystals, followed by the full dragon's rise. The restart model waits until the reveal animation has been shown.

## Controls and state feedback

Pointer movement / touch drag moves the shield; click-release, touch-release or Space launches a held ball. Esc toggles pause without key-repeat toggles; P is compatible, R restarts, arrows/WASD move. Losing focus pauses.

Ordinary shield contact is an immediate rebound with shield compression and downward particles. A miss destroys the ball and leaves the shield empty for about 0.85 seconds before a cyan-petal replacement appears. Bind magic alone causes a catch, shown by a purple ball beacon above the shield, charge gems and a pulsing launch symbol. Cyan is a fresh serve; the physical ball is hidden while held so there is only one ball indicator. Both views render the beacon through occluders. Both held states wait for explicit input; neither silently auto-launches.

## Score and pickups

Each actually removed crystal scores 10 points, with a hit-chain multiplier up to ×4. Automatic resonance and tail collapse score at base rate. Clear bonus: 1,000 plus 500 per remaining life, once only. Restart clears score/effects and restores exactly three lives.

Pickups are rising iridescent magic bubbles with solid symbols inside. They must overlap the shield at the opening. Missed bubbles cost no life. Wide increases the actual shield radius ×1.5 for 18 seconds; slow changes actual speed ×0.72 for 14 seconds; bind grants two capture charges (cap three); treasure gives 500 points. Other pickups give 100 points. Timers tick only while the ball flies. A miss clears magic.

## Rendering contract

The v0.3 quality profile gives main and side targets approximately twice the v0.2 pixel allocation, doubles the particle pool to 1,040 and doubles reflection-map pixels. Side refresh remains deliberately low. This is a budget, not a guaranteed frame-time ratio. No silent automatic quality reduction.

Crystals use instanced geometry, exposed-face shading, separate sorted main/side instance buffers and hybrid optical effects. Coping and dragon detail are merged by material. Magic bubbles and motes have fixed pools. HUD uses an orthographic model scene in the same renderer. FPS is measured from actual frame timestamps, not fixed physics time.

Detailed numeric choices and verification notes: [v0.3 revision](V03-GAMEPLAY-AND-ART.md). The older [visual revision](VISUAL-REVISION.md) records v0.2 history; current rules take precedence.
