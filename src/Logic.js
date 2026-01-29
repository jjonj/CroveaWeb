import * as THREE from 'three';
import { HumanPrefab } from './HumanPrefab.js';

export const PHASES = { VOID_PAIR: 0, CAVE_GROUP: 1, FINAL_FAMILY: 2, DAWN: 3 };
const SKINS = [0x4b3621, 0x8d5524, 0xc68642, 0xf1c27d, 0xffdbac];

export function createLogic(scene, camera, glowTexture) {
    const dots = [], humans = [], tentacles = [];
    let currentPhase = PHASES.VOID_PAIR;
    let globalMeltHuman = null;
    let movementDisabled = false;

    // The "Result" traits that will persist
    let survivorTraits = {
        skinColor: null,
        height: null,
        hairStyle: 'long',
        roundFace: false,
        gender: 'female'
    };

    function updateNarrative(text) {
        const el = document.getElementById('narrative');
        if (el) el.innerText = text;
    }

        function spawn() {
            dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
            dots.length = 0; humans.length = 0;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
            
            let count = 0;
            if (currentPhase === PHASES.VOID_PAIR) {
                count = 2;
                updateNarrative("Follow the faint red pulsing...");
            } else if (currentPhase === PHASES.CAVE_GROUP) {
                count = 5;
                updateNarrative("Consume the traits you wish to fade from this world...");
            } else if (currentPhase === PHASES.FINAL_FAMILY) {
                count = 3;
                updateNarrative("Only one can remain...");
            }
    
            // Cluster Center
            const clusterDist = (currentPhase === PHASES.VOID_PAIR) ? 1200 : 700;
            const clusterCenter = camera.position.clone().add(forward.clone().multiplyScalar(clusterDist));
    
            for(let i=0; i<count; i++) {
                // Spawn each human slightly offset from the cluster center
                const angle = (i / count) * Math.PI * 2;
                const radius = 50 + Math.random() * 50; // Tight cluster radius (0.5m - 1.0m)
                const x = clusterCenter.x + Math.cos(angle) * radius;
                const z = clusterCenter.z + Math.sin(angle) * radius;
                
                let traits = {};
                // ... [traits selection logic remains same]
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
                        gender: 'female',
                        height: 0.8 + (Math.random() * 0.4),
                        hairStyle: Math.random() > 0.5 ? 'long' : 'short',
                        roundFace: Math.random() > 0.5
                    };
                } else if (currentPhase === PHASES.FINAL_FAMILY) {
                    const ages = [1.1, 0.9, 0.6];
                    traits = {
                        skinColor: survivorTraits.skinColor || SKINS[0],
                        gender: 'female',
                        height: ages[i],
                        hairStyle: survivorTraits.hairStyle,
                        roundFace: survivorTraits.roundFace
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
            }
        }
    function createTentacleMesh() {
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), 20, 5, 8, false), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
        scene.add(mesh); return { mesh, reach: 0 };
    }
    for(let i=0; i<4; i++) tentacles.push(createTentacleMesh());

    async function triggerPhaseTransition(setupEnv) {
        const fade = document.getElementById('screen-fade'); fade.style.opacity = '1';
        await new Promise(r => setTimeout(r, 2000));
        
        if (currentPhase === PHASES.VOID_PAIR) currentPhase = PHASES.CAVE_GROUP;
        else if (currentPhase === PHASES.CAVE_GROUP) currentPhase = PHASES.FINAL_FAMILY;
        else if (currentPhase === PHASES.FINAL_FAMILY) currentPhase = PHASES.DAWN;

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
        // Except for Phase 1 where it selects the base.
        if (currentPhase === PHASES.VOID_PAIR) {
            survivorTraits.gender = traits.gender;
            survivorTraits.skinColor = traits.skinColor;
        }
        // In Phase 2, we "narrow down" by eliminating traits.
        // In Phase 3, we consume 2 and 1 escapes.
    }

    function setMovementDisabled(val) { movementDisabled = val; }
    function setGlobalMeltHuman(val) { globalMeltHuman = val; }

    function spawnDebug() {
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        updateNarrative("DEBUG MODE: 10 Random Humans Generated");
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
        getGlobalMeltHuman: () => globalMeltHuman,
        setGlobalMeltHuman,
        getMovementDisabled: () => movementDisabled,
        setMovementDisabled,
        spawn, 
        spawnDebug,
        recordConsumption,
        triggerPhaseTransition 
    };
}
