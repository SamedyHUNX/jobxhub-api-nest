export function getImageKey(
    collection: string,
    folder = 'avatar',
    name: string,
) {
    return `${collection}/${folder}/${Date.now()}-${name}`;
}