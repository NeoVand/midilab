<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import { Slider } from '$lib/components/ui/slider';
	import { IntervalTone } from '$lib/audio/interval-tone';
	import {
		TIMBRES,
		ratioFromSemitones,
		semitonesFromRatio,
		sampleSurface,
		spectrum,
		triadRoughness,
		type TimbreId
	} from '$lib/music/acoustics';
	import { intervalName } from '$lib/midi/notes';

	const uid = $props.id();
	const REGISTERS = [
		{ value: 130.8128, label: 'Low C' },
		{ value: 261.6256, label: 'Middle C' },
		{ value: 523.2511, label: 'High C' }
	];
	let base = $state(261.6256);
	const PRESETS = [
		{ label: 'Major', a: 4, b: 7 },
		{ label: 'Pure-ratio major', a: 12 * Math.log2(5 / 4), b: 12 * Math.log2(3 / 2) },
		{ label: 'Minor', a: 3, b: 7 },
		{ label: 'Suspended', a: 5, b: 7 },
		{ label: 'Close cluster', a: 1, b: 2 },
		{ label: 'Octave + fifth', a: 7, b: 12 }
	];
	const ticks = [1, 1.2, 1.4, 1.6, 1.8, 2];
	const HEIGHT = 12;
	const SPAN = 12;
	const heightTicks = [0, 0.02, 0.04, 0.06];
	const octaves = [1, 2, 4, 8, 16];
	let a = $state(4);
	let b = $state(7);
	let timbre = $state<TimbreId>('harmonic');
	let playing = $state(false);
	let error = $state('');
	let graphics = $state<'loading' | 'ready' | 'fallback'>('loading');
	let dark = $state(true);
	let tone: IntervalTone | undefined;
	let session = 0;
	interface SceneView {
		paint: (
			surface: ReturnType<typeof sampleSurface>,
			a: number,
			b: number,
			value: number,
			dark: boolean
		) => void;
		camera: (top: boolean) => void;
		dispose: () => void;
	}
	let view = $state.raw<SceneView | undefined>();
	const frequencies = $derived([base, base * ratioFromSemitones(a), base * ratioFromSemitones(b)]);
	const partials = $derived(frequencies.map((frequency) => spectrum(frequency, timbre)));
	const roughness = $derived(triadRoughness(base, a, b, timbre));
	const surface = $derived(sampleSurface(base, timbre));
	const normalized = $derived(Math.min(1, roughness / surface.scale));
	const timbreDescription = $derived(TIMBRES.find((item) => item.id === timbre)?.description);
	const selectedPreset = $derived(
		PRESETS.find((preset) => Math.abs(a - preset.a) < 0.005 && Math.abs(b - preset.b) < 0.005)
			?.label ?? ''
	);
	const fallbackCells = $derived.by(() => {
		const cells = [];
		const stride = Math.ceil(surface.steps / 32);
		for (let row = 0; row < surface.steps; row += stride)
			for (let col = 0; col < surface.steps; col += stride)
				cells.push({
					id: `${row}-${col}`,
					width: (stride / surface.steps) * 480 + 0.3,
					height: (stride / surface.steps) * 240 + 0.3,
					x: 45 + (col / surface.steps) * 480,
					y: 275 - (row / surface.steps) * 240,
					color: colorFor(surface.values[row * (surface.steps + 1) + col] / surface.scale)
				});
		return cells;
	});

	// One fixed diverging ramp for all registers and timbres, in model units.
	const COLOR_STOPS = [
		{ at: 0, rgb: [22, 57, 156] },
		{ at: 0.2, rgb: [52, 107, 189] },
		{ at: 1 / 3, rgb: [230, 235, 237] },
		{ at: 0.04 / 0.075, rgb: [244, 145, 79] },
		{ at: 0.05 / 0.075, rgb: [217, 46, 42] },
		{ at: 0.8, rgb: [179, 28, 43] },
		{ at: 1, rgb: [135, 25, 44] }
	];
	function colorFor(value: number) {
		const v = Math.max(0, Math.min(1, value));
		const next = COLOR_STOPS.findIndex((stop) => stop.at >= v);
		const high = COLOR_STOPS[Math.max(1, next)];
		const low = COLOR_STOPS[Math.max(0, next - 1)];
		const mix = (v - low.at) / (high.at - low.at);
		return `rgb(${low.rgb.map((channel, i) => Math.round(channel + (high.rgb[i] - channel) * mix)).join(', ')})`;
	}
	const ratioPosition = (semitones: number) => (ratioFromSemitones(semitones) - 1.5) * SPAN;

	function partialX(frequency: number) {
		return 44 + (Math.log2(frequency / base) / Math.log2(24)) * 512;
	}
	function stop() {
		session++;
		tone?.stop();
		playing = false;
	}
	async function listen() {
		stop();
		error = '';
		const token = session;
		if (!tone) return;
		try {
			const started = await tone.play(frequencies, timbre, 3);
			if (token === session) playing = started;
		} catch {
			if (token !== session) return;
			playing = false;
			error = 'Sound could not start. Select Hear chord to try again.';
		}
	}
	function changeInterval(which: 'a' | 'b', value: number) {
		// The slider rounds controlled values to its step. Keep off-grid presets and
		// surface picks exact; that passive rounding must not cancel an audition.
		if (Math.abs((which === 'a' ? a : b) - value) < 0.005) return;
		stop();
		if (which === 'a') a = value;
		else b = value;
	}
	function choosePreset(preset: (typeof PRESETS)[number]) {
		stop();
		a = preset.a;
		b = preset.b;
	}
	function changeTimbre(value: TimbreId) {
		stop();
		timbre = value;
	}
	function changeRegister(value: number) {
		stop();
		base = value;
	}

	onMount(() => {
		const root = document.documentElement;
		const syncTheme = () => (dark = root.classList.contains('dark'));
		syncTheme();
		const themeObserver = new MutationObserver(syncTheme);
		themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
		tone = new IntervalTone();
		const unsubscribe = tone.onStop(() => (playing = false));
		return () => {
			themeObserver.disconnect();
			stop();
			unsubscribe();
			tone?.dispose();
		};
	});

	function mountSurface(canvas: HTMLCanvasElement) {
		let disposed = false;
		void (async () => {
			try {
				const [THREE, { OrbitControls }] = await Promise.all([
					import('three'),
					import('three/addons/controls/OrbitControls.js')
				]);
				if (disposed) return;
				const host = canvas.parentElement;
				if (!host) return;
				const context = canvas.getContext('webgl2', { antialias: true, alpha: true });
				if (!context) {
					graphics = 'fallback';
					return;
				}
				const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
				renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
				renderer.outputColorSpace = THREE.SRGBColorSpace;
				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 150);
				const controls = new OrbitControls(camera, canvas);
				controls.target.set(0, 3.8, 0);
				controls.minDistance = 17;
				controls.maxDistance = 52;
				controls.maxPolarAngle = Math.PI * 0.49;
				controls.enablePan = false;
				camera.position.set(17, 13, 18);
				controls.update();
				scene.add(new THREE.AmbientLight(0xffffff, 1.15));
				const light = new THREE.DirectionalLight(0xffffff, 1.5);
				light.position.set(-3, 16, 7);
				scene.add(light);

				const floorGeometry = new THREE.PlaneGeometry(SPAN, SPAN);
				const floorMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
				const floor = new THREE.Mesh(floorGeometry, floorMaterial);
				floor.rotation.x = -Math.PI / 2;
				floor.position.y = -0.085;
				scene.add(floor);
				const framePoints: number[] = [];
				function frameLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
					framePoints.push(x1, y1, z1, x2, y2, z2);
				}
				for (const tick of ticks) {
					const at = (tick - 1.5) * SPAN;
					frameLine(at, -0.06, -6, at, -0.06, 6);
					frameLine(-6, -0.06, at, 6, -0.06, at);
					frameLine(at, 0, -6, at, HEIGHT, -6);
					frameLine(-6, 0, at, -6, HEIGHT, at);
				}
				// Horizontal wall levels use the same fixed units as the surface's vertical axis.
				for (const tick of heightTicks) {
					const at = (tick / surface.scale) * HEIGHT;
					frameLine(-6, at, -6, 6, at, -6);
					frameLine(-6, at, -6, -6, at, 6);
				}
				const frameGeometry = new THREE.BufferGeometry();
				frameGeometry.setAttribute('position', new THREE.Float32BufferAttribute(framePoints, 3));
				const frameMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.38 });
				const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
				scene.add(frame);
				const axisGeometry = new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(-6, 0, 6),
					new THREE.Vector3(6, 0, 6),
					new THREE.Vector3(6, 0, 6),
					new THREE.Vector3(6, 0, -6),
					new THREE.Vector3(-6, 0, 6),
					new THREE.Vector3(-6, HEIGHT, 6)
				]);
				const axisMaterial = new THREE.LineBasicMaterial();
				scene.add(new THREE.LineSegments(axisGeometry, axisMaterial));

				const geometry = new THREE.BufferGeometry();
				const material = new THREE.MeshStandardMaterial({
					vertexColors: true,
					side: THREE.DoubleSide,
					metalness: 0,
					roughness: 0.84
				});
				const mesh = new THREE.Mesh(geometry, material);
				scene.add(mesh);
				const contourGeometry = new THREE.BufferGeometry();
				const contourMaterial = new THREE.LineBasicMaterial({
					vertexColors: true,
					transparent: true,
					opacity: 0.84
				});
				scene.add(new THREE.LineSegments(contourGeometry, contourMaterial));
				const markerGeometry = new THREE.SphereGeometry(0.18, 20, 14);
				const markerMaterial = new THREE.MeshBasicMaterial({
					color: 0x70f5d9,
					depthTest: false,
					depthWrite: false
				});
				const marker = new THREE.Mesh(markerGeometry, markerMaterial);
				marker.renderOrder = 10;
				const markerHaloMaterial = new THREE.MeshBasicMaterial({
					color: 0x153e43,
					side: THREE.BackSide,
					depthTest: false,
					depthWrite: false
				});
				const markerHalo = new THREE.Mesh(markerGeometry, markerHaloMaterial);
				markerHalo.scale.setScalar(1.6);
				markerHalo.renderOrder = 9;
				marker.add(markerHalo);
				scene.add(marker);
				const lineGeometry = new THREE.BufferGeometry();
				const stemPositions = new THREE.Float32BufferAttribute(new Float32Array(6), 3);
				lineGeometry.setAttribute('position', stemPositions);
				const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4db9a6 });
				scene.add(new THREE.Line(lineGeometry, lineMaterial));
				const labels: import('three').Sprite[] = [];
				const verticalLabels: import('three').Sprite[] = [];
				const labelTextures: import('three').CanvasTexture[] = [];
				function label(text: string, x: number, y: number, z: number, vertical = false) {
					const image = document.createElement('canvas');
					image.width = 512;
					image.height = 128;
					const context = image.getContext('2d');
					if (!context) return;
					context.fillStyle = '#ffffff';
					context.font = text.length > 5 ? '500 60px sans-serif' : '500 76px sans-serif';
					context.textAlign = 'center';
					context.fillText(text, 256, 94);
					const texture = new THREE.CanvasTexture(image);
					const sprite = new THREE.Sprite(
						new THREE.SpriteMaterial({ map: texture, depthTest: false })
					);
					sprite.position.set(x, y, z);
					sprite.scale.set(text.length > 5 ? 4.2 : 2, text.length > 5 ? 1.05 : 0.5, 1);
					labels.push(sprite);
					labelTextures.push(texture);
					if (vertical) verticalLabels.push(sprite);
					scene.add(sprite);
				}
				for (const tick of ticks) {
					label(tick.toFixed(1), (tick - 1.5) * SPAN, -0.45, 6.8);
					label(tick.toFixed(1), 6.8, -0.45, (tick - 1.5) * SPAN);
				}
				for (const tick of heightTicks)
					label(tick === 0 ? '0' : tick.toFixed(2), -7, (tick / surface.scale) * HEIGHT, 6, true);
				label('Ratio 1', 0, -0.9, 8.3);
				label('Ratio 2', 8.3, -0.9, 0);
				label('Roughness', -6.6, HEIGHT - 0.8, 6, true);

				const draw = () => renderer.render(scene, camera);
				controls.addEventListener('change', draw);
				const resize = () => {
					const { width, height } = host.getBoundingClientRect();
					renderer.setSize(Math.max(1, width), Math.max(1, height));
					camera.aspect = width / Math.max(1, height);
					camera.updateProjectionMatrix();
					draw();
				};
				const observer = new ResizeObserver(resize);
				observer.observe(host);
				const lost = (event: Event) => {
					event.preventDefault();
					graphics = 'fallback';
					stop();
				};
				const restored = () => {
					graphics = 'ready';
					resize();
				};
				canvas.addEventListener('webglcontextlost', lost);
				canvas.addEventListener('webglcontextrestored', restored);
				const raycaster = new THREE.Raycaster();
				const pointer = new THREE.Vector2();
				let down: { x: number; y: number; id: number } | null = null;
				const pointerDown = (event: PointerEvent) => {
					if (!event.isPrimary || event.button !== 0) {
						down = null;
						return;
					}
					down = { x: event.clientX, y: event.clientY, id: event.pointerId };
				};
				const pointerUp = (event: PointerEvent) => {
					const start = down;
					down = null;
					if (
						!start ||
						start.id !== event.pointerId ||
						Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
					)
						return;
					const rect = canvas.getBoundingClientRect();
					pointer.set(
						((event.clientX - rect.left) / rect.width) * 2 - 1,
						-((event.clientY - rect.top) / rect.height) * 2 + 1
					);
					raycaster.setFromCamera(pointer, camera);
					const hit = raycaster.intersectObject(mesh)[0];
					if (!hit) return;
					stop();
					a = semitonesFromRatio(Math.max(1, Math.min(2, hit.point.x / SPAN + 1.5)));
					b = semitonesFromRatio(Math.max(1, Math.min(2, hit.point.z / SPAN + 1.5)));
					void listen();
				};
				const pointerMove = (event: PointerEvent) => {
					if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down = null;
				};
				const cancel = () => (down = null);
				canvas.addEventListener('pointerdown', pointerDown);
				canvas.addEventListener('pointermove', pointerMove);
				canvas.addEventListener('pointerup', pointerUp);
				canvas.addEventListener('pointercancel', cancel);
				let previous: ReturnType<typeof sampleSurface> | undefined;
				let previousDark: boolean | undefined;
				view = {
					paint(data, first, second, value, darkTheme) {
						if (darkTheme !== previousDark) {
							previousDark = darkTheme;
							const ink = darkTheme ? 0xcbd7e5 : 0x293d51;
							renderer.setClearColor(darkTheme ? 0x11171e : 0xf7f9fb, 1);
							floorMaterial.color.setHex(darkTheme ? 0x17212d : 0xf0f3f6);
							frameMaterial.color.setHex(darkTheme ? 0x7990a8 : 0x8ea2b7);
							axisMaterial.color.setHex(ink);
							for (const sprite of labels) sprite.material.color.setHex(ink);
						}
						if (data !== previous) {
							if (previous) {
								geometry.dispose();
								contourGeometry.dispose();
							}
							previous = data;
							const positions: number[] = [],
								colors: number[] = [],
								indices: number[] = [];
							const n = data.steps + 1;
							const color = new THREE.Color();
							for (let row = 0; row < n; row++)
								for (let col = 0; col < n; col++) {
									const height = Math.max(0, Math.min(1, data.values[row * n + col] / data.scale));
									positions.push(
										(col / data.steps - 0.5) * SPAN,
										height * HEIGHT,
										(row / data.steps - 0.5) * SPAN
									);
									color.setStyle(colorFor(height));
									colors.push(color.r, color.g, color.b);
									if (row < data.steps && col < data.steps) {
										const i = row * n + col;
										indices.push(i, i + n, i + 1, i + 1, i + n, i + n + 1);
									}
								}
							geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
							geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
							geometry.setIndex(indices);
							geometry.computeVertexNormals();
							geometry.computeBoundingSphere();
							// Project iso-roughness curves onto the floor. Triangular interpolation matches the mesh.
							const contours: number[] = [],
								contourColors: number[] = [];
							for (let level = 0.005; level < data.scale; level += 0.005) {
								color.setStyle(colorFor(level / data.scale));
								for (let row = 0; row < data.steps; row++)
									for (let col = 0; col < data.steps; col++) {
										const i = row * n + col;
										for (const triangle of [
											[i, i + n, i + 1],
											[i + 1, i + n, i + n + 1]
										]) {
											const intersections: number[] = [];
											for (let edge = 0; edge < 3; edge++) {
												const from = triangle[edge],
													to = triangle[(edge + 1) % 3];
												const v1 = data.values[from],
													v2 = data.values[to];
												if (v1 < level === v2 < level) continue;
												const t = (level - v1) / (v2 - v1);
												intersections.push(
													positions[from * 3] + t * (positions[to * 3] - positions[from * 3]),
													0.03,
													positions[from * 3 + 2] +
														t * (positions[to * 3 + 2] - positions[from * 3 + 2])
												);
											}
											if (intersections.length === 6) {
												contours.push(...intersections);
												contourColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
											}
										}
									}
							}
							contourGeometry.setAttribute(
								'position',
								new THREE.Float32BufferAttribute(contours, 3)
							);
							contourGeometry.setAttribute(
								'color',
								new THREE.Float32BufferAttribute(contourColors, 3)
							);
							contourGeometry.computeBoundingSphere();
						}
						const x = ratioPosition(first),
							z = ratioPosition(second);
						const y = Math.max(0, Math.min(1, value / data.scale)) * HEIGHT + 0.23;
						marker.position.set(x, y, z);
						stemPositions.setXYZ(0, x, 0.03, z);
						stemPositions.setXYZ(1, x, y, z);
						stemPositions.needsUpdate = true;
						lineGeometry.computeBoundingSphere();
						draw();
					},
					camera(top) {
						controls.target.set(0, top ? 0 : 3.8, 0);
						if (top) camera.position.set(0, 28, 0.01);
						else camera.position.set(17, 13, 18);
						for (const sprite of verticalLabels) sprite.visible = !top;
						controls.update();
						draw();
					},
					dispose() {
						observer.disconnect();
						controls.removeEventListener('change', draw);
						controls.dispose();
						canvas.removeEventListener('pointerdown', pointerDown);
						canvas.removeEventListener('pointermove', pointerMove);
						canvas.removeEventListener('pointerup', pointerUp);
						canvas.removeEventListener('pointercancel', cancel);
						canvas.removeEventListener('webglcontextlost', lost);
						canvas.removeEventListener('webglcontextrestored', restored);
						for (const sprite of labels) sprite.material.dispose();
						for (const texture of labelTextures) texture.dispose();
						for (const object of [
							floorGeometry,
							frameGeometry,
							axisGeometry,
							geometry,
							contourGeometry,
							markerGeometry,
							lineGeometry
						])
							object.dispose();
						for (const object of [
							floorMaterial,
							frameMaterial,
							axisMaterial,
							material,
							contourMaterial,
							markerMaterial,
							markerHaloMaterial,
							lineMaterial
						])
							object.dispose();
						renderer.forceContextLoss();
						renderer.dispose();
					}
				};
				resize();
				graphics = 'ready';
			} catch {
				if (!disposed) graphics = 'fallback';
			}
		})();
		return () => {
			disposed = true;
			view?.dispose();
		};
	}
