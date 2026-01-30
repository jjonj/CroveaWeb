import * as THREE from 'three';
import { HumanPrefab } from './HumanPrefab.js';

export const PHASES = { VOID_PAIR: 0, CAVE_GROUP: 1, FINAL_FAMILY: 2, DAWN: 3, DEBUG: 4 };
const SKINS = [0x4b3621, 0x8d5524, 0xc68642, 0xf1c27d, 0xffdbac];

export function createLogic(scene, camera, glowTexture) {
    const dots = [], humans = [], tentacles = [];
    let currentPhase = PHASES.VOID_PAIR;
    let globalMeltHuman = null;
    let movementDisabled = false;
    let debugActive = false;

    // The "Result" traits that will persist
    let survivorTraits = {
        skinColor: 0xffdbac,
        height: 1.0,
        hairStyle: 'long',
        roundFace: false,
        gender: 'female',
        broadShoulders: false
    };

    function updateNarrative(text) {
        const el = document.getElementById('narrative');
        if (el) el.innerText = text;
    }

    function spawn() {
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        // Local variable for tracking group centers during this spawn
        const groupCenters = {}; 

        let count = 0;
        if (currentPhase === PHASES.VOID_PAIR) {
            count = 2;
            updateNarrative("Follow the faint red pulsing...");
        } else if (currentPhase === PHASES.CAVE_GROUP) {
            count = 5;
            updateNarrative("Consume the traits you wish to fade from this world...");
        }

        // Cluster Center
        const clusterDist = (currentPhase === PHASES.VOID_PAIR) ? 1200 : 700;
        const clusterCenter = camera.position.clone().add(forward.clone().multiplyScalar(clusterDist));

        for(let i=0; i<count; i++) {
            let x, z;
            if (currentPhase === PHASES.CAVE_GROUP) {
                // Spawn in groups in the expanded cave (Radius 5000)
                // Determine group index (e.g., 2 groups)
                const groupCount = 2; 
                const groupIndex = i % groupCount;
                
                // If it's the first member of a group, define the group center
                if (!groupCenters[groupIndex]) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 2500 + Math.random() * 1500; // Place group centers 2500-4000 units away
                    groupCenters[groupIndex] = {
                        x: camera.position.x + Math.cos(angle) * r,
                        z: camera.position.z + Math.sin(angle) * r
                    };
                }

                // Spawn relative to group center with some spread
                const center = groupCenters[groupIndex];
                const spread = 150; // Radius of the group cluster
                const subAngle = Math.random() * Math.PI * 2;
                const subR = Math.random() * spread;
                
                x = center.x + Math.cos(subAngle) * subR;
                z = center.z + Math.sin(subAngle) * subR;
            } else {
                const angle = (i / count) * Math.PI * 2;
                const radius = 50 + Math.random() * 50; 
                x = clusterCenter.x + Math.cos(angle) * radius;
                z = clusterCenter.z + Math.sin(angle) * radius;
            }
            
            let traits = {};
            if (currentPhase === PHASES.VOID_PAIR) {
                traits = { 
                    skinColor: SKINS[i % SKINS.length], 
                    gender: i === 0 ? 'male' : 'female',
                    height: i === 0 ? 1.1 : 0.9,
                    broadShoulders: i === 0,
                    hairStyle: i === 0 ? 'short' : 'long',
                    roundFace: i === 1
                };
            } else if (currentPhase === PHASES.CAVE_GROUP) {
                traits = {
                    skinColor: SKINS[i % SKINS.length],
                    gender: survivorTraits.gender,
                    height: 0.8 + (Math.random() * 0.4),
                    hairStyle: Math.random() > 0.5 ? 'long' : 'short',
                    roundFace: Math.random() > 0.5,
                    broadShoulders: survivorTraits.gender === 'male' && Math.random() > 0.5
                };
            }

            const hPrefab = new HumanPrefab(traits);
            hPrefab.group.position.set(x, 0, z); scene.add(hPrefab.group); humans.push(hPrefab.group);
            const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff0000, transparent: true, opacity: 0.5, fog: false, depthTest: false }));
            dot.renderOrder = 999; scene.add(dot); dots.push(dot);
            dot.userData = { human: hPrefab.group, heartHeight: hPrefab.heartHeight, phase: Math.random() * 10, gazeTime: 0 };
            hPrefab.group.userData.traits = traits;
            hPrefab.group.userData.consumption = 0;
            hPrefab.group.userData.isMelting = false;
            hPrefab.group.userData.isEscaping = false;
            hPrefab.group.userData.radius = 40; // Approx physical radius
        }
    }

    function createTentacleMesh() {
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), 20, 5, 8, false), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        scene.add(mesh); return { mesh, reach: 0 };
    }
    for(let i=0; i<4; i++) tentacles.push(createTentacleMesh());

    async function triggerPhaseTransition(setupEnv) {
        const fade = document.getElementById('screen-fade'); fade.style.opacity = '1';
        await new Promise(r => setTimeout(r, 1000));
        
        if (currentPhase === PHASES.VOID_PAIR) currentPhase = PHASES.CAVE_GROUP;
        else if (currentPhase === PHASES.CAVE_GROUP) currentPhase = PHASES.DAWN;

        if (currentPhase === PHASES.DAWN) {
            updateNarrative("The survivor stands alone. Dawn breaks.");
            setupEnv(false, true); 
            console.log("SURVIVOR TRAITS:", survivorTraits);
        } else {
            setupEnv(currentPhase !== PHASES.VOID_PAIR, false); spawn();
        }

        fade.style.opacity = '0'; 
        setMovementDisabled(false);
        setGlobalMeltHuman(null);
    }

    function recordConsumption(traits) {
        // Logic: What you consume is what is REMOVED from the world.
        if (currentPhase === PHASES.VOID_PAIR) {
            // Find the human that was NOT melted to determine survivor traits
            const survivor = humans.find(h => h.userData.traits !== traits);
            if (survivor) {
                // In Phase 0, we ONLY eliminate gender.
                survivorTraits.gender = survivor.userData.traits.gender;
            }
        }
    }

    function finalizeSurvivor(traits) {
        survivorTraits = { ...traits };
    }

    function setMovementDisabled(val) { movementDisabled = val; }
    function setGlobalMeltHuman(val) { globalMeltHuman = val; }

    function spawnDebug() {
        debugActive = true;
        currentPhase = PHASES.DEBUG;
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        updateNarrative("DEBUG MODE: 10 Random Humans Generated (Fleeing Disabled)");
        const clusterDist = 1000;
        const clusterCenter = camera.position.clone().add(forward.clone().multiplyScalar(clusterDist));

        for(let i=0; i<10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const radius = 200 + Math.random() * 200; 
            const x = clusterCenter.x + Math.cos(angle) * radius;
            const z = clusterCenter.z + Math.sin(angle) * radius;
            
            const traits = {
                skinColor: SKINS[Math.floor(Math.random() * SKINS.length)],
                gender: Math.random() > 0.5 ? 'male' : 'female',
                height: 0.7 + (Math.random() * 0.6),
                hairStyle: Math.random() > 0.5 ? 'long' : 'short',
                roundFace: Math.random() > 0.5,
                broadShoulders: Math.random() > 0.5
            };

            const hPrefab = new HumanPrefab(traits);
            hPrefab.group.position.set(x, 0, z); scene.add(hPrefab.group); humans.push(hPrefab.group);
            const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff0000, transparent: true, opacity: 0.5, fog: false, depthTest: false }));
            dot.renderOrder = 999; scene.add(dot); dots.push(dot);
            dot.userData = { human: hPrefab.group, heartHeight: hPrefab.heartHeight, phase: Math.random() * 10, gazeTime: 0 };
            hPrefab.group.userData.traits = traits;
            hPrefab.group.userData.consumption = 0;
            hPrefab.group.userData.isMelting = false;
            hPrefab.group.userData.isEscaping = false;
        }
    }

    return { 
        dots, humans, tentacles, 
        get currentPhase() { return currentPhase; },
        setPhase: (val) => { currentPhase = val; },
        skipPhase: (setupEnv) => triggerPhaseTransition(setupEnv),
        get debugActive() { return debugActive; },
        setDebugActive: (val) => { debugActive = val; },
        getGlobalMeltHuman: () => globalMeltHuman,
        setGlobalMeltHuman,
        getMovementDisabled: () => movementDisabled,
        setMovementDisabled,
        get survivorTraits() { return survivorTraits; },
        finalizeSurvivor,
        spawn, 
        spawnDebug,
        recordConsumption,
        triggerPhaseTransition 
    };
}
