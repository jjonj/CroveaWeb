import * as THREE from 'three';

export class HumanPrefab {
    constructor(traits) {
        this.group = new THREE.Group();
        this.traits = traits;
        const mat = new THREE.MeshStandardMaterial({ 
            color: traits.skinColor, 
            roughness: 0.4, 
            metalness: 0.1,
            emissive: traits.skinColor,
            emissiveIntensity: 0.05,
            transparent: true 
        });
        const h = traits.height || 1.0;
        const sw = traits.broadShoulders ? 1.6 : 1.0;
        
        // LEGS
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(8 * h, 6 * h, 90 * h, 6), mat);
        legL.position.set(-12, 45 * h, 0); this.group.add(legL);
        const legR = new THREE.Mesh(new THREE.CylinderGeometry(8 * h, 6 * h, 90 * h, 6), mat);
        legR.position.set(12, 45 * h, 0); this.group.add(legR);

        // TORSO
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(25 * sw * h, 18 * h, 75 * h, 8), mat);
        torso.position.y = 90 * h + 37.5 * h; this.group.add(torso);
        
        if (traits.gender === 'female') {
            const bGeo = new THREE.SphereGeometry(14 * h, 12, 12); // Increased radius from 8 to 14
            const bL = new THREE.Mesh(bGeo, mat); bL.position.set(-12, 138 * h, 20); // Adjusted position
            const bR = new THREE.Mesh(bGeo, mat); bR.position.set(12, 138 * h, 20); // Adjusted position
            this.group.add(bL, bR);
        }

        // ARMS
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(5 * h, 4 * h, 65 * h, 6), mat);
        const pL = new THREE.Group(); pL.add(armL);
        pL.position.set(-22 * sw * h, 145 * h, 0); 
        pL.rotation.z = 0.2; 
        armL.position.y = -32.5 * h;
        this.group.add(pL);
        
        const armR = new THREE.Mesh(new THREE.CylinderGeometry(5 * h, 4 * h, 65 * h, 6), mat);
        const pR = new THREE.Group(); pR.add(armR);
        pR.position.set(22 * sw * h, 145 * h, 0); 
        pR.rotation.z = -0.2; 
        armR.position.y = -32.5 * h;
        this.group.add(pR);

        // HEAD
        let headGeo;
        if (traits.gender === 'female') {
            headGeo = new THREE.SphereGeometry(15 * h, 16, 12);
            headGeo.scale(0.8, 0.9, 0.7); // Slightly flattened sphere
        } else {
            headGeo = new THREE.BoxGeometry(20 * h, 24 * h, 20 * h);
        }
        const head = new THREE.Mesh(headGeo, mat);
        head.position.y = 165 * h + 12 * h; this.group.add(head);

        // UNIQUE FACIAL FEATURES (Based on faceType)
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const ft = traits.faceType || 0;

        // Default eyes
        let eSize = 3, ePos = {x: 5, y: 4}, eScale = {x: 1, y: 1};
        // Default nose
        let nSize = {w: 4, h: 6, d: 4}, nPos = {y: -2};
        // Default mouth
        let mSize = {w: 8, h: 2}, mPos = {y: -8};

        if (ft === 0) { // The Observer: Wide circular eyes, tiny nose, small mouth
            eSize = 5; eScale = {x: 1, y: 1};
            nSize = {w: 2, h: 2, d: 3}; nPos = {y: -2};
            mSize = {w: 4, h: 2}; mPos = {y: -10};
        } else if (ft === 1) { // The Grinner: Narrow eyes, pointed nose, wide smile
            eSize = 4; eScale = {x: 1.2, y: 0.4}; ePos = {x: 6, y: 6};
            nSize = {w: 3, h: 8, d: 5}; nPos = {y: -1};
            mSize = {w: 14, h: 1.5}; mPos = {y: -9};
        } else if (ft === 2) { // The Stoic: High square eyes, flat wide nose, tiny line mouth
            eSize = 3; ePos = {x: 5, y: 8};
            nSize = {w: 8, h: 3, d: 3}; nPos = {y: 0};
            mSize = {w: 6, h: 1}; mPos = {y: -8};
        } else if (ft === 3) { // The Delicate: Low tiny eyes, long thin nose, open mouth
            eSize = 2; ePos = {x: 4, y: 0};
            nSize = {w: 2, h: 10, d: 4}; nPos = {y: -4};
            mSize = {w: 6, h: 4}; mPos = {y: -12};
        } else if (ft === 4) { // The Stern: Angry slanted eyes, blocky nose, frown
            eSize = 4; eScale = {x: 1, y: 0.6}; ePos = {x: 5, y: 5};
            nSize = {w: 6, h: 6, d: 5}; nPos = {y: -2};
            mSize = {w: 10, h: 2}; mPos = {y: -10};
        }

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(eSize, eSize, 2);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-ePos.x, head.position.y + ePos.y, 10);
        eyeL.scale.set(eScale.x, eScale.y, 1);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(ePos.x, head.position.y + ePos.y, 10);
        eyeR.scale.set(eScale.x, eScale.y, 1);
        if (ft === 4) { eyeL.rotation.z = 0.3; eyeR.rotation.z = -0.3; } // Angry slant
        this.group.add(eyeL, eyeR);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(nSize.w, nSize.h, nSize.d), mat);
        nose.position.set(0, head.position.y + nPos.y, 10 + nSize.d/2);
        this.group.add(nose);

        // Mouth
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(mSize.w, mSize.h, 2), mouthMat);
        mouth.position.set(0, head.position.y + mPos.y, 10);
        this.group.add(mouth);

        // HAIR
        const hairMat = new THREE.MeshStandardMaterial({ color: traits.hairColor || 0x111111 });
        if (traits.hairStyle === 'long') {
            const hairGeo = new THREE.BoxGeometry(22, 60, 22);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 165 * h, -5);
            this.group.add(hair);
        } else if (traits.hairStyle === 'short') {
            const hairGeo = new THREE.BoxGeometry(22, 10, 22);
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 165 * h + 24, 0);
            this.group.add(hair);
        }

        this.heartHeight = 145 * h;
        this.group.userData.legs = [legL, legR];
        this.group.userData.arms = [pL, pR];
        this.group.userData.legPhase = 0;

        // HIT SPHERE attached to group for reliable access
        const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(50, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hitSphere.position.y = this.heartHeight;
        this.group.add(hitSphere);
        this.group.userData.hitSphere = hitSphere;
    }
}
