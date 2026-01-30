import * as THREE from 'three';

export function createEnvironment(scene, camera) {
    scene.background = new THREE.Color(0x000000);
    const defaultFog = new THREE.FogExp2(0x000000, 0.0015);
    scene.fog = defaultFog;

    scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.2);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 0.3);
    sun.position.set(500, 1000, 500);
    scene.add(sun);

    // Player light (Lantern effect)
    const playerLight = new THREE.PointLight(0xffffff, 1.0, 3000, 1);
    camera.add(playerLight);
    scene.add(camera);

    // Create procedural grid texture for ground
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d2b48c'; 
    ctx.fillRect(0,0,512,512);
    
    // Add noise/grit
    for(let i=0; i<10000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#c2a47c' : '#e2c49c';
        ctx.fillRect(Math.random()*512, Math.random()*512, 2, 2);
    }
    
    // Add Grid
    ctx.strokeStyle = '#b2946c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i=0; i<=512; i+=64) {
        ctx.moveTo(i, 0); ctx.lineTo(i, 512);
        ctx.moveTo(0, i); ctx.lineTo(512, i);
    }
    ctx.stroke();

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(100, 100);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ 
        map: groundTex,
        roughness: 1.0 
    }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const stemGroup = new THREE.Group(); scene.add(stemGroup);
    const wallGroup = new THREE.Group(); scene.add(wallGroup);

    let sunriseState = {
        sunDisk: null,
        pool: null,
        sunLight: sun,
        hemiLight: hemi
    };

    function setupEnvironment(isCave, isDawn = false) {
        stemGroup.clear(); wallGroup.clear();
        sunriseState.sunDisk = null;
        sunriseState.pool = null;

        if (isDawn) {
            scene.background = new THREE.Color(0x1a0505); 
            scene.fog = new THREE.FogExp2(0x1a0505, 0.0002);
            sun.intensity = 0.2;
            sun.color.setHex(0xff3300);
            sun.position.set(0, -500, -8000); 

            // Red Sun Disk
            const sunDisk = new THREE.Mesh(
                new THREE.CircleGeometry(500, 32),
                new THREE.MeshBasicMaterial({ color: 0xff0000, fog: false })
            );
            sunDisk.position.set(0, -500, -8000);
            stemGroup.add(sunDisk);
            sunriseState.sunDisk = sunDisk;

            // Reflective Pool
            const poolGeo = new THREE.CircleGeometry(400, 32);
            const poolMat = new THREE.MeshStandardMaterial({ 
                color: 0x000000, 
                metalness: 1.0, 
                roughness: 0.1,
                emissive: 0x110000,
                transparent: true,
                opacity: 0.8
            });
            const pool = new THREE.Mesh(poolGeo, poolMat);
            pool.rotation.x = -Math.PI / 2;
            pool.position.set(camera.position.x, 2, camera.position.z - 800);
            stemGroup.add(pool);
            sunriseState.pool = pool;

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
            const wallGeo = new THREE.CylinderGeometry(5000, 5000, 1500, 16, 1, true);
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.position.set(camera.position.x, 750, camera.position.z);
            walls.material.side = THREE.BackSide;
            wallGroup.add(walls);
            wallGroup.userData.center = camera.position.clone();
        }
    }

    return { setupEnvironment, defaultFog, wallGroup, sunriseState };
}

export function createGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 0, 0, 1)'); grad.addColorStop(0.4, 'rgba(255, 0, 0, 0.5)'); grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}
