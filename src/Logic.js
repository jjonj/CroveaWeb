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

    // The current state of available trait options
    const traitPool = {
        skinColor: [...SKINS],
        height: [0.8, 0.9, 1.0, 1.1, 1.2],
        hairStyle: ['long', 'short'],
        roundFace: [true, false],
        broadShoulders: [true, false]
    };

    let activeSelectionTraits = [];

    // The "Result" traits that will persist
    let survivorTraits = {
        skinColor: 0xffdbac,
        height: 1.0,
        hairStyle: 'long',
        roundFace: false,
        gender: 'female',
        broadShoulders: false
    };

    function spawn() {
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        const groupCenters = {}; 

        let count = 0;
        if (currentPhase === PHASES.VOID_PAIR) {
            count = 2;
        } else if (currentPhase === PHASES.CAVE_GROUP) {
            // Check if we are at the final choice (only 2 humans)
            const unlockedTraits = Object.keys(traitPool).filter(k => traitPool[k].length > 1);
            count = (unlockedTraits.length === 0 || (unlockedTraits.length === 1 && traitPool[unlockedTraits[0]].length === 2)) ? 2 : 4;
        }

        const clusterDist = (currentPhase === PHASES.VOID_PAIR) ? 1200 : 800;
        const clusterCenter = camera.position.clone().add(forward.clone().multiplyScalar(clusterDist));

        // Prepare traits for the round if in CAVE_GROUP
        let roundTraitValues = { left: {}, right: {} };
        if (currentPhase === PHASES.CAVE_GROUP) {
            const unlocked = Object.keys(traitPool).filter(k => traitPool[k].length > 1);
            // Pick up to 3 traits to vary
            activeSelectionTraits = unlocked.sort(() => Math.random() - 0.5).slice(0, 3);
            
            activeSelectionTraits.forEach(trait => {
                const values = [...traitPool[trait]].sort(() => Math.random() - 0.5);
                roundTraitValues.left[trait] = values[0];
                roundTraitValues.right[trait] = values[1] || values[0];
            });
        }

        for(let i=0; i<count; i++) {
            let x, z;
            if (currentPhase === PHASES.CAVE_GROUP) {
                const isRightPair = i >= (count / 2);
                const pairIndex = i % 2; // 0 or 1 within the pair
                
                const angleOffset = isRightPair ? 0.4 : -0.4;
                const dist = clusterDist;
                const center = camera.position.clone().add(forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), angleOffset).multiplyScalar(dist));
                
                const spread = 80;
                x = center.x + (pairIndex === 0 ? -spread : spread);
                z = center.z + (pairIndex === 0 ? -spread : spread);
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
                const isRightPair = i >= (count / 2);
                const side = isRightPair ? 'right' : 'left';
                
                traits = {
                    gender: survivorTraits.gender,
                };

                // Apply selected traits
                activeSelectionTraits.forEach(t => {
                    traits[t] = roundTraitValues[side][t];
                });

                // Fill other traits from pool (randomly to keep them unique/ambiguous)
                Object.keys(traitPool).forEach(t => {
                    if (traits[t] === undefined) {
                        const possible = traitPool[t];
                        traits[t] = possible[Math.floor(Math.random() * possible.length)];
                    }
                });

                // "Unique body types" - add some jitter to height if not a selected trait
                if (!activeSelectionTraits.includes('height')) {
                    traits.height += (Math.random() - 0.5) * 0.1;
                }
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
            hPrefab.group.userData.radius = 40;
            hPrefab.group.userData.side = (i < count/2) ? 'left' : 'right';
        }

        // Link pairs
        if (currentPhase === PHASES.CAVE_GROUP && count === 4) {
            humans[0].userData.partner = humans[1];
            humans[1].userData.partner = humans[0];
            humans[2].userData.partner = humans[3];
            humans[3].userData.partner = humans[2];
        }
    }

    function createTentacleMesh() {
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), 20, 5, 8, false), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        scene.add(mesh); return { mesh, reach: 0 };
    }
    for(let i=0; i<8; i++) tentacles.push(createTentacleMesh());

    async function triggerPhaseTransition(setupEnv) {
        const fade = document.getElementById('screen-fade'); fade.style.opacity = '1';
        await new Promise(r => setTimeout(r, 1000));
        
        if (currentPhase === PHASES.VOID_PAIR) currentPhase = PHASES.CAVE_GROUP;
        else if (currentPhase === PHASES.CAVE_GROUP) currentPhase = PHASES.DAWN;

        if (currentPhase === PHASES.DAWN) {
            dots.forEach(d => scene.remove(d)); 
            humans.forEach(h => scene.remove(h));
            dots.length = 0; humans.length = 0;

            setupEnv(false, true); 
            console.log("FINAL SURVIVOR TRAITS:", survivorTraits);
        } else {
            setupEnv(currentPhase !== PHASES.VOID_PAIR, false); spawn();
        }

        fade.style.opacity = '0'; 
        setMovementDisabled(false);
        setGlobalMeltHuman(null);
    }

    function recordConsumption(traits) {
        if (currentPhase === PHASES.VOID_PAIR) {
            const survivor = humans.find(h => h.userData.traits !== traits);
            if (survivor) {
                survivorTraits.gender = survivor.userData.traits.gender;
                // Lock gender in pool
                traitPool.gender = [survivorTraits.gender];
            }
        } else if (currentPhase === PHASES.CAVE_GROUP) {
            // Remove the traits of the melted human from the pool
            activeSelectionTraits.forEach(t => {
                const valToRemove = traits[t];
                traitPool[t] = traitPool[t].filter(v => v !== valToRemove);
            });

            // Check if we are done with Phase 1
            const unlocked = Object.keys(traitPool).filter(k => traitPool[k].length > 1);
            if (unlocked.length === 0) {
                // Finalize survivor traits from whatever is left in the pool
                Object.keys(traitPool).forEach(t => {
                    survivorTraits[t] = traitPool[t][0];
                });
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
        get isPhaseComplete() { 
            return Object.keys(traitPool).every(k => traitPool[k].length <= 1);
        },
        finalizeSurvivor,
        spawn, 
        spawnDebug,
        recordConsumption,
        triggerPhaseTransition 
    };
}
