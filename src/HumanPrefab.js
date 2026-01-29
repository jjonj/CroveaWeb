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
            const bGeo = new THREE.SphereGeometry(8 * h, 8, 8);
            const bL = new THREE.Mesh(bGeo, mat); bL.position.set(-10, 140 * h, 15);
            const bR = new THREE.Mesh(bGeo, mat); bR.position.set(10, 140 * h, 15);
            this.group.add(bL, bR);
        }

        // ARMS
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(5 * h, 4 * h, 65 * h, 6), mat);
        armL.position.set(-22 * sw * h, 145 * h, 0); armL.rotation.z = 0.2; this.group.add(armL);
        const armR = new THREE.Mesh(new THREE.CylinderGeometry(5 * h, 4 * h, 65 * h, 6), mat);
        armR.position.set(22 * sw * h, 145 * h, 0); armR.rotation.z = -0.2; this.group.add(armR);

        const head = new THREE.Mesh(new THREE.BoxGeometry(20 * (traits.roundFace ? 1.2 : 1.0), 24, 20), mat);
        head.position.y = 165 * h + 12 * h; this.group.add(head);

        // FACIAL FEATURES
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(4, 4, 2);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-5, head.position.y + 4, 10);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(5, head.position.y + 4, 10);
        this.group.add(eyeL, eyeR);

        const nose = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 4), mat);
        nose.position.set(0, head.position.y - 2, 11);
        this.group.add(nose);

        const mouth = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2), eyeMat);
        mouth.position.set(0, head.position.y - 8, 10);
        this.group.add(mouth);

        // HAIR (Placeholders)
        if (traits.hairStyle === 'long') {
            const hairGeo = new THREE.BoxGeometry(22, 60, 22);
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 165 * h, -5);
            this.group.add(hair);
        } else if (traits.hairStyle === 'short') {
            const hairGeo = new THREE.BoxGeometry(22, 10, 22);
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.set(0, 165 * h + 24, 0);
            this.group.add(hair);
        }

        this.heartHeight = 145 * h;
        this.group.userData.legs = [legL, legR];
        this.group.userData.arms = [armL, armR];
        this.group.userData.legPhase = 0;

        // HIT SPHERE attached to group for reliable access
        const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(50, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hitSphere.position.y = this.heartHeight;
        this.group.add(hitSphere);
        this.group.userData.hitSphere = hitSphere;
    }
}
