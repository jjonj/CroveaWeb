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

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'KeyF') { fogEnabled = !fogEnabled; scene.fog = fogEnabled ? defaultFog : null; }
    if (e.code === 'KeyJ') { 
        logic.skipPhase(setupEnvironment);
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

let localPlayerHuman = null;
let reflectionHuman = null;
let sunriseProgress = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = performance.now() * 0.001;

    // Handle local player human for final scene reflection
    if (logic.currentPhase === PHASES.DAWN) {
        if (!localPlayerHuman) {
            localPlayerHuman = new HumanPrefab(logic.survivorTraits);
            scene.add(localPlayerHuman.group);
            
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
        
        // No longer locking player to camera position in Dawn phase (Third Person now)

        // Position reflection
        if (sunriseState.pool) {
            reflectionHuman.group.position.copy(localPlayerHuman.group.position);
            reflectionHuman.group.position.y = -2; // Slightly below ground/pool
            reflectionHuman.group.rotation.y = localPlayerHuman.group.rotation.y;
        }

        // Dynamic Sunrise Logic
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
        
        // Heartbeat pulse speed increases as distance decreases (faster when close)
        const pulseSpeed = Math.max(1.5, 8 - (dist * 0.005));
        dot.userData.phase += delta * pulseSpeed;
        const t = dot.userData.phase;
        
        // Two distinct peaks for "lub-dub" - Sharpened for better definition
        const p1 = Math.pow(Math.max(0, Math.sin(t)), 20); // Sharper first beat
        const p2 = Math.pow(Math.max(0, Math.sin(t - 0.7)), 20) * 0.5; // Distinct second beat
        const pulseFactor = p1 + p2;
        
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
            if (isPhase1 && wallGroup && wallGroup.userData && wallGroup.userData.center) {
                const caveCenter = wallGroup.userData.center;
                const caveRadius = 5000;
                
                // Find potential huddle targets (not melting, not self)
                const others = logic.humans.filter(other => other !== h && !other.userData.isMelting);
                
                // 1. Flee to another person not nearby who is near a wall
                const distantPeersNearWall = others.filter(other => {
                    const distToSelf = h.position.distanceTo(other.position);
                    const distToWall = caveRadius - other.position.distanceTo(caveCenter);
                    return distToSelf > 600 && distToWall < 400;
                });

                if (distantPeersNearWall.length > 0) {
                    if (!h.userData.escapeDecision) {
                        h.userData.escapeDecision = "PeerNearWall";
                        console.log(`Human ${h.uuid.slice(0,4)}: Fleeing to peer near wall`);
                    }
                    const target = distantPeersNearWall[Math.floor(Math.random() * distantPeersNearWall.length)];
                    runDir = target.position.clone().sub(h.position).setY(0).normalize();
                    if (h.position.distanceTo(target.position) < 200) h.userData.isEscaping = false;
                } else {
                    const fromCenter = h.position.clone().sub(caveCenter).setY(0);
                    const oppositeWallDir = fromCenter.clone().negate().normalize();
                    const distantPeers = others.filter(other => h.position.distanceTo(other.position) > 600);
                    
                    if (others.length > 0 && distantPeers.length === 0) {
                        if (!h.userData.escapeDecision) {
                            h.userData.escapeDecision = "GroupFleeWall";
                            console.log(`Human ${h.uuid.slice(0,4)}: Clumped, fleeing to opposite wall`);
                        }
                        const jitter = new THREE.Vector3((Math.random()-0.5)*0.3, 0, (Math.random()-0.5)*0.3);
                        runDir = oppositeWallDir.clone().add(jitter).normalize();
                    } else if (distantPeers.length > 0) {
                        if (!h.userData.escapeDecision) {
                            h.userData.escapeDecision = "DistantPeer";
                            console.log(`Human ${h.uuid.slice(0,4)}: Fleeing to distant peer`);
                        }
                        const target = distantPeers[Math.floor(Math.random() * distantPeers.length)];
                        runDir = target.position.clone().sub(h.position).setY(0).normalize();
                        if (h.position.distanceTo(target.position) < 200) h.userData.isEscaping = false;
                    } else {
                        if (!h.userData.escapeDecision) {
                            h.userData.escapeDecision = "LoneSurvivorWall";
                            console.log(`Human ${h.uuid.slice(0,4)}: Last one, fleeing to opposite wall`);
                        }
                        runDir = oppositeWallDir;
                    }
                }
            } else {
                runDir = h.position.clone().sub(camera.position).setY(0).normalize();
            }

            const runSpeed = isPhase1 ? 650 : 780; // 500 * 1.3 and 600 * 1.3
            
            // Validate runDir to prevent NaN or zero vector issues
            if (!runDir || runDir.lengthSq() < 0.001) {
                 // Fallback if direction is invalid
                 runDir = h.position.clone().sub(camera.position).setY(0).normalize();
            }
            
            h.position.add(runDir.multiplyScalar(runSpeed * delta));

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
                // If they are clumped and fleeing to wall, give them more time
                const maxTime = h.userData.escapeDecision === "GroupFleeWall" ? 8.0 : 5.0;
                
                h.userData.escapeTimer = (h.userData.escapeTimer || 0) + delta;
                if (h.userData.escapeTimer > maxTime) {
                    h.userData.isEscaping = false;
                    h.userData.escapeTimer = 0;
                    h.userData.escapeDecision = null;
                }
            }

            // Despawn logic (ONLY for Phase 0)
            if (!isPhase1 && dist > 10000) {
                scene.remove(dot); scene.remove(h); 
                logic.dots.splice(i, 1);
                const hIdx = logic.humans.indexOf(h);
                if (hIdx !== -1) logic.humans.splice(hIdx, 1);
                
                if (logic.dots.length === 0) logic.triggerPhaseTransition(setupEnvironment); 
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
                        // Phase 1: All other humans escape when melting starts
                        else if (logic.currentPhase === PHASES.CAVE_GROUP) {
                            logic.dots.forEach(d => { if(d !== dot) d.userData.human.userData.isEscaping = true; });
                        }
                    }
                } else { dot.userData.gazeTime = 0; }
            } else {
                // MOVEMENT LOGIC
                let moveVec = new THREE.Vector3();
                
                if (!logic.debugActive && effectiveDist < 12000) {
                                            // Flee from player together
                                            const fleeDir = (isPhase1 ? groupCenter.clone() : h.position.clone()).sub(camera.position).setY(0).normalize();
                                            moveVec.add(fleeDir.multiplyScalar(250)); 
                    
                                            // Cohesion / Separation (Huddling behavior)
                                            logic.humans.forEach(other => {
                                                if (other === h) return;
                                                const toOther = other.position.clone().sub(h.position).setY(0);
                                                const distToOther = toOther.length();
                                                
                                                // Cohesion: Pull towards others (Stronger in CAVE_GROUP)
                                                const cohesionDist = logic.currentPhase === PHASES.CAVE_GROUP ? 800 : 300;
                                                const cohesionForce = logic.currentPhase === PHASES.CAVE_GROUP ? 150 : 80;
                                                if (distToOther < cohesionDist) {
                                                    moveVec.add(toOther.normalize().multiplyScalar(cohesionForce));
                                                }
                    
                                                                            // Separation: Avoid overlapping (Stronger and wider)
                                                                            const separationDist = 200;
                                                                            if (distToOther < separationDist) {
                                                                                const force = isPhase1 ? -450 : -200;
                                                                                moveVec.add(toOther.normalize().multiplyScalar(force));
                                                                            }
                                                                        });
                                                                                            // Leg animation while fleeing
                    
                    h.userData.legPhase = (h.userData.legPhase || 0) + delta * 15;
                    h.userData.legs[0].rotation.x = Math.sin(h.userData.legPhase) * 0.4;
                    h.userData.legs[1].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.4;
                    h.userData.arms[0].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.3;
                    h.userData.arms[1].rotation.x = Math.sin(h.userData.legPhase) * 0.3;

                    // Rotate to face AWAY from player while fleeing (Much faster rotation)
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
                
                logic.setMovementDisabled(false);
                logic.setGlobalMeltHuman(null);

                // If it's Phase 1, we transition faster
                if (logic.currentPhase === PHASES.VOID_PAIR) {
                    setTimeout(() => logic.triggerPhaseTransition(setupEnvironment), 100);
                } else {
                    // Reset escaping state for everyone else so they can be melted
                    if (logic.currentPhase === PHASES.CAVE_GROUP) {
                        logic.humans.forEach(otherH => {
                            otherH.userData.isEscaping = false;
                            otherH.userData.escapeDecision = null; // Reset for new logs
                        });
                    }

                    // In CAVE_GROUP, we transition when only 1 is left (the survivor)
                    if (logic.currentPhase === PHASES.CAVE_GROUP && logic.dots.length === 1) {
                        const survivorH = logic.dots[0].userData.human;
                        logic.finalizeSurvivor(survivorH.userData.traits);
                        logic.triggerPhaseTransition(setupEnvironment);
                    } else if (logic.dots.length === 0) {
                        logic.triggerPhaseTransition(setupEnvironment);
                    }
                }
            }
        }
    }

    if (activeGazeDot && !playerMoving && logic.currentPhase !== PHASES.DAWN) {
        if (meltSound.paused) meltSound.play();
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
            const start = camera.position.clone();
            const side = new THREE.Vector3(i<2?-140:140, -100+(i%2)*200, -100).applyQuaternion(camera.quaternion);
            start.add(side);
            const pts = [];
            for(let j=0; j<=10; j++) {
                const l = (j/10) * t.reach;
                const p = new THREE.Vector3().lerpVectors(start, activeGazeDot.position, l);
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

setupEnvironment(false); logic.spawn(); animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
