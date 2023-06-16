import * as THREE from 'three';

// could use other easing functions to alter how the particles explode/contract
import { easeOutSine } from './utils/easing.js';

export default class TouchTexture {
	constructor(parent) {
		this.parent = parent;
		this.size = 64;
		this.maxAge = 120;
		this.radius = 0.15;
		this.trail = [];

		this.initTexture();
	}

    // initializing a canvas object to be a THREEJS texture,
    // assigned to this.texture
	initTexture() {
		this.canvas = document.createElement('canvas');
		this.canvas.width = this.canvas.height = this.size;
		this.ctx = this.canvas.getContext('2d');
        // init with a black canvas(nothing is drawn on it yet)
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.texture = new THREE.Texture(this.canvas);

		this.canvas.id = 'touchTexture';
		this.canvas.style.width = this.canvas.style.height = `${this.canvas.width}px`;
	}

    // This update method first clears the canvas
    // then add 1 to the age of all points
    // remove points that are too old
    // draw the whole trail again
    // set needsUpdate to True for the texture
	update(delta) {
		this.clear();

		// age points
		this.trail.forEach((point, i) => {
			point.age++;
			// remove old point
			if (point.age > this.maxAge) {
				this.trail.splice(i, 1);
			}
		});

		this.trail.forEach((point, i) => {
			this.drawTouch(point);
		});

		this.texture.needsUpdate = true;
	}

    // clear by filling all with black
	clear() {
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	addTouch(point) {
		let force = 0;
        // new points are added to the tail of the trail array
        // so "last" here means the closest point added before this one
        // force of a point is actually calculated by the distance between new point and previous point
		const last = this.trail[this.trail.length - 1];
		if (last) {
			const dx = last.x - point.x;
			const dy = last.y - point.y;
			const dd = dx * dx + dy * dy;
			force = Math.min(dd * 10000, 1);
		}
		this.trail.push({ x: point.x, y: point.y, age: 0, force });
	}

	drawTouch(point) {
		const pos = {
			x: point.x * this.size,
			y: (1 - point.y) * this.size
		};

		let intensity = 1;
        // young age = explode the particles from center to outwards
        // old age = contract the particles from outwards back to center
		if (point.age < this.maxAge * 0.3) {
			intensity = easeOutSine(point.age / (this.maxAge * 0.3), 0, 1, 1);
		} else {
			intensity = easeOutSine(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7), 0, 1, 1);
		}

		intensity *= point.force;

		const radius = this.size * this.radius * intensity;
        // this gradient method creates a radial gradient using the size and coordinates of two circles.
        // createRadialGradient(x0, y0, r0, x1, y1, r1)
		const grd = this.ctx.createRadialGradient(pos.x, pos.y, radius * 0.25, pos.x, pos.y, radius);
		grd.addColorStop(0, `rgba(255, 255, 255, 0.2)`);
		grd.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

		this.ctx.beginPath();
		this.ctx.fillStyle = grd;
		this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
		this.ctx.fill();
	}
}
