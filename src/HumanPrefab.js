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

        // ARMS (Two-part: Shoulder and Elbow)
        this.arms = [];
        for (let i = 0; i < 2; i++) {
            const isLeft = i === 0;
            const shoulderPivot = new THREE.Group();
            shoulderPivot.position.set(isLeft ? -22 * sw * h : 22 * sw * h, 145 * h, 0); 
            shoulderPivot.rotation.z = isLeft ? 0.2 : -0.2;
            this.group.add(shoulderPivot);

            const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(5 * h, 4 * h, 35 * h, 6), mat);
            upperArm.position.y = -17.5 * h;
            shoulderPivot.add(upperArm);

            const elbowPivot = new THREE.Group();
            elbowPivot.position.y = -35 * h;
            shoulderPivot.add(elbowPivot);

            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(4 * h, 3 * h, 35 * h, 6), mat);
            forearm.position.y = -17.5 * h;
            elbowPivot.add(forearm);

            this.arms.push({ shoulder: shoulderPivot, elbow: elbowPivot });
        }

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

        // Features placement Z (ensure it's outside the head even when scaled)
        const frontZ = (traits.gender === 'female' ? 11 : 10.5) * h;

        // Default eyes
        let eSize = 3, ePos = {x: 5, y: 4}, eScale = {x: 1, y: 1}, eRot = 0;
        // Default nose
        let nSize = {w: 4, h: 6, d: 4}, nPos = {y: -2};
        // Default mouth
        let mSize = {w: 8, h: 2}, mPos = {y: -8};

        if (ft === 0) { // The Observer: Huge circular eyes, dot nose, tiny dot mouth
            eSize = 6; eScale = {x: 1, y: 1}; ePos = {x: 6, y: 4};
            nSize = {w: 2, h: 2, d: 2}; nPos = {y: -2};
            mSize = {w: 2, h: 2}; mPos = {y: -10};
        } else if (ft === 1) { // The Grinner: Extreme narrow slanted eyes, pointed nose, very wide thin smile
            eSize = 5; eScale = {x: 1.2, y: 0.2}; ePos = {x: 6, y: 6}; eRot = 0.4;
            nSize = {w: 3, h: 8, d: 5}; nPos = {y: -1};
            mSize = {w: 16, h: 0.5}; mPos = {y: -9};
        } else if (ft === 2) { // The Stoic: High square eyes, very wide flat nose, thin line mouth
            eSize = 3; ePos = {x: 5, y: 8};
            nSize = {w: 12, h: 2, d: 2}; nPos = {y: 0};
            mSize = {w: 8, h: 0.5}; mPos = {y: -8};
        } else if (ft === 3) { // The Delicate: Low tiny pin-prick eyes, long thin nose, small open mouth
            eSize = 1.2; ePos = {x: 4, y: 0};
            nSize = {w: 1.5, h: 10, d: 4}; nPos = {y: -4};
            mSize = {w: 4, h: 3}; mPos = {y: -12};
        } else if (ft === 4) { // The Stern: Angry down-slanted eyes, big blocky nose, wide frown
            eSize = 4; eScale = {x: 1.1, y: 0.5}; ePos = {x: 5, y: 5}; eRot = -0.3;
            nSize = {w: 7, h: 7, d: 5}; nPos = {y: -2};
            mSize = {w: 12, h: 1.5}; mPos = {y: -11};
            
            // Add blocky eyebrows
            const browGeo = new THREE.BoxGeometry(6 * h, 1.5 * h, 1 * h);
            const browL = new THREE.Mesh(browGeo, eyeMat);
            browL.position.set(-5 * h, head.position.y + 8 * h, frontZ);
            browL.rotation.z = -0.2;
            const browR = new THREE.Mesh(browGeo, eyeMat);
            browR.position.set(5 * h, head.position.y + 8 * h, frontZ);
            browR.rotation.z = 0.2;
            this.group.add(browL, browR);
        }

        // Apply scaling to features positions
        const ex = ePos.x * h, ey = ePos.y * h;
        const nw = nSize.w * h, nh = nSize.h * h, nd = nSize.d * h, ny = nPos.y * h;
        const mw = mSize.w * h, mh = mSize.h * h, my = mPos.y * h;

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(eSize * h, eSize * h, 2 * h);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-ex, head.position.y + ey, frontZ);
        eyeL.scale.set(eScale.x, eScale.y, 1);
        eyeL.rotation.z = eRot;
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(ex, head.position.y + ey, frontZ);
        eyeR.scale.set(eScale.x, eScale.y, 1);
        eyeR.rotation.z = -eRot;
        this.group.add(eyeL, eyeR);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(nw, nh, nd), mat);
        nose.position.set(0, head.position.y + ny, frontZ + nd/2 - (1*h));
        this.group.add(nose);

        // Mouth
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 2 * h), mouthMat);
        mouth.position.set(0, head.position.y + my, frontZ);
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
        this.group.userData.arms = this.arms;
        this.group.userData.legPhase = 0;

        // HIT SPHERE attached to group for reliable access
        const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(50, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hitSphere.position.y = this.heartHeight;
        this.group.add(hitSphere);
        this.group.userData.hitSphere = hitSphere;
    }
}
