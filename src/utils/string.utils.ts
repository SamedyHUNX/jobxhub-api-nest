export function capitalizeString(str: string): string {
    if (!str || str.length === 0) {
        return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function sanitizedEmail(email: string): string {
    return email ? `${email.substring(0, 3)}***` : 'unknown';
}