// @author brunoimbrizi / http://brunoimbrizi.com

precision highp float;

attribute float pindex;
attribute vec3 position;
attribute vec3 offset;
attribute vec2 uv;
attribute float angle;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uTime;
uniform float uRandom;
uniform float uDepth;
uniform float uSize;
uniform vec2 uTextureSize;
uniform sampler2D uTexture;
uniform sampler2D uTouch;

varying vec2 vPUv;
varying vec2 vUv;

// should be returning between -1 to 1 according to https://github.com/stegu/webgl-noise/
#pragma glslify: snoise = require(glsl-noise/simplex/2d)

// theory: https://thebookofshaders.com/10/
// just fract the resultant of a sine wave multiplied by a large number
// returns a random number between 0 and 1
float random(float n) {
	return fract(sin(n) * 43758.5453123);
}

void main() {
	vUv = uv;

	// particle uv
	vec2 puv = offset.xy / uTextureSize;
	vPUv = puv;

	// pixel color
	vec4 colA = texture2D(uTexture, puv);
	// color to greyscale formula reference: https://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
	float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;

	// displacement, note that offset is of size 320x180
	vec3 displaced = offset;
	// randomise, offsetting particles slightly from their original positions in an ordered grid,
	// pindex is the current number of particle instance / vertex (from 0 to 57599)
	displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * uRandom;
	// make a random number that responds to time
	float rndz = (random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1)));
	// displace the z distance randomly according to rndz and pindex
	displaced.z += rndz * (random(pindex) * 2.0 * uDepth);
	// centering the pixels(because the coordinates are initially from 0 to uTextureSize)
	displaced.xy -= uTextureSize * 0.5;

	// touch
	float t = texture2D(uTouch, puv).r;
	displaced.z += t * 20.0 * rndz;
	displaced.x += cos(angle) * t * 20.0 * rndz;
	displaced.y += sin(angle) * t * 20.0 * rndz;

	// particle size
	float psize = (snoise(vec2(uTime, pindex) * 0.5) + 2.0);
	psize *= max(grey, 0.2);
	psize *= uSize;

	// final position
	vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
	// think of this as a nested loop(1st -> over all particles, 2nd -> over all vertices in each particle)
	// the second loop iterates through the position attribute and thus gives size to each particle
	mvPosition.xyz += position * psize;
	vec4 finalPosition = projectionMatrix * mvPosition;

	gl_Position = finalPosition;
}
