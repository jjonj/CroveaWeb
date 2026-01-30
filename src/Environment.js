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

    // Create procedural textured beige for ground
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512; groundCanvas.height = 512;
    const gCtx = groundCanvas.getContext('2d');
    gCtx.fillStyle = '#a68d71'; // More brownish beige
    gCtx.fillRect(0,0,512,512);
    
    // Add noise/grit
    for(let i=0; i<40000; i++) {
        const shade = Math.random();
        if (shade > 0.8) gCtx.fillStyle = '#8b7355';
        else if (shade > 0.4) gCtx.fillStyle = '#b69d81';
        else gCtx.fillStyle = '#967d61';
        gCtx.fillRect(Math.random()*512, Math.random()*512, 1, 1);
    }
    
    // Add some larger dirt/rock patches
    for(let i=0; i<60; i++) {
        gCtx.fillStyle = 'rgba(100, 80, 60, 0.15)';
        gCtx.beginPath();
        const r = Math.random()*40 + 10;
        gCtx.arc(Math.random()*512, Math.random()*512, r, 0, Math.PI*2);
        gCtx.fill();
    }

    // Add some fine "cracks" or lines for texture
    gCtx.strokeStyle = 'rgba(60, 50, 40, 0.2)';
    for(let i=0; i<30; i++) {
        gCtx.lineWidth = 0.5;
        gCtx.beginPath();
        let x = Math.random()*512, y = Math.random()*512;
        gCtx.moveTo(x, y);
        for(let j=0; j<5; j++) {
            x += (Math.random()-0.5)*30;
            y += (Math.random()-0.5)*30;
            gCtx.lineTo(x, y);
        }
        gCtx.stroke();
    }

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(50, 50);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ 
        map: groundTex,
        roughness: 1.0 
    }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Create procedural rocky grey for walls
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512; wallCanvas.height = 512;
    const wCtx = wallCanvas.getContext('2d');
    wCtx.fillStyle = '#333333';
    wCtx.fillRect(0,0,512,512);

    for(let i=0; i<30000; i++) {
        const c = Math.floor(Math.random() * 40 + 30);
        wCtx.fillStyle = `rgb(${c},${c},${c})`;
        wCtx.fillRect(Math.random()*512, Math.random()*512, 1, 1);
    }
    
    // Add rock "cracks" and features
    wCtx.strokeStyle = '#1a1a1a';
    for(let i=0; i<20; i++) {
        wCtx.lineWidth = Math.random() * 2;
        wCtx.beginPath();
        wCtx.moveTo(Math.random()*512, Math.random()*512);
        wCtx.lineTo(Math.random()*512, Math.random()*512);
        wCtx.stroke();
    }

    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(10, 4);

    const stemGroup = new THREE.Group(); scene.add(stemGroup);
    const wallGroup = new THREE.Group(); scene.add(wallGroup);

    let sunriseState = {
        sunDisk: null,
        pool: null,
        sunLight: sun,
        hemiLight: hemi
    };

    function setupEnvironment(isCave, isDawn = false, isForest = false) {
        stemGroup.clear(); wallGroup.clear();
        sunriseState.sunDisk = null;
        sunriseState.pool = null;

        if (isForest) {
            scene.background = new THREE.Color(0x050505);
            scene.fog = new THREE.FogExp2(0x050505, 0.001);
            sun.intensity = 0.05;

            // Forest Trees (re-use logic but denser)
            for (let i = 0; i < 150; i++) {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(15, 25, 2000, 8), new THREE.MeshStandardMaterial({ color: 0x1a0f05 }));
                const angle = Math.random() * Math.PI * 2;
                const dist = 400 + Math.random() * 5000;
                trunk.position.set(Math.cos(angle)*dist, 1000, Math.sin(angle)*dist);
                stemGroup.add(trunk);
            }

            // Campfire
            const fireGroup = new THREE.Group();
            fireGroup.position.set(200, 0, 0);
            
            // Logs
            const logGeo = new THREE.CylinderGeometry(5, 5, 40, 6);
            const logMat = new THREE.MeshStandardMaterial({ color: 0x221100 });
            for(let i=0; i<4; i++) {
                const log = new THREE.Mesh(logGeo, logMat);
                log.rotation.z = Math.PI/2;
                log.rotation.y = (i/4) * Math.PI;
                fireGroup.add(log);
            }

            // Embers Glow
            const emberLight = new THREE.PointLight(0xff4400, 1.5, 800);
            emberLight.position.set(0, 10, 0);
            fireGroup.add(emberLight);

            const emberGeo = new THREE.SphereGeometry(15, 8, 8);
            const emberMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
            const embers = new THREE.Mesh(emberGeo, emberMat);
            embers.position.set(0, 2, 0);
            fireGroup.add(embers);

            stemGroup.add(fireGroup);
            return;
        }

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
            const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1.0 });
            const wallGeo = new THREE.CylinderGeometry(5000, 5000, 1500, 16, 1, true);
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.position.set(camera.position.x, 750, camera.position.z);
            walls.material.side = THREE.BackSide;
            wallGroup.add(walls);
            wallGroup.userData.center = camera.position.clone();

            // Scatter small rocks on the cave floor
            const rockGeo = new THREE.IcosahedronGeometry(1, 1);
            const rockMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1.0 });
            for (let i = 0; i < 200; i++) {
                const rock = new THREE.Mesh(rockGeo, rockMat);
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 4500;
                rock.position.set(
                    camera.position.x + Math.cos(angle) * dist,
                    0,
                    camera.position.z + Math.sin(angle) * dist
                );
                rock.scale.set(Math.random() * 15 + 5, Math.random() * 10 + 5, Math.random() * 15 + 5);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                wallGroup.add(rock);
            }
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
