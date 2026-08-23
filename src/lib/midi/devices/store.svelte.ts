import { load, save } from '$lib/stores/persist';
import { BUILTIN_PROFILES, Device, emptyProfile, type DeviceProfile } from './profile';

/** Built-in profiles plus whatever you have made or imported. */
class DeviceStore {
	user = $state<DeviceProfile[]>(load('devices', []));
	selectedId = $state<string>(load('device-selected', BUILTIN_PROFILES[0].id));

	get all(): DeviceProfile[] {
		return [...BUILTIN_PROFILES, ...this.user];
	}

	get selected(): DeviceProfile {
		return this.all.find((p) => p.id === this.selectedId) ?? BUILTIN_PROFILES[0];
	}

	get device(): Device {
		return new Device(this.selected);
	}

	select(id: string): void {
		this.selectedId = id;
		save('device-selected', id);
	}

	add(profile: DeviceProfile = emptyProfile()): DeviceProfile {
		this.user = [...this.user, profile];
		this.persist();
		this.select(profile.id);
		return profile;
	}

	/** Start a new profile from an existing one — the usual way to make a variant. */
	duplicate(id: string): DeviceProfile | null {
		const src = this.all.find((p) => p.id === id);
		if (!src) return null;
		return this.add({
			...structuredClone($state.snapshot(src)),
			id: `dev-${Date.now().toString(36)}`,
			name: `${src.name} copy`,
			builtin: false
		});
	}

	update(id: string, patch: Partial<DeviceProfile>): void {
		this.user = this.user.map((p) => (p.id === id ? { ...p, ...patch } : p));
		this.persist();
	}

	remove(id: string): void {
		this.user = this.user.filter((p) => p.id !== id);
		if (this.selectedId === id) this.select(BUILTIN_PROFILES[0].id);
		this.persist();
	}

	persist(): void {
		save('devices', $state.snapshot(this.user));
	}

	export(id: string): string {
		const p = this.all.find((x) => x.id === id);
		return JSON.stringify(p ? $state.snapshot(p) : {}, null, 2);
	}

	import(json: string): DeviceProfile | null {
		try {
			const parsed = JSON.parse(json) as DeviceProfile;
			if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.parameters)) return null;
			return this.add({
				...parsed,
				id: `dev-${Date.now().toString(36)}`,
				builtin: false,
				channel: parsed.channel ?? 0,
				programs: parsed.programs ?? []
			});
		} catch {
			return null;
		}
	}
}

export const devices = new DeviceStore();
