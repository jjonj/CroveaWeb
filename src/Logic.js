import * as THREE from 'three';
import { HumanPrefab } from './HumanPrefab.js';

export const PHASES = { VOID_PAIR: 0, CAVE_GROUP: 1 };
const SKINS = [0x4b3621, 0x8d5524, 0xc68642, 0xf1c27d, 0xffdbac];

export function createLogic(scene, camera, glowTexture) {
    const dots = [], humans = [], tentacles = [];
    let currentPhase = PHASES.VOID_PAIR;
    let globalMeltHuman = null;
    let movementDisabled = false;

    function spawn() {
        dots.forEach(d => scene.remove(d)); humans.forEach(h => scene.remove(h));
        dots.length = 0; humans.length = 0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
        const count = (currentPhase === PHASES.VOID_PAIR) ? 2 : 5;
        for(let i=0; i<count; i++) {
            const angle = ((i / (count-1 || 1)) - 0.5) * Math.PI * 0.4;
            const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            const x = camera.position.x + dir.x * 800, z = camera.position.z + dir.z * 800;
            const hPrefab = new HumanPrefab({ 
                skinColor: SKINS[i % SKINS.length], 
                gender: (i===0 && currentPhase===PHASES.VOID_PAIR)?'male':'female', 
                height: (i===1 && currentPhase===PHASES.VOID_PAIR)?0.85:1.0, 
                broadShoulders: (i===0 && currentPhase===PHASES.VOID_PAIR) 
            });
            hPrefab.group.position.set(x, 0, z); scene.add(hPrefab.group); humans.push(hPrefab.group);
            const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff0000, transparent: true, opacity: 0.5, fog: false, depthTest: false }));
            dot.renderOrder = 999; scene.add(dot); dots.push(dot);
            dot.userData = { human: hPrefab.group, heartHeight: hPrefab.heartHeight, phase: Math.random() * 10, gazeTime: 0 };
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
        currentPhase = PHASES.CAVE_GROUP; setupEnv(true); spawn();
        fade.style.opacity = '0'; 
        setMovementDisabled(false);
        setGlobalMeltHuman(null);
    }

    function setMovementDisabled(val) { movementDisabled = val; }
    function setGlobalMeltHuman(val) { globalMeltHuman = val; }

    return { 
        dots, humans, tentacles, 
        currentPhase, 
        getGlobalMeltHuman: () => globalMeltHuman,
        setGlobalMeltHuman,
        getMovementDisabled: () => movementDisabled,
        setMovementDisabled,
        spawn, 
        triggerPhaseTransition 
    };
}
