import * as THREE from 'three';
import { gsap } from "gsap";

import vertexShader from './shaders/vertexShader.glsl'
import fragmentShader from './shaders/fragmentShader.glsl'
import TouchTexture from './TouchTexture';

export default class Particles {
	
	constructor(camera, interactiveControls) { // constructor originally gets webgl instance
		// this.webgl = webgl;
		this.camera = camera
		this.interactive = interactiveControls
		this.container = new THREE.Object3D()
	}

	init(src) {
		const loader = new THREE.TextureLoader();

		loader.load(src, (texture) => {
			this.texture = texture;
			this.texture.minFilter = THREE.LinearFilter;
			this.texture.magFilter = THREE.LinearFilter;
			this.texture.format = THREE.RGBAFormat; // previously RGBFormat

			this.width = texture.image.width;
			this.height = texture.image.height;

			this.initPoints(true);
			this.initHitArea();
			this.initTouch();
			this.resize();
			this.show(); // also adds listeners in the end
		});
	}

	initPoints(discard) {
		this.numPoints = this.width * this.height;

		let numVisible = this.numPoints;
		let threshold = 0;
		let originalColors;

		if (discard) {
			// discard pixels darker than threshold #22
			numVisible = 0;
			threshold = 34;

			const img = this.texture.image;
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = this.width;
			canvas.height = this.height;
			ctx.scale(1, -1);
			ctx.drawImage(img, 0, 0, this.width, this.height * -1);

			const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			originalColors = Float32Array.from(imgData.data);

			for (let i = 0; i < this.numPoints; i++) {
				if (originalColors[i * 4 + 0] > threshold) numVisible++;
			}

			console.log('numVisible', numVisible, this.numPoints);
		}

		const uniforms = {
			uTime: { value: 0 },
			uRandom: { value: 1.0 },
			uDepth: { value: 2.0 },
			uSize: { value: 0.0 },
			uTextureSize: { value: new THREE.Vector2(this.width, this.height) },
			uTexture: { value: this.texture },
			uTouch: { value: null },
		};

		const material = new THREE.RawShaderMaterial({
			uniforms,
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			depthTest: false,
			transparent: true,
			// blending: THREE.AdditiveBlending
		});

		const geometry = new THREE.InstancedBufferGeometry();

		// positions
		const positions = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
		positions.setXYZ(0, -0.5,  0.5,  0.0);
		positions.setXYZ(1,  0.5,  0.5,  0.0);
		positions.setXYZ(2, -0.5, -0.5,  0.0);
		positions.setXYZ(3,  0.5, -0.5,  0.0);
		geometry.setAttribute('position', positions);

		// uvs
		const uvs = new THREE.BufferAttribute(new Float32Array(4 * 2), 2);
		uvs.setXYZ(0,  0.0,  0.0);
		uvs.setXYZ(1,  1.0,  0.0);
		uvs.setXYZ(2,  0.0,  1.0);
		uvs.setXYZ(3,  1.0,  1.0);
		geometry.setAttribute('uv', uvs);

		// index
		geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([ 0, 2, 1, 2, 3, 1 ]), 1));

		const indices = new Uint16Array(numVisible);
		const offsets = new Float32Array(numVisible * 3);
		const angles = new Float32Array(numVisible);

		for (let i = 0, j = 0; i < this.numPoints; i++) {
			if (discard && originalColors[i * 4 + 0] <= threshold) continue;

			// setting offsets.xy to be the pixel positions of the image
			offsets[j * 3 + 0] = i % this.width;
			offsets[j * 3 + 1] = Math.floor(i / this.width);

			indices[j] = i;

			angles[j] = Math.random() * Math.PI;

			j++;
		}

		geometry.setAttribute('pindex', new THREE.InstancedBufferAttribute(indices, 1, false));
		geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3, false));
		geometry.setAttribute('angle', new THREE.InstancedBufferAttribute(angles, 1, false));

		this.instancedMesh = new THREE.Mesh(geometry, material);
		this.container.add(this.instancedMesh);
	}

	// initialize TouchTexture,
	// which converts the mouse trail into a greyscale texture used by shaders
	// to animate the particles
	initTouch() {
		// create only once
		if (!this.touch) this.touch = new TouchTexture(this);
		this.instancedMesh.material.uniforms.uTouch.value = this.touch.texture;
	}

	initHitArea() {
		const geometry = new THREE.PlaneGeometry(this.width, this.height, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, wireframe: true, depthTest: false });
		material.visible = false;
		this.hitArea = new THREE.Mesh(geometry, material);
		this.container.add(this.hitArea);
	}

	addListeners() {
		// why use bind?
		// funcA.bind(context) is to assign the input context as "this" in "funcA"
		this.handlerInteractiveMove = this.onInteractiveMove.bind(this);

		// when InteractiveControls(senses mouse/touch movements) emits "interactive-move"
		// Particles.onInteractiveMove is called
		this.interactive.addListener('interactive-move', this.handlerInteractiveMove);
		this.interactive.objects.push(this.hitArea);
		this.interactive.enable();
	}

	removeListeners() {
		this.interactive.removeListener('interactive-move', this.handlerInteractiveMove);
		
		const index = this.interactive.objects.findIndex(obj => obj === this.hitArea);
		this.interactive.objects.splice(index, 1);
		this.interactive.disable();
	}

	// ---------------------------------------------------------------------------------------------
	// PUBLIC
	// ---------------------------------------------------------------------------------------------

	update(delta) {
		if (!this.instancedMesh) return;
		if (this.touch) this.touch.update();

		this.instancedMesh.material.uniforms.uTime.value += delta;
	}

	show(time = 1.0) {
		// reset
		gsap.fromTo(this.instancedMesh.material.uniforms.uSize, { value: 0.5 }, { value: 1.5, duration: time });
		gsap.to(this.instancedMesh.material.uniforms.uRandom, { value: 2.0, duration: time });
		gsap.fromTo(this.instancedMesh.material.uniforms.uDepth, { value: 40.0 }, { value: 4.0, duration: time * 1.5 });

		this.addListeners();
	}

	hide(_destroy, time = 0.8) {
		return new Promise((resolve, reject) => {
			gsap.to(this.instancedMesh.material.uniforms.uRandom, { value: 5.0, duration: time, onComplete: () => {
				if (_destroy) this.destroy();
				resolve();
			} });
			gsap.to(this.instancedMesh.material.uniforms.uDepth, { value: -20.0, duration: time, ease: Quad.easeIn });
			gsap.to(this.instancedMesh.material.uniforms.uSize, { value: 0.0, duration: time * 0.8 });

			this.removeListeners();
		});
	}

	destroy() {
		if (!this.instancedMesh) return;

		this.instancedMesh.parent.remove(this.instancedMesh);
		this.instancedMesh.geometry.dispose();
		this.instancedMesh.material.dispose();
		this.instancedMesh = null;

		if (!this.hitArea) return;

		this.hitArea.parent.remove(this.hitArea);
		this.hitArea.geometry.dispose();
		this.hitArea.material.dispose();
		this.hitArea = null;
	}

	// ---------------------------------------------------------------------------------------------
	// EVENT HANDLERS
	// ---------------------------------------------------------------------------------------------

	resize() {
		if (!this.instancedMesh) return;

		// const scale = this.webgl.fovHeight / this.height;
		// this is to calculate the scale for the instanced particles image to fit the screen height
		const scale = 2 * Math.tan((this.camera.fov * Math.PI) / 180 / 2) * this.camera.position.z / this.height;
		this.instancedMesh.scale.set(scale, scale, 1);
		this.hitArea.scale.set(scale, scale, 1);
	}

	onInteractiveMove(e) {
		const uv = e.intersectionData.uv;
		if (this.touch) this.touch.addTouch(uv);
	}
}
