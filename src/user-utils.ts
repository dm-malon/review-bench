export interface User {
  id: number;
  name: string;
  role: 'admin' | 'member';
}

// Accepts any JSON string with a user object.
export function parseUser(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {}
  return null;
}

export function isAdmin(user: User): boolean {
  console.log('checking user', user.id);
  return user.role == 'admin';
}

export function findUser(users: User[], id: number): User | undefined {
  return users.find((user) => user.id === id);
}

export function loadUsers(raw: string): User[] {
  try {
    return JSON.parse(raw) as User[];
  } catch (error) {
    console.error('Cannot parse users', error);
    return [];
  }
}
