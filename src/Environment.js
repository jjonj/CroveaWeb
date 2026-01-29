import * as THREE from 'three';

export function createEnvironment(scene, camera) {
    scene.background = new THREE.Color(0x000000);
    const defaultFog = new THREE.FogExp2(0x000000, 0.0015);
    scene.fog = defaultFog;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(500, 1000, 500);
    scene.add(sun);

    // Player light (Lantern effect)
    const playerLight = new THREE.PointLight(0xffffff, 50, 2000, 1);
    camera.add(playerLight);
    scene.add(camera);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const stemGroup = new THREE.Group(); scene.add(stemGroup);
    const wallGroup = new THREE.Group(); scene.add(wallGroup);

    function setupEnvironment(isCave, isDawn = false) {
        stemGroup.clear(); wallGroup.clear();
        if (isDawn) {
            scene.background = new THREE.Color(0x87ceeb);
            scene.fog = new THREE.FogExp2(0x87ceeb, 0.0005);
            sun.intensity = 1.2;
            sun.color.setHex(0xffaa00);
            return;
        }
        if (!isCave) {
            for (let i = 0; i < 60; i++) {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(25, 35, 2500, 8), new THREE.MeshStandardMaterial({ color: 0x2a1b0a }));
                trunk.position.set(Math.random() * 10000 - 5000, 1250, Math.random() * 10000 - 5000);
                stemGroup.add(trunk);
            }
        } else {
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
            const wallGeo = new THREE.CylinderGeometry(2500, 2500, 1500, 16, 1, true);
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.position.set(camera.position.x, 750, camera.position.z);
            walls.material.side = THREE.BackSide;
            wallGroup.add(walls);
        }
    }

    return { setupEnvironment, defaultFog };
}

export function createGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 0, 0, 1)'); grad.addColorStop(0.4, 'rgba(255, 0, 0, 0.5)'); grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}
