let isOpen = $state(false);

export function mobileNav() {
	return {
		get isOpen() {
			return isOpen;
		},
		toggle() {
			isOpen = !isOpen;
		},
		open() {
			isOpen = true;
		},
		close() {
			isOpen = false;
		}
	};
}
