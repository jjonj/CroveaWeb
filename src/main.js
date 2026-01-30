import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createEnvironment, createGlowTexture } from './Environment.js';
import { createLogic, PHASES } from './Logic.js';
import { HumanPrefab } from './HumanPrefab.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 15000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const { setupEnvironment, defaultFog, wallGroup, sunriseState } = createEnvironment(scene, camera);
const glowTexture = createGlowTexture();
const logic = createLogic(scene, camera, glowTexture);

const controls = new PointerLockControls(camera, document.body);
document.addEventListener('mousedown', () => { if (!controls.isLocked) controls.lock(); });

let moveF = false, moveB = false, moveL = false, moveR = false;
let fogEnabled = true;
const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
camera.position.set(0, 175, 500);

let introFinished = false;

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'KeyF') { fogEnabled = !fogEnabled; scene.fog = fogEnabled ? defaultFog : null; }
    if (e.code === 'KeyJ') { 
        if (!introFinished) {
            introFinished = true;
        } else {
            logic.skipPhase(setupEnvironment);
        }
    }
    if (e.code === 'KeyH') { 
        if (logic.debugActive) {
            // Exit debug mode, return to default phase
            logic.setDebugActive(false);
            setupEnvironment(false); // Reset to void environment
            logic.spawn(); // Spawn initial phase humans
            scene.fog = defaultFog; // Re-enable fog
        } else {
            logic.setDebugActive(true);
            logic.spawnDebug(); 
            scene.fog = null; // Disable fog in debug mode
        }
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
});

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

// Audio Setup
const meltSound = new Audio('melteffect.wav');
meltSound.loop = true;
meltSound.volume = 0.2; // Halved from 0.4
let lastMeltTime = 0;

