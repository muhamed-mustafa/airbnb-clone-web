/** Shape of GET /bff/session, shared by the route handler and the browser. */
export interface SessionStatus {
  authenticated: boolean;
  subject?: { id: string; role: 'admin'; name?: string; email?: string };
}
