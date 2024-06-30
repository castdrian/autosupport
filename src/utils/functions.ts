export function isOnlyURL(str: string) {
	try {
		const url = new URL(str);
		return str === url.href;
	} catch (error) {
		return false;
	}
}
