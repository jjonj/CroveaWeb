import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createEnvironment, createGlowTexture } from './Environment.js';
import { createLogic, PHASES } from './Logic.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 15000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const { setupEnvironment, defaultFog } = createEnvironment(scene, camera);
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

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = performance.now() * 0.001;

    const playerMoving = moveF || moveB || moveL || moveR;

    if (controls.isLocked && !logic.getMovementDisabled()) {
        velocity.x -= velocity.x * 10 * delta; velocity.z -= velocity.z * 10 * delta;
        direction.z = Number(moveF) - Number(moveB); direction.x = Number(moveR) - Number(moveL); direction.normalize();
        const speed = 800;
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
        const effectiveDist = isPhase1 ? distToGroup : dist;
        
        // Heartbeat pulse speed increases as distance decreases (faster when close)
        const pulseSpeed = Math.max(1.5, 8 - (dist * 0.005));
        dot.userData.phase += delta * pulseSpeed;
        const t = dot.userData.phase;
        
        // Two distinct peaks for "lub-dub" - Sharpened for better definition
        const p1 = Math.pow(Math.max(0, Math.sin(t)), 20); // Sharper first beat
        const p2 = Math.pow(Math.max(0, Math.sin(t - 0.7)), 20) * 0.5; // Distinct second beat
        const pulseFactor = p1 + p2;
        
        dot.material.opacity = 0.3 + pulseFactor * 0.7; // Modulate opacity
        dot.scale.setScalar(60 + pulseFactor * 140); // Modulate size
        dot.position.copy(h.position); dot.position.y = h.position.y + (dot.userData.heartHeight * h.scale.y);

        const isGazing = h.userData.hitSphere ? raycaster.intersectObject(h.userData.hitSphere).length > 0 : false;

        if (h.userData.isEscaping) {
            const runDir = h.position.clone().sub(camera.position).setY(0).normalize();
            h.position.add(runDir.multiplyScalar(600 * delta));

            // Eased rotation away from player
            const targetQuaternion = new THREE.Quaternion();
            const tempLookAt = camera.position.clone(); tempLookAt.y = h.position.y;
            h.lookAt(tempLookAt); // Temporarily set rotation
            h.rotation.y += Math.PI; // Invert to look away
            targetQuaternion.copy(h.quaternion); // Store target
            h.quaternion.slerp(targetQuaternion, delta * 10); // Faster interpolation (was 3)

            // Leg animation
            h.userData.legPhase = (h.userData.legPhase || 0) + delta * 20; // Animation speed
            h.userData.legs[0].rotation.x = Math.sin(h.userData.legPhase) * 0.4;
            h.userData.legs[1].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.4;
            h.userData.arms[0].rotation.x = Math.sin(h.userData.legPhase + Math.PI) * 0.3;
            h.userData.arms[1].rotation.x = Math.sin(h.userData.legPhase) * 0.3;

            if (dist > 10000) { // Despawn at 100m
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
                        if (logic.currentPhase === PHASES.VOID_PAIR) {
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

                    // Cohesion / Separation (Sticking together)
                    const other = logic.humans.find(otherH => otherH !== h);
                    if (other) {
                        const toOther = other.position.clone().sub(h.position).setY(0);
                        const distToOther = toOther.length();
                        const targetDist = 150; 
                        if (distToOther > targetDist) {
                            moveVec.add(toOther.normalize().multiplyScalar(100)); 
                        } else if (distToOther < 80) {
                            moveVec.add(toOther.normalize().multiplyScalar(-100)); 
                        }
                    }

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
                    h.quaternion.slerp(targetQuaternion, delta * 10);
                } else {
                    // Reset animations if not fleeing
                    h.userData.legs[0].rotation.x = 0;
                    h.userData.legs[1].rotation.x = 0;
                    h.userData.arms[0].rotation.x = 0;
                    h.userData.arms[1].rotation.x = 0;
                }

                h.position.add(moveVec.multiplyScalar(delta));

                // CAVE COLLISION (Phase 2 & 3)
                if (logic.currentPhase === PHASES.CAVE_GROUP || logic.currentPhase === PHASES.FINAL_FAMILY) {
                    const caveRadius = 2500;
                    const distFromCenter = new THREE.Vector3(h.position.x - camera.position.x, 0, h.position.z - camera.position.z);
                    if (distFromCenter.length() > caveRadius - h.userData.radius) {
                        distFromCenter.setLength(caveRadius - h.userData.radius);
                        h.position.x = camera.position.x + distFromCenter.x;
                        h.position.z = camera.position.z + distFromCenter.z;
                        
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
                    // If it's the final family, we only consume two
                    const isFinalPhase = logic.currentPhase === PHASES.FINAL_FAMILY;
                    if (logic.dots.length === 0 || (isFinalPhase && logic.dots.length === 1)) {
                        if (isFinalPhase && logic.dots.length === 1) {
                            // The last one escapes
                            logic.dots[0].userData.human.userData.isEscaping = true;
                        } else {
                            logic.triggerPhaseTransition(setupEnvironment);
                        }
                    }
                }
            }
        }
    }

    if (activeGazeDot && !playerMoving) {
        if (meltSound.paused) meltSound.play();
    } else {
        if (!meltSound.paused) {
            meltSound.pause();
            meltSound.currentTime = 0;
        }
    }

    if (!activeGazeDot && !logic.getMovementDisabled()) gazeBar.style.display = 'none';

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
