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
    if (e.code === 'KeyH') { logic.spawnDebug(); }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
});

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = performance.now() * 0.001;

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

    for (let i = logic.dots.length - 1; i >= 0; i--) {
        const dot = logic.dots[i];
        const h = dot.userData.human;
        const dist = h.position.distanceTo(camera.position);
        
        dot.userData.phase += delta * 5;
        const p = 0.4 + Math.sin(dot.userData.phase) * 0.4;
        dot.material.opacity = 0.3 + p * 0.6; dot.scale.setScalar(60 + p * 100);
        dot.position.copy(h.position); dot.position.y = h.position.y + (dot.userData.heartHeight * h.scale.y);

        const isGazing = h.userData.hitSphere ? raycaster.intersectObject(h.userData.hitSphere).length > 0 : false;

        if (h.userData.isEscaping) {
            const runDir = h.position.clone().sub(camera.position).normalize();
            h.position.add(runDir.multiplyScalar(600 * delta));
            const flatP = camera.position.clone(); flatP.y = h.position.y; h.lookAt(flatP); h.rotation.y += Math.PI;
            if (dist > 3000) { scene.remove(dot); scene.remove(h); logic.dots.splice(i, 1); if (logic.dots.length === 0) logic.triggerPhaseTransition(setupEnvironment); }
            continue;
        }

        if (!h.userData.isMelting && !logic.getMovementDisabled()) {
            if (dist < 300) {
                const flatP = camera.position.clone(); flatP.y = h.position.y; h.lookAt(flatP);
                const fwd = new THREE.Vector3(0,0,1).applyQuaternion(h.quaternion);
                const toP = camera.position.clone().sub(h.position).normalize();
                
                if (fwd.dot(toP) > 0.9 && isGazing && (!logic.getGlobalMeltHuman() || logic.getGlobalMeltHuman() === h)) {
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
                
                // Flee from player together
                const fleeDir = groupCenter.clone().sub(camera.position).setY(0).normalize();
                moveVec.add(fleeDir.multiplyScalar(120)); // Base flee speed

                // Cohesion / Separation
                const other = logic.humans.find(otherH => otherH !== h);
                if (other) {
                    const toOther = other.position.clone().sub(h.position).setY(0);
                    const distToOther = toOther.length();
                    const targetDist = 150; // 1.5m
                    if (distToOther > targetDist) {
                        moveVec.add(toOther.normalize().multiplyScalar(60)); // Move towards if too far
                    } else if (distToOther < 80) {
                        moveVec.add(toOther.normalize().multiplyScalar(-60)); // Move away if too close
                    }
                }

                h.position.add(moveVec.multiplyScalar(delta));
                
                const flatP = camera.position.clone(); flatP.y = h.position.y; h.lookAt(flatP); h.rotation.y += Math.PI;
                h.position.y = 0; dot.userData.gazeTime = 0;
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
                scene.remove(dot); scene.remove(h); logic.dots.splice(i, 1);
                
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

    if (!activeGazeDot && !logic.getMovementDisabled()) gazeBar.style.display = 'none';

    logic.tentacles.forEach((t, i) => {
        if (activeGazeDot) {
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