</script>

<section class="roughness-lab" aria-labelledby={`${uid}-title`}>
	<header class="lab-header">
		<div>
			<h3 id={`${uid}-title`}>Hear the landscape</h3>
			<p>One base tone, two moving tones. Explore the valleys with your ears.</p>
		</div>
		<div class="sound-actions">
			<Button onclick={() => void listen()}>{playing ? 'Hear again' : 'Hear chord'}</Button><Button
				variant="outline"
				onclick={stop}
				disabled={!playing}>Stop</Button
			>
		</div>
	</header>
	<Field.Field>
		<Field.Label>Chord landmarks</Field.Label>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			value={selectedPreset}
			spacing={2}
			class="flex-wrap"
			aria-label="Chord presets"
			onValueChange={(value) => {
				const preset = PRESETS.find((item) => item.label === value);
				if (preset) choosePreset(preset);
			}}
		>
			{#each PRESETS as preset (preset.label)}
				<ToggleGroup.Item value={preset.label}>{preset.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</Field.Field>
	<div class="sound-controls">
		<Field.Field class="w-fit">
			<Field.Label for={`${uid}-register`}>Base register</Field.Label>
			<NativeSelect.Root
				id={`${uid}-register`}
				value={base}
				onchange={(event) => changeRegister(Number(event.currentTarget.value))}
			>
				{#each REGISTERS as register (register.value)}
					<NativeSelect.Option value={register.value}
						>{register.label} · {register.value.toFixed(1)} Hz</NativeSelect.Option
					>
				{/each}
			</NativeSelect.Root>
		</Field.Field>
		<Field.Field class="w-fit">
			<Field.Label>Synthetic timbre</Field.Label>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				value={timbre}
				spacing={2}
				class="flex-wrap"
				aria-label="Synthetic timbre"
				onValueChange={(value) => {
					if (value) changeTimbre(value as TimbreId);
				}}
			>
				{#each TIMBRES as item (item.id)}
					<ToggleGroup.Item value={item.id}>{item.label}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</Field.Field>
	</div>
	<p class="timbre-description">
		{timbreDescription} Change the timbre and watch the same chords move through the landscape.
	</p>
	{#if Math.abs(a - 12 * Math.log2(5 / 4)) < 0.005 && Math.abs(b - 12 * Math.log2(3 / 2)) < 0.005}
		<p class="timbre-description">
			This major chord uses pure ratios of 5:4 and 3:2. Its third is slightly flatter and its fifth
			slightly sharper than the keyboard’s equal-tempered major chord.
		</p>
	{/if}
	<figure class="landscape" data-theme={dark ? 'dark' : 'light'}>
		<div class="surface-header">
			<span
				>Base {REGISTERS.find((register) => register.value === base)?.label} · {base.toFixed(1)} Hz</span
			><span>Height = estimated sensory roughness</span>
		</div>
		<div class="surface-host" data-graphics={graphics}>
			<canvas
				{@attach mountSurface}
				{@attach () => view?.paint(surface, a, b, roughness, dark)}
				aria-label="Rotatable roughness surface. Horizontal axes show frequency ratios from one to two; the vertical axis shows estimated sensory roughness. Use the interval sliders and Hear chord button for keyboard access."
				style:visibility={graphics === 'ready' ? 'visible' : 'hidden'}
			></canvas>
			{#if graphics !== 'ready'}
				<svg
					class="fallback-map"
					viewBox="0 0 580 330"
					role="img"
					aria-label="Top view of roughness. Interval one runs horizontally and interval two vertically, each showing frequency ratios from one to two."
				>
					{#each fallbackCells as cell (cell.id)}<rect
							x={cell.x}
							y={cell.y - cell.height}
							width={cell.width}
							height={cell.height}
							fill={cell.color}
						/>{/each}
					{#each ticks as tick (tick)}<text x={45 + (tick - 1) * 480} y="299">{tick}</text><text
							x="25"
							y={275 - (tick - 1) * 240}>{tick}</text
						>{/each}
					<circle
						cx={45 + (ratioFromSemitones(a) - 1) * 480}
						cy={275 - (ratioFromSemitones(b) - 1) * 240}
						r="7"
						fill="#70f5d9"
						stroke="#153e43"
						stroke-width="2"
					/>
					<text x="285" y="321">Ratio 1 · frequency ÷ base frequency</text>
				</svg>
			{/if}
		</div>
		<div class="surface-footer">
			<span>Ratio 1 × Ratio 2 · each moving frequency ÷ base frequency</span>
			<div>
				<Button
					variant="outline"
					size="sm"
					onclick={() => view?.camera(true)}
					disabled={graphics !== 'ready'}>Top view</Button
				><Button
					variant="outline"
					size="sm"
					onclick={() => view?.camera(false)}
					disabled={graphics !== 'ready'}>Reset view</Button
				>
			</div>
		</div>
		<div class="height-legend" aria-label="Fixed model roughness color scale, zero to 0.075">
			<span>Estimated roughness</span>
			<div>
				<div
					class="color-ramp"
					style:background={`linear-gradient(90deg, ${COLOR_STOPS.map(({ at }) => `${colorFor(at)} ${at * 100}%`).join(', ')})`}
				></div>
				<div class="legend-ticks">
					<span>0</span><span>0.02</span><span>0.04</span><span>0.06</span><span>0.075</span>
				</div>
			</div>
		</div>
		<figcaption>
			{graphics === 'fallback'
				? '3D graphics are unavailable here. The map, sliders and sound still work.'
				: 'Drag to rotate. Tap or click the surface to hear that chord. Pinch or scroll to zoom.'}
			<span
				>Blue valleys: less roughness. Orange and red peaks: more. Height and colour scales stay
				fixed across timbres and registers.</span
			>
			<span>Contour lines on the floor join equal roughness estimates.</span>
		</figcaption>
	</figure>
	<div class="interval-controls">
		{#each [{ key: 'a' as const, value: a, label: 'Interval 1' }, { key: 'b' as const, value: b, label: 'Interval 2' }] as control (control.key)}
			<Field.Field>
				<Field.Label
					><strong>{control.label}</strong><span
						>{control.value.toFixed(2)} st · {Math.round(control.value * 100)} cents</span
					></Field.Label
				><Slider
					type="single"
					min={0}
					max={12}
					step={0.01}
					value={control.value}
					aria-label={control.label}
					onValueChange={(value) => changeInterval(control.key, value)}
				/>
				<div class="interval-detail">
					<span
						>{Math.abs(control.value - Math.round(control.value)) < 0.005
							? intervalName(Math.round(control.value))
							: 'Between equal-tempered notes'}</span
					><span>{ratioFromSemitones(control.value).toFixed(3)} : 1</span>
				</div>
			</Field.Field>
		{/each}
	</div>
	<div class="readout" aria-live="polite">
		<span class="marker-dot"></span><span>Selected chord</span><strong
			>{frequencies.map((frequency) => `${frequency.toFixed(1)} Hz`).join(' / ')}</strong
		><span>Model estimate {roughness.toFixed(4)}</span>
		<div class="roughness-meter" aria-hidden="true">
			<div style:width={`${normalized * 100}%`} style:background={colorFor(normalized)}></div>
		</div>
	</div>
	<figure class="partials">
		<svg
			viewBox="0 0 600 210"
			role="img"
			aria-label="Three rows show the partial frequencies making up the selected tones. Taller lines mean louder partials. Nearby lines in different rows can contribute to roughness."
		>
			{#each octaves as multiplier (multiplier)}<line
					x1={partialX(base * multiplier)}
					x2={partialX(base * multiplier)}
					y1="12"
					y2="171"
					class="frequency-guide"
				/><text x={partialX(base * multiplier)} y="192" class="frequency-label"
					>{Math.round(base * multiplier)} Hz</text
				>{/each}
			{#each partials as row, index (['base', 'a', 'b'][index])}<g class={`tone-row tone-${index}`}
					><text x="8" y={42 + index * 55}>{index === 0 ? 'C' : index === 1 ? '1' : '2'}</text><line
						x1="44"
						x2="560"
						y1={53 + index * 55}
						y2={53 + index * 55}
						class="partial-baseline"
					/>{#each row as partial (partial.frequency)}<line
							x1={partialX(partial.frequency)}
							x2={partialX(partial.frequency)}
							y1={53 + index * 55}
							y2={53 + index * 55 - partial.amplitude * 36}
							stroke-width="3"
							stroke-linecap="round"
						/>{/each}</g
				>{/each}
		</svg>
		<figcaption>
			Look inside the chord: each line is one partial. Close partials can create beating and
			roughness. A pure tone has just one line.
		</figcaption>
	</figure>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<p class="model-note">
		This is a model of sensory roughness for three synthetic tones. It does not measure beauty,
		chord quality, musical tension, or what your culture and listening experience make meaningful.
		Listen to a chord in a phrase too.
	</p>
	<p class="credits">
		Inspired by <a href="https://github.com/aatishb/dissonance" target="_blank" rel="noreferrer"
			>Aatish Bhatia’s dissonance explorer</a
		> and William Sethares’ roughness model. This explorer uses its own implementation.
	</p>
</section>

<style>
	.roughness-lab {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.lab-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	h3 {
		font-size: 1.4rem;
		font-weight: 650;
		letter-spacing: -0.035em;
	}
	.lab-header p,
	.timbre-description {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--muted-foreground);
	}
	.sound-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.sound-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
	}
	.timbre-description {
		margin-top: -0.5rem;
		max-width: 65ch;
	}
	.landscape {
		border: 1px solid var(--border);
		background: var(--card);
		border-radius: 0.75rem;
		overflow: hidden;
	}
	.surface-header,
	.surface-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.8rem 1rem;
		color: var(--muted-foreground);
		font-size: 0.72rem;
	}
	.surface-header span:first-child {
		font-weight: 600;
	}
	.surface-host {
		width: 100%;
		height: clamp(360px, 60vw, 560px);
		position: relative;
	}
	.surface-host canvas {
		width: 100%;
		height: 100%;
		display: block;
		cursor: grab;
		position: absolute;
		inset: 0;
		touch-action: none;
	}
	.surface-host canvas:active {
		cursor: grabbing;
	}
	.fallback-map {
		width: 100%;
		height: 100%;
	}
	.fallback-map text {
		text-anchor: middle;
		fill: var(--muted-foreground);
		font-size: 10px;
	}
	.surface-footer {
		padding-top: 0;
	}
	.surface-footer div {
		display: flex;
		gap: 0.35rem;
	}
	.landscape figcaption {
		border-top: 1px solid var(--border);
		padding: 0.8rem 1rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.65;
	}
	.landscape figcaption span {
		display: block;
	}
	.interval-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.3rem;
	}
	.height-legend {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0 1rem 0.9rem;
		font-size: 0.65rem;
		color: var(--muted-foreground);
	}
	.height-legend > div {
		flex: 1;
		max-width: 19rem;
	}
	.color-ramp {
		height: 0.45rem;
		border-radius: 2px;
	}
	.legend-ticks {
		display: flex;
		justify-content: space-between;
		margin-top: 0.3rem;
		font-variant-numeric: tabular-nums;
	}
	.interval-detail {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.3rem;
		font-size: 0.72rem;
		color: var(--muted-foreground);
	}
	.readout {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.55rem;
		font-size: 0.72rem;
	}
	.readout strong {
		font-weight: 550;
		font-variant-numeric: tabular-nums;
		margin-right: auto;
	}
	.marker-dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: #70f5d9;
		border: 1px solid #153e43;
	}
	.roughness-meter {
		width: 5rem;
		height: 0.35rem;
		border-radius: 1rem;
		overflow: hidden;
		background: var(--muted);
	}
	.roughness-meter div {
		height: 100%;
	}
	.partials {
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
	}
	.partials svg {
		width: 100%;
		height: auto;
	}
	.partials figcaption,
	.model-note {
		font-size: 0.8rem;
		line-height: 1.65;
		color: var(--muted-foreground);
	}
	.frequency-guide {
		stroke: var(--border);
		stroke-dasharray: 2 5;
	}
	.frequency-label {
		text-anchor: middle;
		font-size: 9px;
		fill: var(--muted-foreground);
	}
	.partial-baseline {
		stroke: var(--border);
		stroke-width: 1;
	}
	.tone-row text {
		fill: var(--muted-foreground);
		font-size: 12px;
		font-weight: 600;
	}
	.tone-0 {
		stroke: var(--msg-program);
	}
	.tone-1 {
		stroke: var(--msg-cc);
	}
	.tone-2 {
		stroke: var(--msg-expr);
	}
	.model-note {
		padding-left: 0.9rem;
		border-left: 2px solid var(--border);
	}
	.credits {
		font-size: 0.7rem;
		color: var(--muted-foreground);
		line-height: 1.6;
	}
	.credits a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.error {
		color: var(--destructive);
		font-size: 0.8rem;
	}
	@media (max-width: 520px) {
		.interval-controls {
			grid-template-columns: 1fr;
		}
		.surface-header span:last-child {
			max-width: 20ch;
			text-align: right;
		}
		.surface-footer > span {
			max-width: 26ch;
		}
	}
</style>
