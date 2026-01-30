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
    let groupCenter = new THREE.Vector3();

    // The current state of available trait options
    const traitPool = {
        skinColor: [...SKINS],
        hairColor: [0x5c0909, 0x3d2314, 0x000000, 0x8b7500, 0x1a2e1a], // dark red, dark brown, black, dark blond, dark green
        height: [0.8, 0.9, 1.0, 1.1, 1.2],
        hairStyle: ['long', 'short'],
        roundFace: [true, false],
        broadShoulders: [true, false]
    };

    let activeSelectionTraits = [];

    // The "Result" traits that will persist
    let survivorTraits = {
        skinColor: 0xffdbac,
        hairColor: 0x000000,
        height: 1.0,
        hairStyle: 'long',
        roundFace: false,
        gender: 'female',
        broadShoulders: false
    };

    const formatTraitValue = (trait, val) => {
        if (trait === 'skinColor') {
            const skinNames = {
                0x4b3621: "deep brown",
                0x8d5524: "medium brown",
                0xc68642: "light brown",
                0xf1c27d: "yellowish",
                0xffdbac: "super light"
            };
            return skinNames[val] || val;
        }
        if (trait === 'hairColor') {
            const hairNames = {
                0x5c0909: "dark red",
                0x3d2314: "dark brown",
                0x000000: "black",
                0x8b7500: "dark blond",
                0x1a2e1a: "dark green"
            };
            return hairNames[val] || val;
        }
        return val;
    };

    const formatTraitObject = (obj) => {
        const formatted = {};
        for (let k in obj) formatted[k] = formatTraitValue(k, obj[k]);
        return formatted;
    };

    function spawn() {
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        
        let count = (currentPhase === PHASES.VOID_PAIR) ? 2 : 4;
        const clusterDist = (currentPhase === PHASES.VOID_PAIR) ? 1200 : 800;
        const clusterCenter = camera.position.clone().add(forward.clone().multiplyScalar(clusterDist));
        groupCenter.copy(clusterCenter).setY(0);

        // Prepare traits for the round if in CAVE_GROUP
        let roundTraitValues = { left: {}, right: {} };
        if (currentPhase === PHASES.CAVE_GROUP) {
            const unlocked = Object.keys(traitPool).filter(k => traitPool[k].length > 1);
            // Pick up to 3 traits to vary
            activeSelectionTraits = unlocked.sort(() => Math.random() - 0.5).slice(0, 3);
            
            console.log("%c--- NEW SELECTION ROUND ---", "color: #00ff00; font-weight: bold;");
            console.log("Active Selection Traits:", activeSelectionTraits);

            activeSelectionTraits.forEach(trait => {
                const values = [...traitPool[trait]].sort(() => Math.random() - 0.5);
                roundTraitValues.left[trait] = values[0];
                roundTraitValues.right[trait] = values[1] || values[0];
            });

            console.log("Left Pair Values:", formatTraitObject(roundTraitValues.left));
            console.log("Right Pair Values:", formatTraitObject(roundTraitValues.right));
        }

        for(let i=0; i<count; i++) {
            let x, z;
            let formationOffset = new THREE.Vector3();

            if (currentPhase === PHASES.CAVE_GROUP) {
                // Fixed formation: x x   y y
                // Indices: 0 1   2 3
                const spacing = 100;
                const pairGap = 250;
                
                let localX = 0;
                if (count === 4) {
                    if (i === 0) localX = -pairGap/2 - spacing;
                    if (i === 1) localX = -pairGap/2;
                    if (i === 2) localX = pairGap/2;
                    if (i === 3) localX = pairGap/2 + spacing;
                } else {
                    // Final choice (count 2)
                    localX = (i === 0) ? -pairGap/2 : pairGap/2;
                }

                formationOffset.set(localX, 0, 0);
                // Rotate offset to match camera's forward direction
                const formationQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0), forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2));
                formationOffset.applyQuaternion(formationQuat);

                x = clusterCenter.x + formationOffset.x;
                z = clusterCenter.z + formationOffset.z;
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
            hPrefab.group.userData.formationOffset = formationOffset;
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
            console.log(`%cELIMINATING PAIR (${traits.side})`, "color: #ff4444; font-weight: bold;");
            // Remove the traits of the melted human from the pool
            activeSelectionTraits.forEach(t => {
                const valToRemove = traits[t];
                console.log(`Eliminating ${t}: ${formatTraitValue(t, valToRemove)}`);
                traitPool[t] = traitPool[t].filter(v => v !== valToRemove);
            });

            // Check if we are done with Phase 1
            const unlocked = Object.keys(traitPool).filter(k => traitPool[k].length > 1);
            
            const formattedPool = {};
            for (let k in traitPool) {
                formattedPool[k] = traitPool[k].map(v => formatTraitValue(k, v));
            }
            console.log("Remaining Trait Pool:", formattedPool);

            if (unlocked.length === 0) {
                // Finalize survivor traits from whatever is left in the pool
                Object.keys(traitPool).forEach(t => {
                    survivorTraits[t] = traitPool[t][0];
                });
                console.log("%cALL TRAITS LOCKED", "color: #00ffff; font-weight: bold;");
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
        dots, humans, tentacles, groupCenter,
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
