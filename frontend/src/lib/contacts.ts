// Contact Book — localStorage-based address book

export interface Contact {
  name: string;
  address: string;
}

const CONTACTS_KEY = "marina-copilot-contacts";

export function getContacts(): Contact[] {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]"); } catch { return []; }
}

export function saveContacts(contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function addContact(name: string, address: string) {
  const contacts = getContacts();
  contacts.push({ name, address });
  saveContacts(contacts);
}

export function removeContact(address: string) {
  saveContacts(getContacts().filter((c) => c.address !== address));
}

export function resolveContact(nameOrAddress: string): string | null {
  if (nameOrAddress.startsWith("0x")) return nameOrAddress;
  const contact = getContacts().find((c) => c.name.toLowerCase() === nameOrAddress.toLowerCase());
  return contact?.address || null;
}