const heartbeatSound = new Audio('heartbeat.mp3');
heartbeatSound.loop = true;
heartbeatSound.volume = 0;
const bgMusic = new Audio('backgroundmusic.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;
const forestAmbient = new Audio('forestnightambient.mp3');
forestAmbient.loop = true;
forestAmbient.volume = 0;

let localPlayerHuman = null;
let reflectionHuman = null;
let sunriseProgress = 0;
let soundStarted = false;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = performance.now() * 0.001;
    const now = performance.now();

    // Start audio on first interaction
    if (controls.isLocked && !soundStarted) {
        heartbeatSound.play().catch(() => {});
        bgMusic.play().catch(() => {});
        forestAmbient.play().catch(() => {});
        soundStarted = true;
    }

    // Handle local player human for final scene reflection
    if (logic.currentPhase === PHASES.DAWN || logic.currentPhase === PHASES.FOREST_SURVIVOR) {
        if (!localPlayerHuman) {
            localPlayerHuman = new HumanPrefab(logic.survivorTraits);
            scene.add(localPlayerHuman.group);
            
            if (logic.currentPhase === PHASES.FOREST_SURVIVOR) {
                // Laying next to campfire at (200, 0, 0)
                localPlayerHuman.group.position.set(200, 5, 100);
                localPlayerHuman.group.rotation.x = -Math.PI / 2;
                localPlayerHuman.group.rotation.z = Math.PI / 4;

                // Position camera for forest scene
                const camOffset = new THREE.Vector3(0, 80, 300);
                camera.position.copy(localPlayerHuman.group.position).add(camOffset);
                camera.lookAt(localPlayerHuman.group.position);
            } else {
                // Initial position for the survivor (center of scene)
                localPlayerHuman.group.position.set(camera.position.x, 0, camera.position.z);
                localPlayerHuman.group.rotation.y = Math.PI; // Face the sun (assuming sun is at -Z)

                // THIRD PERSON CAMERA SETUP
                // Move camera behind and up
                const offset = new THREE.Vector3(0, 150, 400); // Behind and up
                camera.position.copy(localPlayerHuman.group.position).add(offset);
                camera.lookAt(localPlayerHuman.group.position.x, localPlayerHuman.group.position.y + 100, localPlayerHuman.group.position.z - 1000);

                // Create reflection "ghost"
                reflectionHuman = new HumanPrefab(logic.survivorTraits);
                reflectionHuman.group.scale.y *= -1; // Invert vertically
                scene.add(reflectionHuman.group);
                
                // Dim the reflection
                reflectionHuman.group.traverse(child => {
                    if (child.material) {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.4;
                    }
                });
            }
        }
        
        // Dynamic Sunrise Logic (Only in DAWN phase)
        if (logic.currentPhase === PHASES.DAWN) {
            // Position reflection
            if (sunriseState.pool && reflectionHuman) {
                reflectionHuman.group.position.copy(localPlayerHuman.group.position);
                reflectionHuman.group.position.y = -2; // Slightly below ground/pool
                reflectionHuman.group.rotation.y = localPlayerHuman.group.rotation.y;
            }

            sunriseProgress = Math.min(1.0, sunriseProgress + delta * 0.02); // 50 seconds to full sunrise
            
            if (sunriseState.sunDisk) {
                // Move sun up
                sunriseState.sunDisk.position.y = -500 + (sunriseProgress * 2000);
                // Change color from red to yellow-white
                const sunColor = new THREE.Color(0xff0000).lerp(new THREE.Color(0xffffcc), sunriseProgress);
                sunriseState.sunDisk.material.color.copy(sunColor);
                
                // Lighting adjustments
                sunriseState.sunLight.intensity = 0.2 + (sunriseProgress * 1.5);
                sunriseState.sunLight.color.copy(sunColor);
                sunriseState.hemiLight.intensity = 0.2 + (sunriseProgress * 0.8);
                
                // Fog adjustments
                const fogColor = new THREE.Color(0x1a0505).lerp(new THREE.Color(0x87ceeb), sunriseProgress);
                scene.background.copy(fogColor);
                scene.fog.color.copy(fogColor);
                scene.fog.density = 0.0002 * (1.0 - sunriseProgress * 0.5);
            }
        }
    }

    // Audio transitions
    if (logic.currentPhase === PHASES.FOREST_SURVIVOR) {
        if (bgMusic.volume > 0) bgMusic.volume = Math.max(0, bgMusic.volume - delta * 0.2);
        if (forestAmbient.volume < 0.6) forestAmbient.volume = Math.min(0.6, forestAmbient.volume + delta * 0.2);
    } else if (logic.currentPhase === PHASES.DAWN) {
        if (bgMusic.volume > 0) bgMusic.volume = Math.max(0, bgMusic.volume - delta * 0.1);
        if (forestAmbient.volume > 0) forestAmbient.volume = Math.max(0, forestAmbient.volume - delta * 0.1);
    }

    const playerMoving = moveF || moveB || moveL || moveR;

    if (controls.isLocked && !logic.getMovementDisabled()) {
        velocity.x -= velocity.x * 10 * delta; velocity.z -= velocity.z * 10 * delta;
        direction.z = Number(moveF) - Number(moveB); direction.x = Number(moveR) - Number(moveL); direction.normalize();
        const speed = 1040; // 800 * 1.3
        if (moveF || moveB) velocity.z -= direction.z * speed * 10 * delta;
        if (moveL || moveR) velocity.x -= direction.x * speed * 10 * delta;
        controls.moveRight(-velocity.x * delta); controls.moveForward(-velocity.z * delta);
    }

    let activeGazeDot = null;
    let nearestDist = Infinity;
    let nearestPulseFactor = 0;
    let nearestPulseSpeed = 0;

    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const gazeBar = document.getElementById('gaze-container');
    const gazeFill = document.getElementById('gaze-fill');

    let groupCenter = new THREE.Vector3();
    if (logic.humans.length > 0) {
        logic.humans.forEach(h => groupCenter.add(h.position)); 
        groupCenter.divideScalar(logic.humans.length);
    }
    const distToGroup = groupCenter.distanceTo(camera.position);

        for (let i = logic.dots.length - 1; i >= 0; i--) {
        const dot = logic.dots[i];
        const h = dot.userData.human;
        const dist = h.position.distanceTo(camera.position);
        const isPhase1 = logic.currentPhase === PHASES.VOID_PAIR;
        const isDawn = logic.currentPhase === PHASES.DAWN;
        const effectiveDist = isPhase1 ? distToGroup : dist;
        
        // Heartbeat pulse speed increases as distance decreases (drastically faster when close)
        const pulseSpeed = Math.max(1.5, 20 - (dist * 0.012)); // Increased from 8
        dot.userData.phase += delta * pulseSpeed;
        const t = dot.userData.phase;
        
        // Two distinct peaks for "lub-dub" - Sharpened for better definition
        const p1 = Math.pow(Math.max(0, Math.sin(t)), 20); // Sharper first beat
        const p2 = Math.pow(Math.max(0, Math.sin(t - 0.7)), 20) * 0.5; // Distinct second beat
        const pulseFactor = p1 + p2;
        
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestPulseFactor = pulseFactor;
            nearestPulseSpeed = pulseSpeed;
        }

        // Disable pulse and gaze in Dawn phase
        if (isDawn) {
            dot.material.opacity = 0;
            dot.scale.setScalar(0);
        } else {
            dot.material.opacity = 0.3 + pulseFactor * 0.7; // Modulate opacity
            dot.scale.setScalar(60 + pulseFactor * 140); // Modulate size
        }
        
        dot.position.copy(h.position); dot.position.y = h.position.y + (dot.userData.heartHeight * h.scale.y);

        const isGazing = (h.userData.hitSphere && !isDawn) ? raycaster.intersectObject(h.userData.hitSphere).length > 0 : false;

        if (h.userData.isEscaping) {
            const isPhase1 = logic.currentPhase === PHASES.CAVE_GROUP;
            
            // ESCAPE DIRECTION
            let runDir;
            if (isPhase1) {
                // In Phase 1, the whole group center flees away from the player
                runDir = logic.groupCenter.clone().sub(camera.position).setY(0).normalize();
                if (runDir.lengthSq() < 0.01) runDir.set(0,0,1); // Fallback
                
                // Move the GROUP center
                const runSpeed = 800;
                logic.groupCenter.add(runDir.clone().multiplyScalar(runSpeed * delta));
            } else {
                runDir = h.position.clone().sub(camera.position).setY(0).normalize();
                const runSpeed = 780;
                h.position.add(runDir.multiplyScalar(runSpeed * delta));
                
                // Max flee distance for Phase 0
                if (!isPhase1 && dist > 1500) {
                    h.userData.isEscaping = false;
                }
            }

            // Move individual human towards their formation spot
            if (isPhase1) {
                const targetPos = logic.groupCenter.clone().add(h.userData.formationOffset);
                h.position.lerp(targetPos, delta * 5.0);
            }

            // Eased rotation towards run direction
            const targetQuaternion = new THREE.Quaternion();
            const lookPos = h.position.clone().add(runDir);
            h.lookAt(lookPos);
            targetQuaternion.copy(h.quaternion);
            h.quaternion.slerp(targetQuaternion, delta * 3.0);

            // Leg animation
            h.userData.legPhase = (h.userData.legPhase || 0) + delta * 20;
            h.userData.legs[0].rotation.x = Math.sin(h.userData.legPhase) * 0.4;
            h.userData.legs[1].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.4;
            h.userData.arms[0].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.3;
            h.userData.arms[1].rotation.x = Math.sin(h.userData.legPhase) * 0.3;

            // Stop condition for Phase 1
            if (isPhase1) {
                h.userData.escapeTimer = (h.userData.escapeTimer || 0) + delta;
                if (h.userData.escapeTimer > 5.0) {
                    // Force despawn after 5 seconds if distance not met
                    dist = 9999; 
                }
            }

            // Despawn logic for Phase 1 (CAVE_GROUP)
            if (logic.currentPhase === PHASES.CAVE_GROUP && h.userData.isEscaping && dist > 1500) {
                scene.remove(dot); scene.remove(h); 
                logic.dots.splice(i, 1);
                const hIdx = logic.humans.indexOf(h);
                if (hIdx !== -1) logic.humans.splice(hIdx, 1);

                if (logic.dots.length === 0) {
                    if (logic.isPhaseComplete) {
                        logic.triggerPhaseTransition(setupEnvironment);
                    }
                    else {
                        logic.spawn();
                    }
                }
            }
            continue;
        }

        if (!h.userData.isMelting && !logic.getMovementDisabled()) {
            // Eased rotation towards player (Increased speed for snappier feel)
            const targetQuaternion = new THREE.Quaternion();
            const tempLookAt = camera.position.clone(); tempLookAt.y = h.position.y;
            h.lookAt(tempLookAt); // Temporarily set rotation
            targetQuaternion.copy(h.quaternion); // Store target
            h.quaternion.slerp(targetQuaternion, delta * 10); // Faster interpolation (was 3)

            if (effectiveDist < 600) {
                // Shake in fear
                const shakeAmount = 1.5;
                h.position.x += (Math.random() - 0.5) * shakeAmount;
                h.position.z += (Math.random() - 0.5) * shakeAmount;

                // Reset animations when stopped
                h.userData.legs[0].rotation.x = 0;
                h.userData.legs[1].rotation.x = 0;
                h.userData.arms[0].rotation.x = 0;
                h.userData.arms[1].rotation.x = 0;

                if (isGazing && (!logic.getGlobalMeltHuman() || logic.getGlobalMeltHuman() === h)) {
                    activeGazeDot = dot; dot.userData.gazeTime += delta;
                    gazeBar.style.display = 'block'; gazeFill.style.width = (dot.userData.gazeTime/3*100)+'%';
                    if (dot.userData.gazeTime >= 3.0) {
                        h.userData.isMelting = true; logic.setMovementDisabled(true); logic.setGlobalMeltHuman(h);
                        gazeBar.style.display = 'none';
                        
                        // Phase 0: The other human escapes
                        if (logic.currentPhase === PHASES.VOID_PAIR) {
                            logic.dots.forEach(d => { if(d !== dot) d.userData.human.userData.isEscaping = true; });
                        }
                        // Phase 1: Partner melts too, others escape
                        else if (logic.currentPhase === PHASES.CAVE_GROUP) {
                            if (h.userData.partner) {
                                h.userData.partner.userData.isMelting = true;
                                // Find partner's dot to hide it
                                const partnerDot = logic.dots.find(d => d.userData.human === h.userData.partner);
                                if (partnerDot) partnerDot.userData.gazeTime = 3.0;
                            }
                            logic.dots.forEach(d => { 
                                const otherH = d.userData.human;
                                if(otherH !== h && otherH !== h.userData.partner) {
                                    otherH.userData.isEscaping = true; 
                                }
                            });
                        }
                    }
                } else { dot.userData.gazeTime = 0; }
            } else {
                // MOVEMENT LOGIC
                let moveVec = new THREE.Vector3();
                
                if (!logic.debugActive && effectiveDist < 12000) {
                    if (logic.currentPhase === PHASES.CAVE_GROUP) {
                        // CAVE_GROUP: Fixed formation relative to groupCenter
                        const fleeDir = logic.groupCenter.clone().sub(camera.position).setY(0).normalize();
                        moveVec.add(fleeDir.multiplyScalar(250)); 
                        
                        logic.groupCenter.add(moveVec.clone().multiplyScalar(delta));

                        const targetPos = logic.groupCenter.clone().add(h.userData.formationOffset);
                        h.position.lerp(targetPos, delta * 5.0);
                    } else {
                        // VOID_PAIR (Scene 1): Individual flocking/separation + Cohesion
                        const fleeDir = h.position.clone().sub(camera.position).setY(0).normalize();
                        moveVec.add(fleeDir.multiplyScalar(250)); 

                        logic.humans.forEach(other => {
                            if (other === h) return;
                            const toOther = other.position.clone().sub(h.position).setY(0);
                            const distToOther = toOther.length();
                            
                            // Cohesion: Pull towards each other if drifting apart
                            if (distToOther > 120) {
                                moveVec.add(toOther.normalize().multiplyScalar(400));
                            }

                            // Separation: Avoid overlapping (Tightened)
                            if (distToOther < 80) {
                                moveVec.add(toOther.normalize().multiplyScalar(-600));
                            }
                        });

                        h.position.add(moveVec.multiplyScalar(delta));
                    }
                    
                    // Leg animation while fleeing
                    h.userData.legPhase = (h.userData.legPhase || 0) + delta * 15;
                    h.userData.legs[0].rotation.x = Math.sin(h.userData.legPhase) * 0.4;
                    h.userData.legs[1].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.4;
                    h.userData.arms[0].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.3;
                    h.userData.arms[1].rotation.x = Math.sin(h.userData.legPhase) * 0.3;

                    // Rotate to face AWAY from player while fleeing
                    const targetQuaternion = new THREE.Quaternion();
                    const tempLookAt = camera.position.clone(); tempLookAt.y = h.position.y;
                    h.lookAt(tempLookAt);
                    h.rotation.y += Math.PI; 
                    targetQuaternion.copy(h.quaternion);
                    h.quaternion.slerp(targetQuaternion, delta * 3.0);
                } else {
                    // Reset animations if not fleeing
                    h.userData.legs[0].rotation.x = 0;
                    h.userData.legs[1].rotation.x = 0;
                    h.userData.arms[0].rotation.x = 0;
                    h.userData.arms[1].rotation.x = 0;
                }

                h.position.add(moveVec.multiplyScalar(delta));

                // CAVE COLLISION (Phase 2 & 3)
                if ((logic.currentPhase === PHASES.CAVE_GROUP || logic.currentPhase === PHASES.FINAL_FAMILY) && wallGroup && wallGroup.userData && wallGroup.userData.center) {
                    const caveRadius = 5000;
                    const buffer = 60;
                    const center = wallGroup.userData.center;
                    const distFromCenter = new THREE.Vector3(h.position.x - center.x, 0, h.position.z - center.z);
                    if (distFromCenter.length() > caveRadius - h.userData.radius - buffer) {
                        distFromCenter.setLength(caveRadius - h.userData.radius - buffer);
                        h.position.x = center.x + distFromCenter.x;
                        h.position.z = center.z + distFromCenter.z;
                        
                        // Force face player when hitting wall
                        const tempLookAt = camera.position.clone(); tempLookAt.y = h.position.y;
                        h.lookAt(tempLookAt);
                        
                        // Stop animations
                        h.userData.legs[0].rotation.x = 0; h.userData.legs[1].rotation.x = 0;
                        h.userData.arms[0].rotation.x = 0; h.userData.arms[1].rotation.x = 0;
                    }
                }
            }
        }

        if (h.userData.isMelting) {
            activeGazeDot = dot;
            h.userData.consumption = Math.min(1.0, h.userData.consumption + delta * 0.2); // Faster consumption
            h.scale.y = 1.0 - (h.userData.consumption * 0.95);
            h.scale.x = 1.0 + (h.userData.consumption * 0.6);
            h.position.y = -(h.userData.consumption * 160); 
            if (h.userData.consumption >= 1.0) {
                logic.recordConsumption(h.userData.traits);
                scene.remove(dot); scene.remove(h); 
                logic.dots.splice(i, 1);
                const hIdx = logic.humans.indexOf(h);
                if (hIdx !== -1) logic.humans.splice(hIdx, 1);
                
                // If both in the pair are gone, check for next steps
                const pairStillMelted = logic.humans.some(otherH => otherH.userData.isMelting);
                if (!pairStillMelted) {
                    logic.setMovementDisabled(false);
                    logic.setGlobalMeltHuman(null);

                    if (logic.currentPhase === PHASES.VOID_PAIR) {
                        setTimeout(() => logic.triggerPhaseTransition(setupEnvironment), 100);
                    } else if (logic.currentPhase === PHASES.CAVE_GROUP) {
                        if (logic.dots.length === 0) {
                            if (logic.isPhaseComplete) {
                                logic.triggerPhaseTransition(setupEnvironment);
                            } else {
                                logic.spawn();
                            }
                        }
                    }
                }
            }
        }

        // Despawn logic for Phase 1 (CAVE_GROUP)
        if (logic.currentPhase === PHASES.CAVE_GROUP && h.userData.isEscaping && dist > 3000) {
            scene.remove(dot); scene.remove(h); 
            logic.dots.splice(i, 1);
            const hIdx = logic.humans.indexOf(h);
            if (hIdx !== -1) logic.humans.splice(hIdx, 1);

            if (logic.dots.length === 0) {
                if (logic.isPhaseComplete) {
                    logic.triggerPhaseTransition(setupEnvironment);
                } else {
                    logic.spawn();
                }
            }
        }
    }

    // Update heartbeat audio based on nearest human
    if (logic.currentPhase !== PHASES.DAWN && nearestDist < 2500 && soundStarted) {
        // Volume scales with proximity and pulses with the visual rhythm
        const distFactor = Math.max(0, 1 - (nearestDist / 2500));
        // Modulate volume by pulseFactor to create "thump-thump" effect
        heartbeatSound.volume = distFactor * (0.1 + nearestPulseFactor * 0.9) * 1.0; // Increased from 0.6
        
        // Sync playback rate to pulse speed
        // Baseline pulseSpeed is 1.5 (slow) up to 20.0 (fast)
        heartbeatSound.playbackRate = 0.7 + (nearestPulseSpeed - 1.5) * (1.8 / 18.5);
    } else {
        heartbeatSound.volume = 0;
    }

    // Fade out BG music in DAWN phase
    if (logic.currentPhase === PHASES.DAWN && bgMusic.volume > 0) {
        bgMusic.volume = Math.max(0, bgMusic.volume - delta * 0.1);
    }

    if (activeGazeDot && !playerMoving && logic.currentPhase !== PHASES.DAWN) {
        if (meltSound.paused && (now - lastMeltTime > 5000)) {
            meltSound.play();
            lastMeltTime = now;
        }
    } else {
        if (!meltSound.paused) {
            meltSound.pause();
            meltSound.currentTime = 0;
        }
    }

    if (!activeGazeDot && !logic.getMovementDisabled() || logic.currentPhase === PHASES.DAWN) gazeBar.style.display = 'none';

    logic.tentacles.forEach((t, i) => {
        if (activeGazeDot && !playerMoving) {
            t.mesh.visible = true; t.reach = THREE.MathUtils.lerp(t.reach, 1.0, delta * 1.5);
            
            // Determine target: 4 tentacles for the gazed human, 4 for its partner
            const gazedH = activeGazeDot.userData.human;
            const partnerH = gazedH.userData.partner;
            const targetPos = (i < 4 || !partnerH) ? activeGazeDot.position : partnerH.position;

            const start = camera.position.clone();
            const side = new THREE.Vector3(i<4?-140:140, -100+(i%2)*200, -100).applyQuaternion(camera.quaternion);
            start.add(side);
            const pts = [];
            for(let j=0; j<=10; j++) {
                const l = (j/10) * t.reach;
                const p = new THREE.Vector3().lerpVectors(start, targetPos, l);
                const w = Math.sin(time*15 + (j/10)*6 + i) * (35*t.reach) * (1-Math.pow((j/10)-0.5, 2)*4);
                p.x+=w; p.y+=w; pts.push(p);
            }
            t.mesh.geometry.dispose(); t.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 6*t.reach, 8, false);
        } else {
            t.reach = THREE.MathUtils.lerp(t.reach, 0.0, delta*4.0);
            if (t.reach < 0.05) t.mesh.visible = false;
        }
    });

    renderer.render(scene, camera);
}

async function startIntro() {
    const narrative = document.getElementById('narrative');
    const fade = document.getElementById('screen-fade');
    const overlay = document.getElementById('ui-overlay');
    
    overlay.style.opacity = '1';
    narrative.style.opacity = '1';
    narrative.innerHTML = '';
    await new Promise(r => setTimeout(r, 1000));
    
    const highlight = (text) => text.replace(/\bYou\b/g, '<span class="highlight">You</span>').replace(/\byour\b/g, '<span class="highlight">your</span>').replace(/\bYour\b/g, '<span class="highlight">Your</span>');
    const highlightJP = (text) => text.replace(/自分/g, '<span class="highlight">自分</span>');

    const showCinematicLine = async (segments) => {
        if (introFinished) return;
        narrative.innerHTML = '<div class="narrative-container"></div>';
        const container = narrative.querySelector('.narrative-container');

        const blocks = segments.map(s => {
            const block = document.createElement('div');
            block.className = 'segment-block';
            block.style.opacity = '0';
            block.style.transition = 'opacity 2.0s';
            block.innerHTML = `
                <div class="en">${highlight(s.en)}</div>
                <div class="jp">${highlightJP(s.jp)}</div>
            `;
            container.appendChild(block);
            return block;
        });

        await new Promise(r => setTimeout(r, 50));

        for (let i = 0; i < segments.length; i++) {
            if (introFinished) break;
            blocks[i].style.opacity = '1';
            let elapsed = 0;
            while (elapsed < segments[i].d && !introFinished) {
                await new Promise(r => setTimeout(r, 100));
                elapsed += 100;
            }
        }

        if (!introFinished) {
            await new Promise(r => setTimeout(r, 2000));
            narrative.style.opacity = '0';
            await new Promise(r => setTimeout(r, 1500));
            narrative.innerHTML = '';
            narrative.style.opacity = '1';
        }
    };

    // First sequence: Cumulative build-up
    await showCinematicLine([
        { en: "Your body.. ", jp: "自分の体...", d: 1500 },
        { en: "your face.. ", jp: "その貌...", d: 1500 },
        { en: "is not by design", jp: "それは決して、意図されたものではない。", d: 3000 }
    ]);

    // Second sequence: Single line
    if (!introFinished) {
        await showCinematicLine([
            { en: "it is merely what survived...", jp: "ただ、生き残った結果に過ぎない。", d: 4000 }
        ]);
    }

    if (introFinished) {
        narrative.style.opacity = '0';
        narrative.innerHTML = '';
    }

    introFinished = true;
    fade.style.opacity = '0';
    setupEnvironment(false); 
    logic.spawn(); 
}

animate();
startIntro();

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
